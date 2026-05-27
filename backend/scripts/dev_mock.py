"""dev_mock.py — local development server with no external API calls.

Starts the real FastAPI app on http://localhost:8000 with:
- Local filesystem storage (no GCS credentials needed)
- `run_turn` replaced by a keyword-driven stub (no OpenAI calls)
- 7 pre-seeded conversations covering every mobile dashboard scenario

Usage (from the backend/ directory):
    python scripts/dev_mock.py

Then run the frontend:
    cd ../frontend && npm run dev
    open http://localhost:3000/target
"""

from __future__ import annotations

import datetime
import os
import sys

# ---------------------------------------------------------------------------
# 1. Set env vars BEFORE any app imports so load_dotenv() doesn't override them
# ---------------------------------------------------------------------------
os.environ.setdefault("OPENAI_API_KEY", "mock-key-not-used")
os.environ.pop("GCS_BUCKET", None)                       # force local storage
os.environ["LOCAL_STORAGE_DIR"] = str(
    (os.path.dirname(__file__) / ".." / "mock_data")  # type: ignore[operator]
    if False else
    os.path.join(os.path.dirname(__file__), "..", "mock_data")
)

# Ensure backend/ is on the path when running from scripts/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ---------------------------------------------------------------------------
# 2. Seed helpers
# ---------------------------------------------------------------------------
from app import conversation_store as cs  # noqa: E402 — must follow env setup


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _ago(minutes: int) -> str:
    dt = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=minutes)
    return dt.isoformat()


def _seed_conversation(
    conv_id: str,
    customer: cs.Customer,
    user_msg: str,
    agent_msg: str,
    snapshot: cs.TurnSnapshot,
    user_msg_2: str | None = None,
    agent_msg_2: str | None = None,
) -> cs.ConversationState:
    """Build and persist a conversation using only public cs.* functions."""
    state = cs.new_state(conv_id)
    state = cs.append_message(state, role="user", content=user_msg)
    state = cs.apply_turn(state, snapshot)
    state = cs.append_message(state, role="agent", content=agent_msg)
    if user_msg_2:
        state = cs.append_message(state, role="user", content=user_msg_2)
    if agent_msg_2:
        state = cs.append_message(state, role="agent", content=agent_msg_2)
    cs.save_state(state)
    cs.upsert_index(state)
    return state


