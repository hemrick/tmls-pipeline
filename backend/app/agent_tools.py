"""Function-call tools the Conversation Agent uses to mutate ``last_turn``.

The tools are exposed as bound methods on a per-turn ``TurnContext`` so each
call captures the same working snapshot. The MS Agent Framework introspects
the method signatures + docstrings to build OpenAI function-calling schemas;
keep type hints accurate and docstrings written for the LLM, not for humans.

After the LLM finishes calling tools, the agent loop reads
``ctx.snapshot()`` and hands it to ``conversation_store.apply_turn`` to
commit the new ``last_turn`` and roll history forward.
"""

from __future__ import annotations

import datetime
import logging
from typing import Optional

from app import conversation_store as cs
from app.services import quotes as quotes_service

logger = logging.getLogger("pipeline.tools")


# Problem types the LLM is allowed to pass to generate_quote_draft. Must
# match the keys in services/quotes.py::_TEMPLATES.
ALLOWED_PROBLEM_TYPES: tuple[str, ...] = (
    "leaking_faucet",
    "hot_water_tank",
    "dishwasher_install",
    "clogged_drain",
    "toilet_repair",
    "default",
)

# Sub-reasons the LLM is allowed to pass to close_conversation.
ALLOWED_SUB_REASONS: tuple[str, ...] = (
    "booked",
    "customer_declined",
    "wrong_number",
    "out_of_area",
    "out_of_scope",
    "spam",
)


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def generate_demo_slots(now: Optional[datetime.datetime] = None) -> list[cs.SlotOffer]:
    """Return three deterministic slots: the next three business days at 10:00 local.

    Skips Saturday and Sunday. Used by ``propose_slots`` as the Calendly
    substitute (see plan §6).
    """
    base = (now or datetime.datetime.now()).replace(
        hour=10, minute=0, second=0, microsecond=0
    )
    slots: list[cs.SlotOffer] = []
    day = base + datetime.timedelta(days=1)
    while len(slots) < 3:
        if day.weekday() < 5:  # Mon-Fri
            slots.append(
                cs.SlotOffer(
                    slot_id=f"slot-{len(slots) + 1}",
                    label=day.strftime("%a %b %-d, %-I:%M %p"),
                    iso_datetime=day.isoformat(),
                )
            )
        day += datetime.timedelta(days=1)
    return slots


