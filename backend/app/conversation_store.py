"""Per-conversation persistence layer.

Each conversation has two files:

    conversations/{id}/state.json     business state (what UI reads)
    conversations/{id}/llm_log.json   every LLM call + serialized AgentThread

Plus a single global index file:

    index.json                        lightweight list for the dashboard

Storage backend is chosen at runtime:

- If ``GCS_BUCKET`` is set, all I/O goes to Google Cloud Storage.
- Otherwise files are written to ``LOCAL_STORAGE_DIR`` (default ``./local_storage``).

This lets the team iterate without GCS credentials. The shape is identical
in both modes, so flipping the env var at deploy time is enough.
"""

from __future__ import annotations

import datetime
import json
import logging
import os
import uuid
from pathlib import Path
from typing import Any, Literal, Optional, TypedDict

logger = logging.getLogger("pipeline.store")

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

UrgencyLevel = Literal["emergency", "priority", "scheduled"]

ConversationStatus = Literal[
    "new",
    "in_progress",
    "quoted",
    "booked",
    "closed_no_action",
    "closed_done",
]

SubReason = Literal[
    "booked",
    "customer_declined",
    "wrong_number",
    "out_of_area",
    "out_of_scope",
    "spam",
    "jill_manual",
]


class Customer(TypedDict, total=False):
    name: Optional[str]
    phone: Optional[str]
    email: Optional[str]


class SlotOffer(TypedDict):
    slot_id: str
    label: str
    iso_datetime: str


class Booking(TypedDict, total=False):
    booking_status: str
    booking_method: Optional[str]
    slots_offered: list[SlotOffer]
    selected_slot: Optional[SlotOffer]
    ui_log: list[str]


class Notification(TypedDict):
    type: str
    reason: str
    at: str


class Message(TypedDict):
    role: Literal["user", "agent"]
    content: str
    timestamp: str


class TurnSnapshot(TypedDict, total=False):
    turn_number: int
    status: ConversationStatus
    urgency: Optional[UrgencyLevel]
    customer: Customer
    triage: Optional[dict]
    quote: Optional[dict]
    booking: Booking
    sub_reason: Optional[SubReason]
    notifications: list[Notification]
    updated_at: str


class ConversationState(TypedDict, total=False):
    conversation_id: str
    created_at: str
    updated_at: str
    messages: list[Message]
    last_turn: TurnSnapshot
    turn_history: list[TurnSnapshot]
    display_label: Optional[str]


class LLMCall(TypedDict, total=False):
    turn_number: int
    purpose: Literal["triage", "conversation"]
    model: str
    input_messages: list[dict]
    output: str
    function_calls: list[dict]
    usage: dict
    latency_ms: int
    timestamp: str


class LLMLog(TypedDict, total=False):
    conversation_id: str
    calls: list[LLMCall]
    agent_thread: Optional[str]


class IndexEntry(TypedDict, total=False):
    conversation_id: str
    customer_name: Optional[str]
    display_label: Optional[str]
    summary: str
    urgency: Optional[UrgencyLevel]
    status: ConversationStatus
    quote_status: Optional[str]
    sub_reason: Optional[SubReason]
    updated_at: str


class Index(TypedDict):
    updated_at: str
    conversations: list[IndexEntry]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def new_conversation_id() -> str:
    return str(uuid.uuid4())


def empty_booking() -> Booking:
    return Booking(
        booking_status="not_started",
        booking_method=None,
        slots_offered=[],
        selected_slot=None,
        ui_log=[],
    )


def new_state(conversation_id: str) -> ConversationState:
    """Initial state for a freshly-created conversation."""
    ts = _now()
    initial_turn: TurnSnapshot = TurnSnapshot(
        turn_number=0,
        status="new",
        urgency=None,
        customer=Customer(),
        triage=None,
        quote=None,
        booking=empty_booking(),
        sub_reason=None,
        notifications=[],
        updated_at=ts,
    )
    return ConversationState(
        conversation_id=conversation_id,
        created_at=ts,
        updated_at=ts,
        messages=[],
        last_turn=initial_turn,
        turn_history=[],
        display_label=None,
    )


def apply_turn(state: ConversationState, working_turn: TurnSnapshot) -> ConversationState:
    """Promote ``working_turn`` to be the new ``last_turn``.

    The previous ``last_turn`` is appended to ``turn_history``.
    ``turn_number`` is bumped. ``updated_at`` stamps the snapshot and the
    top-level state.
    """
    ts = _now()
    previous = state["last_turn"]
    new_history = list(state["turn_history"]) + [previous]

    promoted = dict(working_turn)
    promoted["turn_number"] = int(previous.get("turn_number", 0)) + 1
    promoted["updated_at"] = ts

    return ConversationState(
        conversation_id=state["conversation_id"],
        created_at=state["created_at"],
        updated_at=ts,
        messages=list(state["messages"]),
        last_turn=promoted,  # type: ignore[typeddict-item]
        turn_history=new_history,
        display_label=state.get("display_label"),
    )


def append_message(
    state: ConversationState,
    *,
    role: Literal["user", "agent"],
    content: str,
) -> ConversationState:
    """Add a user or agent message to the transcript. Pure."""
    ts = _now()
    new_messages = list(state["messages"]) + [
        Message(role=role, content=content, timestamp=ts)
    ]
    return ConversationState(
        conversation_id=state["conversation_id"],
        created_at=state["created_at"],
        updated_at=ts,
        messages=new_messages,
        last_turn=state["last_turn"],
        turn_history=list(state["turn_history"]),
        display_label=state.get("display_label"),
    )


