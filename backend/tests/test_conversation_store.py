"""Tests for the per-conversation storage layer.

Covers the pure mutation helpers and a round-trip through the local
filesystem backend (GCS path is exercised in deploy).
"""

from __future__ import annotations

import pytest

from app import conversation_store as cs


# ---------------------------------------------------------------------------
# Pure mutation helpers
# ---------------------------------------------------------------------------


def test_new_state_has_zero_turn_and_empty_history():
    state = cs.new_state("conv-1")
    assert state["conversation_id"] == "conv-1"
    assert state["last_turn"]["turn_number"] == 0
    assert state["last_turn"]["status"] == "new"
    assert state["last_turn"]["urgency"] is None
    assert state["turn_history"] == []
    assert state["messages"] == []
    assert state.get("display_label") is None


def test_apply_turn_appends_previous_and_bumps_number():
    state = cs.new_state("conv-2")
    working = cs.TurnSnapshot(
        status="in_progress",
        urgency="priority",
        customer={"name": "Mike", "phone": "555", "email": "m@x.com"},
        triage={"urgency_level": "priority"},
        quote=None,
        booking=cs.empty_booking(),
        sub_reason=None,
        notifications=[],
    )

    new_state = cs.apply_turn(state, working)

    assert new_state["last_turn"]["turn_number"] == 1
    assert new_state["last_turn"]["status"] == "in_progress"
    assert new_state["last_turn"]["customer"]["name"] == "Mike"
    assert len(new_state["turn_history"]) == 1
    assert new_state["turn_history"][0]["turn_number"] == 0


def test_apply_turn_is_pure_does_not_mutate_input():
    state = cs.new_state("conv-3")
    working = cs.TurnSnapshot(
        status="in_progress",
        urgency="scheduled",
        customer={},
        triage=None,
        quote=None,
        booking=cs.empty_booking(),
        sub_reason=None,
        notifications=[],
    )
    cs.apply_turn(state, working)
    # Original untouched.
    assert state["last_turn"]["turn_number"] == 0
    assert state["turn_history"] == []


def test_apply_turn_chain_three_turns():
    state = cs.new_state("conv-4")
    for status in ("in_progress", "quoted", "booked"):
        working = cs.TurnSnapshot(
            status=status,  # type: ignore[arg-type]
            urgency="priority",
            customer={},
            triage=None,
            quote=None,
            booking=cs.empty_booking(),
            sub_reason=None,
            notifications=[],
        )
        state = cs.apply_turn(state, working)

    assert state["last_turn"]["turn_number"] == 3
    assert state["last_turn"]["status"] == "booked"
    assert [t["status"] for t in state["turn_history"]] == [
        "new",
        "in_progress",
        "quoted",
    ]


def test_append_message_records_role_and_content():
    state = cs.new_state("conv-5")
    state = cs.append_message(state, role="user", content="Hello")
    state = cs.append_message(state, role="agent", content="Hi! I'm Jill's AI assistant.")
    assert len(state["messages"]) == 2
    assert state["messages"][0]["role"] == "user"
    assert state["messages"][1]["content"].startswith("Hi!")


def test_index_entry_projects_display_label_when_set():
    state = cs.new_state("conv-label")
    state = cs.append_message(state, role="user", content="hi")
    state["display_label"] = "Maple St. faucet"
    entry = cs.to_index_entry(state)
    assert entry.get("display_label") == "Maple St. faucet"


def test_apply_turn_preserves_display_label():
    state = cs.new_state("conv-pres")
    state["display_label"] = "Mike — boiler"
    promoted = cs.apply_turn(
        state,
        cs.TurnSnapshot(
            status="in_progress",
            urgency="priority",
            customer={},
            triage=None,
            quote=None,
            booking=cs.empty_booking(),
            sub_reason=None,
            notifications=[],
        ),
    )
    assert promoted.get("display_label") == "Mike — boiler"


