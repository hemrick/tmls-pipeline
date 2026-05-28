"""Frontend contract tests.

Validates every API endpoint the mobile dashboard (/target) calls, using a
pre-seeded set of 7 scenario conversations that mirror the dev_mock.py seed
data.  All tests run with:

  - Local filesystem storage (GCS_BUCKET unset)
  - `run_turn` patched so /api/chat never touches OpenAI

Run:
    cd backend
    uv run pytest tests/test_frontend_contract.py -v
"""

from __future__ import annotations

import datetime
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app import conversation_store as cs


# ---------------------------------------------------------------------------
# Helpers (mirror dev_mock.py seed logic)
# ---------------------------------------------------------------------------

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


def _seed_all() -> None:
    tomorrow = (
        datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)
    ).replace(hour=14, minute=0, second=0, microsecond=0).isoformat()

    # demo-emergency-1
    _seed_conversation(
        conv_id="demo-emergency-1",
        customer={"name": "Mira Patel", "phone": "647-555-0101"},
        user_msg="My kitchen pipe just burst — water is everywhere, flooding the floor!",
        agent_msg=(
            "This is an emergency. I'm alerting Jill right now. "
            "Shut off your main water valve immediately."
        ),
        snapshot=cs.TurnSnapshot(
            status="in_progress",
            urgency="emergency",
            customer={"name": "Mira Patel", "phone": "647-555-0101"},
            triage={"urgency_level": "emergency", "reason": "Active burst pipe with flooding"},
            quote=None,
            booking=cs.empty_booking(),
            sub_reason=None,
            notifications=[{"type": "would_sms_jill", "reason": "Emergency: burst pipe", "at": _ago(2)}],
        ),
    )

    # demo-emergency-2
    _seed_conversation(
        conv_id="demo-emergency-2",
        customer={"name": "James Okafor", "phone": "416-555-0202"},
        user_msg="There's sewage coming up through my basement floor drain.",
        agent_msg="A sewage backup is a health hazard. I'm flagging this for Jill immediately.",
        snapshot=cs.TurnSnapshot(
            status="in_progress",
            urgency="emergency",
            customer={"name": "James Okafor", "phone": "416-555-0202"},
            triage={"urgency_level": "emergency", "reason": "Sewage backup — health hazard"},
            quote=None,
            booking=cs.empty_booking(),
            sub_reason=None,
            notifications=[{"type": "would_sms_jill", "reason": "Emergency: sewage backup", "at": _ago(15)}],
        ),
    )

    # demo-quote-1
    _seed_conversation(
        conv_id="demo-quote-1",
        customer={"name": "Priya Nair", "phone": "905-555-0303"},
        user_msg="My toilet is leaking at the base and rocking when I sit on it.",
        agent_msg="I've drafted a quote for Jill to review — she'll send it to you shortly.",
        snapshot=cs.TurnSnapshot(
            status="quoted",
            urgency="priority",
            customer={"name": "Priya Nair", "phone": "905-555-0303"},
            triage={"urgency_level": "priority", "reason": "Active leak at toilet base"},
            quote={
                "quote_status": "pending_jill_review",
                "job_summary": "Replace toilet wax ring and inspect flange",
                "scope": ["Remove toilet", "Replace wax ring", "Reinstall and test"],
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
    )

    # demo-quote-2
    _seed_conversation(
        conv_id="demo-quote-2",
        customer={"name": "David Chen", "phone": "647-555-0404"},
        user_msg="My water heater stopped working this morning. 12 years old, probably needs replacing.",
        agent_msg="I've put together a replacement quote for Jill to review.",
        snapshot=cs.TurnSnapshot(
            status="quoted",
            urgency="scheduled",
            customer={"name": "David Chen", "phone": "647-555-0404"},
            triage={"urgency_level": "scheduled", "reason": "Water heater failure"},
            quote={
                "quote_status": "pending_jill_review",
                "job_summary": "Replace 40-gallon natural gas water heater",
                "scope": ["Remove old unit", "Install new 40-gal heater", "Test"],
                "estimated_price_range": "$1,200 – $1,600",
                "disclaimer": "Extra if gas line upgrade required.",
                "requires_jill_approval": True,
                "version": 1,
                "history": [{"status": "pending_jill_review", "note": None, "actor": "agent"}],
                "next_action": "Awaiting Jill approval",
            },
            booking=cs.empty_booking(),
            sub_reason=None,
            notifications=[],
        ),
    )

    # demo-booked-1
    _seed_conversation(
        conv_id="demo-booked-1",
        customer={"name": "Sarah Williams", "phone": "416-555-0505"},
        user_msg="My kitchen faucet is dripping constantly, even when fully off.",
        agent_msg="Does tomorrow at 2 PM work?",
        user_msg_2="Yes, tomorrow 2 PM works perfectly.",
        agent_msg_2="Great — you're booked for tomorrow 2:00–4:00 PM.",
        snapshot=cs.TurnSnapshot(
            status="booked",
            urgency="scheduled",
            customer={"name": "Sarah Williams", "phone": "416-555-0505"},
            triage={"urgency_level": "scheduled", "reason": "Dripping faucet"},
            quote=None,
            booking={
                "booking_status": "booked",
                "booking_method": "agent",
                "slots_offered": [
                    {"slot_id": "slot-a", "label": "Tomorrow 2:00–4:00 PM", "iso_datetime": tomorrow},
                ],
                "selected_slot": {"slot_id": "slot-a", "label": "Tomorrow 2:00–4:00 PM", "iso_datetime": tomorrow},
                "ui_log": ["Slots offered", "Customer selected slot-a"],
            },
            sub_reason=None,
            notifications=[],
        ),
    )

    # demo-closed-1
    _seed_conversation(
        conv_id="demo-closed-1",
        customer={"name": "Tom Baker", "phone": "905-555-0606"},
        user_msg="Bathroom sink draining really slowly.",
        agent_msg="Jill visited and cleared the blockage — all set!",
        snapshot=cs.TurnSnapshot(
            status="closed_done",
            urgency="scheduled",
            customer={"name": "Tom Baker", "phone": "905-555-0606"},
            triage={"urgency_level": "scheduled", "reason": "Slow drain, likely hair clog"},
            quote=None,
            booking=cs.empty_booking(),
            sub_reason=None,
            notifications=[],
        ),
    )

    # demo-callback-1
    _seed_conversation(
        conv_id="demo-callback-1",
        customer={"name": "Emma Rodriguez", "phone": "416-555-0707"},
        user_msg="I can smell gas in my basement near the furnace.",
        agent_msg=(
            "Leave the building now and call Enbridge Emergency at 1-866-763-5427. "
            "This is outside Jill's scope but your safety comes first."
        ),
        snapshot=cs.TurnSnapshot(
            status="closed_no_action",
            urgency="priority",
            customer={"name": "Emma Rodriguez", "phone": "416-555-0707"},
            triage={"urgency_level": "priority", "reason": "Possible gas leak — out of scope"},
            quote=None,
            booking=cs.empty_booking(),
            sub_reason="out_of_scope",
            notifications=[{"type": "safety_referral", "reason": "Gas smell — referred to utility emergency line", "at": _ago(30)}],
        ),
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def seeded_client(tmp_path, monkeypatch):
    """TestClient with all 7 scenario conversations pre-seeded."""
    monkeypatch.delenv("GCS_BUCKET", raising=False)
    monkeypatch.setenv("LOCAL_STORAGE_DIR", str(tmp_path))
    _seed_all()
    from app.main import app
    return TestClient(app)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def test_health(seeded_client):
    r = seeded_client.get("/")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# GET /api/conversations — list
# ---------------------------------------------------------------------------

def test_list_conversations(seeded_client):
    r = seeded_client.get("/api/conversations")
    assert r.status_code == 200
    body = r.json()
    assert "conversations" in body
    assert len(body["conversations"]) == 7
    # Every row must expose urgency and status
    for row in body["conversations"]:
        assert "urgency" in row
        assert "status" in row
        assert "conversation_id" in row


def test_emergency_in_list(seeded_client):
    r = seeded_client.get("/api/conversations")
    rows = r.json()["conversations"]
    emergency_rows = [row for row in rows if row["urgency"] == "emergency"]
    assert len(emergency_rows) >= 2, (
        f"Expected ≥2 emergency rows, got {len(emergency_rows)}"
    )


def test_quoted_in_list(seeded_client):
    r = seeded_client.get("/api/conversations")
    rows = r.json()["conversations"]
    quoted_rows = [row for row in rows if row["status"] == "quoted"]
    assert len(quoted_rows) >= 2, (
        f"Expected ≥2 quoted rows, got {len(quoted_rows)}"
    )


# ---------------------------------------------------------------------------
# GET /api/conversations/{id} — full state
# ---------------------------------------------------------------------------

def test_get_conversation_full_state(seeded_client):
    r = seeded_client.get("/api/conversations/demo-emergency-1")
    assert r.status_code == 200
    body = r.json()

    # Core shape
    assert body["conversation_id"] == "demo-emergency-1"
    assert "messages" in body
    assert len(body["messages"]) >= 2

    # last_turn must have triage and customer
    lt = body["last_turn"]
    assert "triage" in lt
    assert lt["triage"] is not None
    assert "customer" in lt
    assert lt["customer"]["name"] == "Mira Patel"


def test_get_conversation_with_quote(seeded_client):
    r = seeded_client.get("/api/conversations/demo-quote-1")
    assert r.status_code == 200
    lt = r.json()["last_turn"]
    assert lt["quote"] is not None
    assert lt["quote"]["quote_status"] == "pending_jill_review"


def test_get_conversation_with_booking(seeded_client):
    r = seeded_client.get("/api/conversations/demo-booked-1")
    assert r.status_code == 200
    lt = r.json()["last_turn"]
    assert lt["booking"]["booking_status"] == "booked"
    assert lt["booking"]["selected_slot"] is not None
    assert lt["booking"]["selected_slot"]["slot_id"] == "slot-a"


# ---------------------------------------------------------------------------
# POST /api/chat — new and existing conversations
# ---------------------------------------------------------------------------

async def _fake_run_turn(conv_id, message):
    cid = conv_id or "test-new-conv"
    existing = cs.load_state(cid)
    state = existing if existing is not None else cs.new_state(cid)
    state = cs.append_message(state, role="user", content=message)
    snapshot = cs.TurnSnapshot(
        status="in_progress",
        urgency="scheduled",
        customer={"name": "Test Customer"},
        triage={"urgency_level": "scheduled", "reason": "Test inquiry"},
        quote=None,
        booking=cs.empty_booking(),
        sub_reason=None,
        notifications=[],
    )
    state = cs.apply_turn(state, snapshot)
    state = cs.append_message(state, role="agent", content="Thanks, we'll look into that.")
    cs.save_state(state)
    cs.upsert_index(state)
    return state, "Thanks, we'll look into that."


def test_post_chat_new_conversation(seeded_client):
    with patch("app.main.run_turn", side_effect=_fake_run_turn):
        r = seeded_client.post("/api/chat", json={"message": "I need a plumber"})
    assert r.status_code == 200
    body = r.json()
    assert "conversation_id" in body
    assert "reply" in body
    assert "last_turn" in body
    assert body["reply"] == "Thanks, we'll look into that."
    assert body["last_turn"]["urgency"] == "scheduled"


def test_post_chat_existing_conversation(seeded_client):
    with patch("app.main.run_turn", side_effect=_fake_run_turn):
        r = seeded_client.post(
            "/api/chat",
            json={"conversation_id": "demo-emergency-1", "message": "Still flooding!"},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["conversation_id"] == "demo-emergency-1"
    assert "reply" in body

    # Confirm message was appended — state should have more messages now
    state = cs.load_state("demo-emergency-1")
    assert state is not None
    # Original 2 messages + new user + new agent = at least 4
    assert len(state["messages"]) >= 4


# ---------------------------------------------------------------------------
# POST /api/conversations/{id}/quote/decision
# ---------------------------------------------------------------------------

def test_quote_approve(seeded_client):
    r = seeded_client.post(
        "/api/conversations/demo-quote-1/quote/decision",
        json={"decision": "approve"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["quote"]["quote_status"] == "sent_to_customer"

    # Persisted
    state = cs.load_state("demo-quote-1")
    assert state["last_turn"]["quote"]["quote_status"] == "sent_to_customer"


def test_quote_reject(seeded_client):
    r = seeded_client.post(
        "/api/conversations/demo-quote-2/quote/decision",
        json={"decision": "reject", "note": "Too expensive for this job."},
    )
    assert r.status_code == 200
    assert r.json()["quote"]["quote_status"] == "rejected"


# ---------------------------------------------------------------------------
# POST /api/conversations/{id}/close
# ---------------------------------------------------------------------------

def test_close_conversation(seeded_client):
    r = seeded_client.post(
        "/api/conversations/demo-booked-1/close",
        json={"sub_reason": "jill_manual"},
    )
    assert r.status_code == 200

    state = cs.load_state("demo-booked-1")
    assert state["last_turn"]["status"] == "closed_no_action"
    assert state["last_turn"]["sub_reason"] == "jill_manual"


# ---------------------------------------------------------------------------
# POST /api/conversations/{id}/rename
# ---------------------------------------------------------------------------

def test_rename_conversation(seeded_client):
    r = seeded_client.post(
        "/api/conversations/demo-emergency-1/rename",
        json={"display_label": "Mira P."},
    )
    assert r.status_code == 200
    assert r.json()["display_label"] == "Mira P."

    # Persisted in state
    state = cs.load_state("demo-emergency-1")
    assert state["display_label"] == "Mira P."

    # Persisted in index
    index = cs.load_index()
    entry = next(
        (e for e in index["conversations"] if e["conversation_id"] == "demo-emergency-1"),
        None,
    )
    assert entry is not None
    assert entry["display_label"] == "Mira P."


# ---------------------------------------------------------------------------
# 404 for unknown conversation
# ---------------------------------------------------------------------------

def test_404_unknown_conversation(seeded_client):
    r = seeded_client.get("/api/conversations/nonexistent-conv-id")
    assert r.status_code == 404