def seed_all() -> None:
    """Seed mock_data with 7 scenario conversations (idempotent — skips existing)."""
    mock_dir = os.environ["LOCAL_STORAGE_DIR"]
    os.makedirs(mock_dir, exist_ok=True)

    tomorrow = (
        datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)
    ).replace(hour=14, minute=0, second=0, microsecond=0).isoformat()

    scenarios = [
        # ── Emergency 1: burst pipe ──────────────────────────────────────────
        dict(
            conv_id="demo-emergency-1",
            customer={"name": "Mira Patel", "phone": "647-555-0101"},
            user_msg="My kitchen pipe just burst — water is everywhere, flooding the floor!",
            agent_msg=(
                "This is an emergency. I'm alerting Jill right now and she'll call you "
                "back within minutes. In the meantime, shut off the main water valve if "
                "you can find it — usually under the sink or in the basement."
            ),
            snapshot=cs.TurnSnapshot(
                status="in_progress",
                urgency="emergency",
                customer={"name": "Mira Patel", "phone": "647-555-0101"},
                triage={"urgency_level": "emergency", "reason": "Active burst pipe with flooding reported"},
                quote=None,
                booking=cs.empty_booking(),
                sub_reason=None,
                notifications=[{"type": "would_sms_jill", "reason": "Emergency: burst pipe + active flooding", "at": _ago(2)}],
            ),
        ),
        # ── Emergency 2: sewage backup ───────────────────────────────────────
        dict(
            conv_id="demo-emergency-2",
            customer={"name": "James Okafor", "phone": "416-555-0202"},
            user_msg="There's sewage coming up through my basement floor drain.",
            agent_msg=(
                "A sewage backup is a health hazard and needs immediate attention. "
                "I'm flagging this for Jill right now — please avoid the affected area "
                "and don't run any water until she calls you."
            ),
            snapshot=cs.TurnSnapshot(
                status="in_progress",
                urgency="emergency",
                customer={"name": "James Okafor", "phone": "416-555-0202"},
                triage={"urgency_level": "emergency", "reason": "Sewage backup — health hazard, immediate dispatch needed"},
                quote=None,
                booking=cs.empty_booking(),
                sub_reason=None,
                notifications=[{"type": "would_sms_jill", "reason": "Emergency: sewage backup in basement", "at": _ago(15)}],
            ),
        ),
        # ── Quote pending 1: toilet replacement ─────────────────────────────
        dict(
            conv_id="demo-quote-1",
            customer={"name": "Priya Nair", "phone": "905-555-0303"},
            user_msg="My toilet is leaking at the base and rocking when I sit on it. Needs replacing I think.",
            agent_msg=(
                "Sounds like a failed wax ring and possibly a damaged flange. "
                "I've drafted a quote for Jill to review — she'll approve it and send "
                "it to you shortly."
            ),
            snapshot=cs.TurnSnapshot(
                status="quoted",
                urgency="priority",
                customer={"name": "Priya Nair", "phone": "905-555-0303"},
                triage={"urgency_level": "priority", "reason": "Active leak at toilet base, needs prompt repair"},
                quote={
                    "quote_status": "pending_jill_review",
                    "job_summary": "Replace toilet wax ring and inspect flange",
                    "scope": [
                        "Remove existing toilet",
                        "Replace wax ring and closet bolts",
                        "Inspect and reinforce toilet flange if needed",
                        "Reinstall toilet and test for leaks",
                    ],
                    "estimated_price_range": "$280 – $420",
                    "disclaimer": "Final price may vary if flange replacement is required.",
                    "requires_jill_approval": True,
                    "version": 1,
                    "history": [{"status": "pending_jill_review", "note": None, "actor": "agent"}],
                    "next_action": "Awaiting Jill approval",
                },
                booking=cs.empty_booking(),
                sub_reason=None,
                notifications=[],
            ),
        ),
        # ── Quote pending 2: water heater ────────────────────────────────────
        dict(
            conv_id="demo-quote-2",
            customer={"name": "David Chen", "phone": "647-555-0404"},
            user_msg="My water heater stopped working this morning. 12 years old, probably needs replacing.",
            agent_msg=(
                "A 12-year-old water heater that's no longer heating is very likely at "
                "end of life. I've put together a replacement quote for Jill to review."
            ),
            snapshot=cs.TurnSnapshot(
                status="quoted",
                urgency="scheduled",
                customer={"name": "David Chen", "phone": "647-555-0404"},
                triage={"urgency_level": "scheduled", "reason": "Water heater failure, no hot water"},
                quote={
                    "quote_status": "pending_jill_review",
                    "job_summary": "Replace 40-gallon natural gas water heater",
                    "scope": [
                        "Remove and dispose of old water heater",
                        "Supply and install new 40-gal gas water heater",
                        "Reconnect gas line and check for leaks",
                        "Test hot water and set thermostat",
                    ],
                    "estimated_price_range": "$1,200 – $1,600",
                    "disclaimer": "Includes standard installation. Extra if gas line upgrade is required.",
                    "requires_jill_approval": True,
                    "version": 1,
                    "history": [{"status": "pending_jill_review", "note": None, "actor": "agent"}],
                    "next_action": "Awaiting Jill approval",
                },
                booking=cs.empty_booking(),
                sub_reason=None,
                notifications=[],
            ),
        ),
        # ── Booked: faucet repair ────────────────────────────────────────────
        dict(
            conv_id="demo-booked-1",
            customer={"name": "Sarah Williams", "phone": "416-555-0505"},
            user_msg="My kitchen faucet is dripping constantly, even when fully off.",
            agent_msg="I can book Jill to come take a look and fix that for you. Does tomorrow at 2 PM work?",
            user_msg_2="Yes, tomorrow 2 PM works perfectly.",
            agent_msg_2="Great — you're booked for tomorrow 2:00–4:00 PM. Jill will call 30 min before.",
            snapshot=cs.TurnSnapshot(
                status="booked",
                urgency="scheduled",
                customer={"name": "Sarah Williams", "phone": "416-555-0505"},
                triage={"urgency_level": "scheduled", "reason": "Dripping faucet, no urgency"},
                quote=None,
                booking={
                    "booking_status": "booked",
                    "booking_method": "agent",
                    "slots_offered": [
                        {"slot_id": "slot-a", "label": "Tomorrow 2:00 PM – 4:00 PM", "iso_datetime": tomorrow},
                        {"slot_id": "slot-b", "label": "Thursday 10:00 AM – 12:00 PM", "iso_datetime": tomorrow},
                    ],
                    "selected_slot": {"slot_id": "slot-a", "label": "Tomorrow 2:00 PM – 4:00 PM", "iso_datetime": tomorrow},
                    "ui_log": ["Slots offered to customer", "Customer selected slot-a"],
                },
                sub_reason=None,
                notifications=[],
            ),
        ),
        # ── Closed done: resolved slow drain ────────────────────────────────
        dict(
            conv_id="demo-closed-1",
            customer={"name": "Tom Baker", "phone": "905-555-0606"},
            user_msg="Bathroom sink draining really slowly.",
            agent_msg=(
                "That's usually a hair clog. Jill can come clear it out. "
                "She visited and cleared the blockage — all set!"
            ),
            snapshot=cs.TurnSnapshot(
                status="closed_done",
                urgency="scheduled",
                customer={"name": "Tom Baker", "phone": "905-555-0606"},
                triage={"urgency_level": "scheduled", "reason": "Slow drain, likely hair clog"},
                quote=None,
                booking={
                    "booking_status": "booked",
                    "booking_method": "agent",
                    "slots_offered": [],
                    "selected_slot": {"slot_id": "slot-x", "label": "Yesterday 10:00 AM", "iso_datetime": _ago(24 * 60)},
                    "ui_log": ["Jill completed visit"],
                },
                sub_reason=None,
                notifications=[],
            ),
        ),
        # ── Callback (L0): gas smell safety referral ─────────────────────────
        dict(
            conv_id="demo-callback-1",
            customer={"name": "Emma Rodriguez", "phone": "416-555-0707"},
            user_msg="I can smell gas in my basement near the furnace.",
            agent_msg=(
                "A gas smell is potentially dangerous — please leave the building now "
                "and call Enbridge Emergency at 1-866-763-5427 or 911. "
                "Do not operate any switches or flames. This is outside what Jill's "
                "plumbing service covers but your safety comes first."
            ),
            snapshot=cs.TurnSnapshot(
                status="closed_no_action",
                urgency="priority",
                customer={"name": "Emma Rodriguez", "phone": "416-555-0707"},
                triage={"urgency_level": "priority", "reason": "Possible gas leak — out of scope, safety referral issued"},
                quote=None,
                booking=cs.empty_booking(),
                sub_reason="out_of_scope",
                notifications=[{"type": "safety_referral", "reason": "Gas smell — customer referred to Enbridge Emergency line", "at": _ago(30)}],
            ),
        ),
    ]

    for s in scenarios:
        if cs.load_state(s["conv_id"]) is None:
            _seed_conversation(**s)
            print(f"  ✓ seeded {s['conv_id']}")
        else:
            print(f"  · {s['conv_id']} already exists, skipping")