def test_index_entry_uses_last_user_message_as_summary():
    state = cs.new_state("conv-6")
    state = cs.append_message(state, role="user", content="Water everywhere in the basement!")
    state = cs.append_message(state, role="agent", content="Got it — Jill alerted.")
    # Promote a real turn so urgency/status appear in the entry.
    working = cs.TurnSnapshot(
        status="in_progress",
        urgency="emergency",
        customer={"name": "Sarah"},
        triage=None,
        quote=None,
        booking=cs.empty_booking(),
        sub_reason=None,
        notifications=[],
    )
    state = cs.apply_turn(state, working)

    entry = cs.to_index_entry(state)
    assert entry["conversation_id"] == "conv-6"
    assert entry["customer_name"] == "Sarah"
    assert entry["urgency"] == "emergency"
    assert entry["status"] == "in_progress"
    assert "basement" in entry["summary"]


# ---------------------------------------------------------------------------
# Local filesystem round trip
# ---------------------------------------------------------------------------


@pytest.fixture
def local_storage(tmp_path, monkeypatch):
    """Force the local-filesystem backend at ``tmp_path``."""
    monkeypatch.delenv("GCS_BUCKET", raising=False)
    monkeypatch.setenv("LOCAL_STORAGE_DIR", str(tmp_path))
    yield tmp_path


def test_state_roundtrip(local_storage):
    state = cs.new_state("conv-rt")
    state = cs.append_message(state, role="user", content="Hi")
    cs.save_state(state)

    reloaded = cs.load_state("conv-rt")
    assert reloaded is not None
    assert reloaded["conversation_id"] == "conv-rt"
    assert reloaded["messages"][0]["content"] == "Hi"


def test_load_state_returns_none_for_missing(local_storage):
    assert cs.load_state("does-not-exist") is None


def test_llm_log_append(local_storage):
    cs.append_llm_call(
        "conv-log",
        cs.LLMCall(
            turn_number=1,
            purpose="triage",
            model="gpt-4.1-nano",
            input_messages=[{"role": "user", "content": "hi"}],
            output="priority",
            function_calls=[],
            usage={"input_tokens": 10, "output_tokens": 5, "total_tokens": 15},
            latency_ms=200,
            timestamp=cs._now(),
        ),
        agent_thread="<serialized-blob-1>",
    )
    cs.append_llm_call(
        "conv-log",
        cs.LLMCall(
            turn_number=1,
            purpose="conversation",
            model="gpt-4o-mini",
            input_messages=[],
            output="Hi there!",
            function_calls=[],
            usage={"input_tokens": 50, "output_tokens": 10, "total_tokens": 60},
            latency_ms=800,
            timestamp=cs._now(),
        ),
    )

    log = cs.load_llm_log("conv-log")
    assert len(log["calls"]) == 2
    assert log["calls"][0]["purpose"] == "triage"
    assert log["calls"][1]["purpose"] == "conversation"
    # agent_thread is preserved across appends that don't pass a new one.
    assert log["agent_thread"] == "<serialized-blob-1>"


def test_upsert_index_inserts_and_updates(local_storage):
    state = cs.new_state("conv-i1")
    state = cs.append_message(state, role="user", content="Need a quote for a faucet")
    cs.upsert_index(state)

    index = cs.load_index()
    assert len(index["conversations"]) == 1
    assert index["conversations"][0]["conversation_id"] == "conv-i1"

    # Second upsert with same id should replace, not duplicate.
    promoted = cs.apply_turn(
        state,
        cs.TurnSnapshot(
            status="quoted",
            urgency="scheduled",
            customer={"name": "Aisha"},
            triage=None,
            quote=None,
            booking=cs.empty_booking(),
            sub_reason=None,
            notifications=[],
        ),
    )
    cs.upsert_index(promoted)

    index = cs.load_index()
    assert len(index["conversations"]) == 1
    assert index["conversations"][0]["status"] == "quoted"
    assert index["conversations"][0]["customer_name"] == "Aisha"


def test_rebuild_index_walks_all_conversations(local_storage):
    for cid in ("a", "b", "c"):
        s = cs.new_state(cid)
        s = cs.append_message(s, role="user", content=f"msg-{cid}")
        cs.save_state(s)

    index = cs.rebuild_index()
    ids = sorted(r["conversation_id"] for r in index["conversations"])
    assert ids == ["a", "b", "c"]
