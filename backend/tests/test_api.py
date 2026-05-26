"""Integration tests for the V1 FastAPI surface.

LLM-dependent paths (POST /api/chat) are exercised by patching the agent
loop so tests stay fast and don't hit OpenAI.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app import conversation_store as cs


@pytest.fixture
def local_storage(tmp_path, monkeypatch):
    monkeypatch.delenv("GCS_BUCKET", raising=False)
    monkeypatch.setenv("LOCAL_STORAGE_DIR", str(tmp_path))
    yield tmp_path


@pytest.fixture
def client(local_storage):
    from app.main import app

    return TestClient(app)


def test_health(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_list_empty(client):
    r = client.get("/api/conversations")
    assert r.status_code == 200
    body = r.json()
    assert body["conversations"] == []


def test_get_missing_conversation_404(client):
    r = client.get("/api/conversations/does-not-exist")
    assert r.status_code == 404


def test_post_chat_creates_conversation(client, local_storage):
    async def fake_run_turn(conv_id, message):
        cid = conv_id or "fake-conv-1"
        state = cs.new_state(cid)
        state = cs.append_message(state, role="user", content=message)
        promoted = cs.apply_turn(
            state,
            cs.TurnSnapshot(
                status="in_progress",
                urgency="priority",
                customer={},
                triage={"urgency_level": "priority"},
                quote=None,
                booking=cs.empty_booking(),
                sub_reason=None,
                notifications=[],
            ),
        )
        promoted = cs.append_message(promoted, role="agent", content="hi back")
        cs.save_state(promoted)
        cs.upsert_index(promoted)
        return promoted, "hi back"

    with patch("app.main.run_turn", side_effect=fake_run_turn):
        r = client.post("/api/chat", json={"message": "hello"})
    assert r.status_code == 200
    body = r.json()
    assert body["conversation_id"] == "fake-conv-1"
    assert body["reply"] == "hi back"
    assert body["last_turn"]["urgency"] == "priority"


def test_get_conversation_after_chat(client, local_storage):
    async def fake_run_turn(conv_id, message):
        cid = conv_id or "fake-conv-2"
        state = cs.new_state(cid)
        state = cs.append_message(state, role="user", content=message)
        promoted = cs.apply_turn(
            state,
            cs.TurnSnapshot(
                status="in_progress",
                urgency="emergency",
                customer={"name": "Sarah"},
                triage={"urgency_level": "emergency"},
                quote=None,
                booking=cs.empty_booking(),
                sub_reason=None,
                notifications=[
                    {"type": "would_sms_jill", "reason": "Flooding", "at": "now"}
                ],
            ),
        )
        promoted = cs.append_message(promoted, role="agent", content="Safety guidance.")
        cs.save_state(promoted)
        cs.upsert_index(promoted)
        return promoted, "Safety guidance."

    with patch("app.main.run_turn", side_effect=fake_run_turn):
        client.post("/api/chat", json={"message": "basement flooding"})

    r = client.get("/api/conversations")
    assert r.status_code == 200
    rows = r.json()["conversations"]
    assert len(rows) == 1
    assert rows[0]["urgency"] == "emergency"

    cid = rows[0]["conversation_id"]
    r = client.get(f"/api/conversations/{cid}")
    assert r.status_code == 200
    state = r.json()
    assert state["conversation_id"] == cid
    assert len(state["messages"]) == 2
    assert state["last_turn"]["customer"]["name"] == "Sarah"


def test_log_endpoint_returns_calls_or_empty(client, local_storage):
    state = cs.new_state("log-conv")
    cs.save_state(state)
    cs.upsert_index(state)

    r = client.get("/api/conversations/log-conv/log")
    assert r.status_code == 200
    body = r.json()
    assert body["conversation_id"] == "log-conv"
    assert body["calls"] == []


def test_post_chat_validation_rejects_empty_message(client):
    r = client.post("/api/chat", json={"message": ""})
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Jill actions
# ---------------------------------------------------------------------------


def _seed_with_quote(conv_id: str = "q1"):
    from app.services import quotes as q

    state = cs.new_state(conv_id)
    state = cs.append_message(state, role="user", content="My hot water tank stopped working.")
    state = cs.append_message(state, role="agent", content="Got it.")
    quote = q.generate_quote_draft(
        job_summary="Hot water tank not producing heat.",
        problem_type="hot_water_tank",
    )
    promoted = cs.apply_turn(
        state,
        cs.TurnSnapshot(
            status="quoted",
            urgency="priority",
            customer={"name": "Mike"},
            triage={"urgency_level": "priority"},
            quote=dict(quote),
            booking=cs.empty_booking(),
            sub_reason=None,
            notifications=[],
        ),
    )
    cs.save_state(promoted)
    cs.upsert_index(promoted)
    return promoted


def test_quote_decision_approve(client, local_storage):
    state = _seed_with_quote()
    r = client.post(
        f"/api/conversations/{state['conversation_id']}/quote/decision",
        json={"decision": "approve"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["quote"]["quote_status"] == "sent_to_customer"

    # Persisted.
    reloaded = cs.load_state(state["conversation_id"])
    assert reloaded["last_turn"]["quote"]["quote_status"] == "sent_to_customer"


def test_quote_decision_reject(client, local_storage):
    state = _seed_with_quote("q2")
    r = client.post(
        f"/api/conversations/{state['conversation_id']}/quote/decision",
        json={"decision": "reject", "note": "Too expensive for this job."},
    )
    assert r.status_code == 200
    assert r.json()["quote"]["quote_status"] == "rejected"


def test_quote_decision_invalid_decision_422(client, local_storage):
    state = _seed_with_quote("q3")
    r = client.post(
        f"/api/conversations/{state['conversation_id']}/quote/decision",
        json={"decision": "maybe"},
    )
    assert r.status_code == 422


def test_quote_decision_no_quote_400(client, local_storage):
    state = cs.new_state("no-quote")
    cs.save_state(state)
    r = client.post(
        "/api/conversations/no-quote/quote/decision",
        json={"decision": "approve"},
    )
    assert r.status_code == 400


def test_close_conversation(client, local_storage):
    state = _seed_with_quote("c1")
    r = client.post(
        f"/api/conversations/{state['conversation_id']}/close",
        json={"sub_reason": "jill_manual"},
    )
    assert r.status_code == 200
    reloaded = cs.load_state(state["conversation_id"])
    assert reloaded["last_turn"]["status"] == "closed_no_action"
    assert reloaded["last_turn"]["sub_reason"] == "jill_manual"


def test_close_conversation_invalid_reason_422(client, local_storage):
    state = _seed_with_quote("c2")
    r = client.post(
        f"/api/conversations/{state['conversation_id']}/close",
        json={"sub_reason": "vibes"},
    )
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Rename
# ---------------------------------------------------------------------------


def test_rename_sets_display_label(client, local_storage):
    state = cs.new_state("rn1")
    state = cs.append_message(state, role="user", content="Need a faucet looked at")
    cs.save_state(state)
    cs.upsert_index(state)

    r = client.post(
        "/api/conversations/rn1/rename", json={"display_label": "Maple St. faucet"}
    )
    assert r.status_code == 200
    assert r.json()["display_label"] == "Maple St. faucet"

    reloaded = cs.load_state("rn1")
    assert reloaded["display_label"] == "Maple St. faucet"

    index = cs.load_index()
    entry = next(e for e in index["conversations"] if e["conversation_id"] == "rn1")
    assert entry["display_label"] == "Maple St. faucet"


def test_rename_empty_string_clears_label(client, local_storage):
    state = cs.new_state("rn2")
    state["display_label"] = "to be cleared"
    cs.save_state(state)
    cs.upsert_index(state)

    r = client.post("/api/conversations/rn2/rename", json={"display_label": "   "})
    assert r.status_code == 200
    assert r.json()["display_label"] is None

    reloaded = cs.load_state("rn2")
    assert reloaded.get("display_label") is None


def test_rename_missing_conversation_404(client):
    r = client.post(
        "/api/conversations/no-such-conv/rename",
        json={"display_label": "anything"},
    )
    assert r.status_code == 404


def test_rename_non_string_label_422(client, local_storage):
    state = cs.new_state("rn3")
    cs.save_state(state)
    r = client.post("/api/conversations/rn3/rename", json={"display_label": 42})
    assert r.status_code == 422