# ---------------------------------------------------------------------------
# 3. Mock run_turn — keyword-driven, no OpenAI
# ---------------------------------------------------------------------------

async def mock_run_turn(conv_id: str | None, message: str):
    """Drop-in replacement for app.agent.run_turn with no external calls."""
    msg_lower = message.lower()

    # Load existing or create new state
    cid = conv_id or f"mock-{datetime.datetime.now(datetime.timezone.utc).strftime('%H%M%S')}"
    existing = cs.load_state(cid)
    state = existing if existing is not None else cs.new_state(cid)
    state = cs.append_message(state, role="user", content=message)

    if any(w in msg_lower for w in ("flood", "burst", "gush", "overflow")):
        snapshot = cs.TurnSnapshot(
            status="in_progress", urgency="emergency",
            customer=state["last_turn"].get("customer", {}),
            triage={"urgency_level": "emergency", "reason": "Active flooding or burst pipe reported"},
            quote=None, booking=cs.empty_booking(), sub_reason=None,
            notifications=[{"type": "would_sms_jill", "reason": f"Emergency: {message[:80]}", "at": _now()}],
        )
        reply = (
            "This sounds like a plumbing emergency. I've alerted Jill and she'll call you "
            "within 10 minutes. Shut off your main water valve if you can."
        )
    elif any(w in msg_lower for w in ("gas", "carbon monoxide", "co detector", "smell gas")):
        snapshot = cs.TurnSnapshot(
            status="closed_no_action", urgency="priority",
            customer=state["last_turn"].get("customer", {}),
            triage={"urgency_level": "priority", "reason": "Possible gas leak — out of scope"},
            quote=None, booking=cs.empty_booking(), sub_reason="out_of_scope",
            notifications=[{"type": "safety_referral", "reason": "Gas smell — referred to utility emergency line", "at": _now()}],
        )
        reply = (
            "A gas smell is potentially dangerous — leave the building now and call "
            "Enbridge Emergency at 1-866-763-5427 or 911. This is outside Pipe Dreams "
            "By Jill's scope but your safety is the priority."
        )
    elif any(w in msg_lower for w in ("drip", "slow drain", "clog", "pressure", "quote", "replace", "broken")):
        snapshot = cs.TurnSnapshot(
            status="quoted", urgency="priority",
            customer=state["last_turn"].get("customer", {}),
            triage={"urgency_level": "priority", "reason": "Plumbing issue requiring prompt attention"},
            quote={
                "quote_status": "pending_jill_review",
                "job_summary": f"Assessment and repair: {message[:60]}",
                "scope": ["Diagnose root cause", "Perform repair", "Test and confirm fix"],
                "estimated_price_range": "$180 – $320",
                "disclaimer": "Final price confirmed on-site.",
                "requires_jill_approval": True,
                "version": 1,
                "history": [{"status": "pending_jill_review", "note": None, "actor": "agent"}],
                "next_action": "Awaiting Jill approval",
            },
            booking=cs.empty_booking(), sub_reason=None, notifications=[],
        )
        reply = (
            "Thanks for the details. I've drafted a quote for Jill to review — "
            "she'll approve it and send it to you shortly."
        )
    else:
        snapshot = cs.TurnSnapshot(
            status="in_progress", urgency="scheduled",
            customer=state["last_turn"].get("customer", {}),
            triage={"urgency_level": "scheduled", "reason": "Routine plumbing inquiry"},
            quote=None, booking=cs.empty_booking(), sub_reason=None, notifications=[],
        )
        reply = (
            "Thanks for reaching out to Pipe Dreams By Jill! Can you tell me a bit more "
            "about the issue? For example, where is it located and how long has it been happening?"
        )

    state = cs.apply_turn(state, snapshot)
    state = cs.append_message(state, role="agent", content=reply)
    cs.save_state(state)
    cs.upsert_index(state)
    return state, reply


