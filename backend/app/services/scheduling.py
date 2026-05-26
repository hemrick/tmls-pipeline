"""E10 - Calendly scheduling logic.

Calendly is the booking mechanism. There is **no Jill approval step** for
appointment times -- the link goes straight to the customer; Jill sees the
confirmed booking on the dashboard after the fact (via the Calendly
webhook).

Behaviour by urgency level:

- ``emergency``: do NOT send a Calendly link. Alert Jill, show safety
  guidance, leave the booking in ``not_started`` with
  ``booking_method = "manual_emergency"``.
- ``priority``: send the Calendly link after intake. Ask the customer to
  pick the *earliest* available slot.
- ``scheduled``: send the Calendly link after scoping. Ask the customer
  to pick any time that works.

Booking lifecycle states:

``not_started`` -> ``link_sent`` -> ``booked`` | ``cancelled`` | ``manual_follow_up``
"""

from __future__ import annotations

import os
from typing import Literal, Optional, TypedDict

BookingStatus = Literal[
    "not_started",
    "link_sent",
    "booked",
    "cancelled",
    "manual_follow_up",
]

BookingMethod = Literal["calendly", "manual_emergency"]

UrgencyContext = Literal["emergency", "priority", "scheduled"]


# Demo fallback used when CALENDLY_SCHEDULING_URL is not set. Safe to
# commit -- it points at the hackathon demo account, not a real customer
# calendar.
DEMO_CALENDLY_URL = "https://calendly.com/pipe-dreams-by-jill/consultation"


class SchedulingResponse(TypedDict):
    booking_status: BookingStatus
    booking_method: BookingMethod
    scheduling_url: Optional[str]
    instructions_to_customer: Optional[str]
    requires_jill_time_approval: bool
    urgency_context: UrgencyContext
    notify_jill: bool


def get_scheduling_url() -> str:
    """Return the active Calendly scheduling URL, falling back to the demo
    URL when ``CALENDLY_SCHEDULING_URL`` is not set."""
    return os.environ.get("CALENDLY_SCHEDULING_URL") or DEMO_CALENDLY_URL


def get_event_type_uri() -> Optional[str]:
    """Return the optional Calendly event-type URI, or ``None`` if not
    configured. Reserved for future use (event-type-specific APIs)."""
    return os.environ.get("CALENDLY_EVENT_TYPE_URI") or None


def build_calendly_response(
    urgency_level: UrgencyContext,
    *,
    context: Optional[str] = None,
) -> SchedulingResponse:
    """Build the scheduling response for a given urgency level.

    ``context`` is an optional free-form string (e.g. ``"after_quote"``)
    that can tweak the wording. The structural fields stay the same.

    Always returns ``requires_jill_time_approval = False`` so the frontend
    cannot accidentally render a Jill approval UI for time slots.
    """
    if urgency_level not in ("emergency", "priority", "scheduled"):
        raise ValueError(
            f"urgency_level must be 'emergency', 'priority', or 'scheduled' "
            f"(got {urgency_level!r})"
        )

    if urgency_level == "emergency":
        return SchedulingResponse(
            booking_status="not_started",
            booking_method="manual_emergency",
            scheduling_url=None,
            instructions_to_customer=None,
            requires_jill_time_approval=False,
            urgency_context="emergency",
            notify_jill=True,
        )

    url = get_scheduling_url()

    if urgency_level == "priority":
        instructions = (
            "Please choose the earliest available time that works for you."
        )
        if context == "after_quote":
            instructions = (
                "Pick the earliest available time that works -- this is "
                "the time we'll come out to do the work in the approved quote."
            )
        return SchedulingResponse(
            booking_status="link_sent",
            booking_method="calendly",
            scheduling_url=url,
            instructions_to_customer=instructions,
            requires_jill_time_approval=False,
            urgency_context="priority",
            notify_jill=True,
        )

    # scheduled
    instructions = "Pick any time that works for you."
    if context == "after_quote":
        instructions = (
            "Pick any time that works -- this is the time we'll come out "
            "to do the work in the approved quote."
        )
    return SchedulingResponse(
        booking_status="link_sent",
        booking_method="calendly",
        scheduling_url=url,
        instructions_to_customer=instructions,
        requires_jill_time_approval=False,
        urgency_context="scheduled",
        notify_jill=True,
    )


# ---------------------------------------------------------------------------
# Booking lifecycle helpers
# ---------------------------------------------------------------------------
#
# The helpers below take the previously-returned response (or any dict
# with the same shape) and produce a new dict with the booking status
# updated. They never mutate the input.


_VALID_TRANSITIONS: dict[BookingStatus, set[BookingStatus]] = {
    "not_started": {"link_sent", "manual_follow_up"},
    "link_sent": {"booked", "cancelled", "manual_follow_up", "link_sent"},
    "booked": {"cancelled"},
    "cancelled": {"link_sent", "manual_follow_up"},
    "manual_follow_up": {"link_sent", "booked"},
}


def _transition(
    booking_state: dict,
    *,
    new_status: BookingStatus,
) -> dict:
    current = booking_state.get("booking_status", "not_started")
    allowed = _VALID_TRANSITIONS.get(current, set())
    if new_status not in allowed and new_status != current:
        raise ValueError(
            f"Invalid booking transition: {current!r} -> {new_status!r}"
        )
    return {**booking_state, "booking_status": new_status}


def mark_booked(booking_state: dict) -> dict:
    """Flip a booking state to ``booked``. Intended to be called from the
    Calendly ``invitee.created`` webhook handler."""
    return _transition(booking_state, new_status="booked")


def mark_cancelled(booking_state: dict) -> dict:
    """Flip a booking state to ``cancelled``. Intended to be called from
    the Calendly ``invitee.canceled`` webhook handler."""
    return _transition(booking_state, new_status="cancelled")


def mark_manual_follow_up(booking_state: dict) -> dict:
    """Flag a booking for manual follow-up by Jill (customer ghosted or
    can't self-serve)."""
    return _transition(booking_state, new_status="manual_follow_up")