class TurnContext:
    """Mutable per-turn container that owns the working ``last_turn``.

    All tool methods mutate ``self.working`` and append to
    ``self.tool_calls`` for observability. Call ``snapshot()`` at the end
    of the turn to read the final state.
    """

    def __init__(self, initial: cs.TurnSnapshot):
        # Deep-copy via dict() on the top fields; nested dicts are also re-wrapped
        # by each tool method when written.
        self.working: dict = dict(initial)
        self.working.setdefault("customer", {})
        self.working.setdefault("booking", cs.empty_booking())
        self.working.setdefault("notifications", [])
        self.tool_calls: list[dict] = []

    # ------------------------------------------------------------------
    # Snapshot
    # ------------------------------------------------------------------

    def snapshot(self) -> cs.TurnSnapshot:
        """Return the current working state as a TurnSnapshot."""
        return cs.TurnSnapshot(**self.working)  # type: ignore[typeddict-item]

    # ------------------------------------------------------------------
    # Tools — exposed to the LLM via function-calling
    # ------------------------------------------------------------------

    def set_customer_info(
        self,
        name: Optional[str] = None,
        phone: Optional[str] = None,
        email: Optional[str] = None,
    ) -> str:
        """Save any of the customer's name, phone number, or email address.

        Call this as soon as the customer shares any of these details, even
        if you only have one of them. You may call this multiple times in a
        single turn as more details are gathered.

        Args:
            name: The customer's name (first + last, or just first).
            phone: The customer's phone number, any format.
            email: The customer's email address.
        """
        customer = dict(self.working.get("customer", {}))
        if name:
            customer["name"] = name.strip()
        if phone:
            customer["phone"] = phone.strip()
        if email:
            customer["email"] = email.strip()
        self.working["customer"] = customer
        self._record("set_customer_info", {"name": name, "phone": phone, "email": email})
        return "ok"

    def generate_quote_draft(self, problem_type: str, job_summary: str) -> dict:
        """Draft a price quote for the customer's job, pending Jill's review.

        Only call this once the problem is scoped enough to pick a problem
        type. The quote will NOT be sent to the customer until Jill approves
        it on the dashboard. After calling, tell the customer their quote
        is being reviewed and the chat will update once it's ready.

        Args:
            problem_type: One of: leaking_faucet, hot_water_tank,
                dishwasher_install, clogged_drain, toilet_repair, default.
                Use "default" if no specific category fits.
            job_summary: One short sentence describing the job for Jill's
                review (e.g. "Hot water tank not producing heat.").
        """
        if problem_type not in ALLOWED_PROBLEM_TYPES:
            problem_type = "default"
        quote = quotes_service.generate_quote_draft(
            job_summary=job_summary, problem_type=problem_type
        )
        self.working["quote"] = dict(quote)
        self.working["status"] = "quoted"
        self._record(
            "generate_quote_draft",
            {"problem_type": problem_type, "job_summary": job_summary},
        )
        return dict(quote)

    def propose_slots(self) -> list[dict]:
        """Offer the customer three appointment slots to choose from.

        Returns three slot options for the next three business days. The
        customer will see these as buttons in the chat. Do NOT call this
        for emergencies (Jill handles those manually). Do NOT call this
        before the customer has accepted any pending quote.
        """
        slots = generate_demo_slots()
        booking = dict(self.working.get("booking") or cs.empty_booking())
        booking["slots_offered"] = [dict(s) for s in slots]
        booking["booking_status"] = "link_sent"
        booking["booking_method"] = "calendly"
        log = list(booking.get("ui_log", []))
        log.append("Would create Calendly link (slots offered to customer)")
        booking["ui_log"] = log
        self.working["booking"] = booking
        self._record("propose_slots", {})
        return [dict(s) for s in slots]

    def confirm_slot(self, slot_id: str) -> str:
        """Record the slot the customer chose.

        Call this when the customer picks one of the slots offered by
        ``propose_slots``. After calling, confirm the time back to the
        customer in plain language and close the conversation with
        ``close_conversation(sub_reason="booked")``.

        Args:
            slot_id: The slot_id of the chosen slot (e.g. "slot-2").
        """
        booking = dict(self.working.get("booking") or cs.empty_booking())
        offered = booking.get("slots_offered", []) or []
        match = next((dict(s) for s in offered if s.get("slot_id") == slot_id), None)
        if match is None:
            return f"unknown slot_id: {slot_id}"
        booking["selected_slot"] = match
        booking["booking_status"] = "booked"
        log = list(booking.get("ui_log", []))
        log.append(f"Would create Calendly event at {match.get('label', slot_id)}")
        booking["ui_log"] = log
        self.working["booking"] = booking
        self.working["status"] = "booked"
        self._record("confirm_slot", {"slot_id": slot_id})
        return "confirmed"

    def close_conversation(self, sub_reason: str) -> str:
        """End the conversation cleanly with a reason code.

        Call this on natural terminal states only:
        - "booked" after confirm_slot
        - "customer_declined" if the customer rejects a quote
        - "wrong_number", "out_of_area", "out_of_scope", "spam" if the
          customer is not a real plumbing lead

        Never call this for emergencies — Jill will close those manually.

        Args:
            sub_reason: One of: booked, customer_declined, wrong_number,
                out_of_area, out_of_scope, spam.
        """
        if sub_reason not in ALLOWED_SUB_REASONS:
            return f"invalid sub_reason: {sub_reason}"
        if sub_reason == "booked":
            self.working["status"] = "closed_done"
        else:
            self.working["status"] = "closed_no_action"
        self.working["sub_reason"] = sub_reason
        self._record("close_conversation", {"sub_reason": sub_reason})
        return "closed"

    def notify_jill(self, reason: str) -> str:
        """Alert Jill that an EMERGENCY needs her attention right now.

        Only call this when urgency in <state> is "emergency" (active
        damage, gas smell, sewage backup, etc.). Do NOT call for priority
        or scheduled work — the dashboard already surfaces those.

        Args:
            reason: One short sentence on why Jill is being alerted.
        """
        notifs = list(self.working.get("notifications", []))
        notifs.append(
            cs.Notification(type="would_sms_jill", reason=reason, at=_now_iso())
        )
        self.working["notifications"] = notifs
        self._record("notify_jill", {"reason": reason})
        return "noted"

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _record(self, name: str, arguments: dict) -> None:
        self.tool_calls.append(
            {"name": name, "arguments": arguments, "at": _now_iso()}
        )

    def as_tool_list(self) -> list:
        """Return the bound methods to register with the agent framework."""
        return [
            self.set_customer_info,
            self.generate_quote_draft,
            self.propose_slots,
            self.confirm_slot,
            self.close_conversation,
            self.notify_jill,
        ]