# ---------------------------------------------------------------------------
# 4. Patch + launch
# ---------------------------------------------------------------------------

def main() -> None:
    print("\n🔧  Pipeline · Mock Dev Server")
    print("=" * 52)
    print(f"  Storage : {os.environ['LOCAL_STORAGE_DIR']}")
    print("  OpenAI  : STUBBED (no calls made)")
    print("  GCS     : DISABLED (local filesystem)")
    print()
    print("Seeding conversations…")
    seed_all()
    print()
    print("Seeded scenarios:")
    print("  demo-emergency-1  · Burst pipe, flooding kitchen         [emergency / in_progress]")
    print("  demo-emergency-2  · Sewage backup in basement            [emergency / in_progress]")
    print("  demo-quote-1      · Toilet replacement — PENDING REVIEW  [priority  / quoted     ]")
    print("  demo-quote-2      · Water heater — PENDING REVIEW        [scheduled / quoted     ]")
    print("  demo-booked-1     · Faucet repair, confirmed booking      [scheduled / booked     ]")
    print("  demo-closed-1     · Resolved slow drain                  [scheduled / closed_done]")
    print("  demo-callback-1   · Gas smell safety referral (L0)       [priority  / closed_no_action]")
    print()
    print("Patching run_turn…")

    import app.main as app_main  # noqa: E402
    app_main.run_turn = mock_run_turn  # type: ignore[attr-defined]
    print("  ✓ app.main.run_turn → mock_run_turn")
    print()
    print("Starting server on http://localhost:8000")
    print("─" * 52)
    print("  Frontend: cd ../frontend && npm run dev")
    print("  Mobile  : http://localhost:3000/target")
    print("─" * 52 + "\n")

    import uvicorn
    uvicorn.run(app_main.app, host="0.0.0.0", port=8000, log_level="info")


if __name__ == "__main__":
    main()