def to_index_entry(state: ConversationState) -> IndexEntry:
    """Project a conversation into a list-view row for the dashboard."""
    lt = state["last_turn"]
    customer = lt.get("customer", {}) or {}
    last_user_msg = next(
        (m["content"] for m in reversed(state["messages"]) if m["role"] == "user"),
        "",
    )
    summary = last_user_msg[:80]
    quote = lt.get("quote") or {}
    return IndexEntry(
        conversation_id=state["conversation_id"],
        customer_name=customer.get("name"),
        display_label=state.get("display_label"),
        summary=summary,
        urgency=lt.get("urgency"),
        status=lt.get("status", "new"),
        quote_status=quote.get("quote_status") if quote else None,
        sub_reason=lt.get("sub_reason"),
        updated_at=state["updated_at"],
    )


# ---------------------------------------------------------------------------
# Backend selection
# ---------------------------------------------------------------------------


def _bucket_name() -> Optional[str]:
    return os.getenv("GCS_BUCKET") or None


def _local_root() -> Path:
    return Path(os.getenv("LOCAL_STORAGE_DIR", "./local_storage")).resolve()


def _use_gcs() -> bool:
    return _bucket_name() is not None


# GCS client is created lazily so we don't pay the cost in local mode.
_gcs_client = None


def _gcs():
    global _gcs_client
    if _gcs_client is None:
        from google.cloud import storage  # local import keeps local mode fast

        _gcs_client = storage.Client()
    return _gcs_client


def _read_json(key: str) -> Optional[dict]:
    """Read one JSON object by key (relative path). Returns None if missing."""
    if _use_gcs():
        blob = _gcs().bucket(_bucket_name()).blob(key)
        if not blob.exists(_gcs()):
            return None
        return json.loads(blob.download_as_text())
    path = _local_root() / key
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(key: str, payload: dict) -> None:
    """Write one JSON object by key (full overwrite)."""
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    if _use_gcs():
        blob = _gcs().bucket(_bucket_name()).blob(key)
        blob.upload_from_string(body, content_type="application/json")
        return
    path = _local_root() / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")


def _list_prefixes(prefix: str) -> list[str]:
    """Return immediate child names under ``prefix`` (e.g. conversation IDs)."""
    if _use_gcs():
        client = _gcs()
        prefix = prefix.rstrip("/") + "/"
        # Bucket list with delimiter returns "prefixes" (subdirectories).
        iterator = client.list_blobs(
            _bucket_name(), prefix=prefix, delimiter="/"
        )
        # Consume so `.prefixes` is populated.
        list(iterator)
        return [p.removeprefix(prefix).rstrip("/") for p in iterator.prefixes]
    root = _local_root() / prefix
    if not root.exists():
        return []
    return [p.name for p in root.iterdir() if p.is_dir()]


# ---------------------------------------------------------------------------
# State I/O
# ---------------------------------------------------------------------------


def _state_key(conv_id: str) -> str:
    return f"conversations/{conv_id}/state.json"


def _log_key(conv_id: str) -> str:
    return f"conversations/{conv_id}/llm_log.json"


def _index_key() -> str:
    return "index.json"


def load_state(conv_id: str) -> Optional[ConversationState]:
    raw = _read_json(_state_key(conv_id))
    return raw  # type: ignore[return-value]


def save_state(state: ConversationState) -> None:
    _write_json(_state_key(state["conversation_id"]), dict(state))


def load_llm_log(conv_id: str) -> LLMLog:
    raw = _read_json(_log_key(conv_id))
    if raw is None:
        return LLMLog(conversation_id=conv_id, calls=[], agent_thread=None)
    return raw  # type: ignore[return-value]


def save_llm_log(log: LLMLog) -> None:
    _write_json(_log_key(log["conversation_id"]), dict(log))


def append_llm_call(conv_id: str, call: LLMCall, *, agent_thread: Optional[str] = None) -> None:
    """Append one LLM call record to the log. Optionally update the
    serialized AgentThread blob in the same write."""
    log = load_llm_log(conv_id)
    calls = list(log.get("calls", [])) + [dict(call)]
    new_log = LLMLog(
        conversation_id=conv_id,
        calls=calls,
        agent_thread=agent_thread if agent_thread is not None else log.get("agent_thread"),
    )
    save_llm_log(new_log)


def load_index() -> Index:
    raw = _read_json(_index_key())
    if raw is None:
        return Index(updated_at=_now(), conversations=[])
    return raw  # type: ignore[return-value]


def upsert_index(state: ConversationState) -> None:
    """Insert or update the index row for a conversation."""
    index = load_index()
    entry = to_index_entry(state)
    rows = [
        row for row in index["conversations"]
        if row.get("conversation_id") != state["conversation_id"]
    ]
    rows.append(entry)
    save_index(Index(updated_at=_now(), conversations=rows))


def save_index(index: Index) -> None:
    _write_json(_index_key(), dict(index))


def rebuild_index() -> Index:
    """Walk all conversations and rebuild the index from scratch.

    Useful for repair, not on the hot path.
    """
    rows: list[IndexEntry] = []
    for conv_id in _list_prefixes("conversations"):
        state = load_state(conv_id)
        if state is None:
            continue
        rows.append(to_index_entry(state))
    index = Index(updated_at=_now(), conversations=rows)
    save_index(index)
    return index
