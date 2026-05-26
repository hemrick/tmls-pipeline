"""Best-effort persistence of domain entities to flat CSV files on GCS.

One CSV file per entity, stored at {GCS_PREFIX}/{entity}.csv.  All writes use
a read-modify-write pattern (download → modify in memory → re-upload) which is
safe under the single-concurrent-access constraint (spec NFR-12).

Storage is intentionally non-fatal: if the bucket isn't configured or a write
fails, functions log a warning and return None / [] so the chat reply is
still delivered.

Config (env vars):
- GCS_BUCKET                      bucket name (no write happens if unset)
- GCS_PREFIX                      object key prefix (default "interactions")
- GOOGLE_APPLICATION_CREDENTIALS  path to service-account JSON key (local dev).
                                  On Cloud Run, omit — runtime SA used via ADC.
"""

import csv
import datetime
import io
import logging
import os
import uuid

from google.cloud import storage
from google.cloud.exceptions import NotFound

logger = logging.getLogger("pipeline.storage")

_client = None


def _get_client() -> storage.Client:
    global _client
    if _client is None:
        _client = storage.Client()
    return _client


def _get_bucket():
    """Return (bucket, bucket_name) or (None, None) when GCS_BUCKET is unset."""
    bucket_name = os.getenv("GCS_BUCKET")
    if not bucket_name:
        return None, None
    return _get_client().bucket(bucket_name), bucket_name


# ---------------------------------------------------------------------------
# Fieldname constants — one list per CSV entity
# ---------------------------------------------------------------------------

_FIELDNAMES_INTERACTIONS = [
    "id", "timestamp", "input", "output", "model",
    "input_tokens", "output_tokens", "total_tokens", "latency_ms",
]

_FIELDNAMES_SESSIONS = [
    "id", "channel", "urgency_detected", "status", "system_prompt",
    "model_used", "turn_count", "message_count", "total_prompt_tokens",
    "total_completion_tokens", "total_tokens", "total_cost_usd",
    "total_latency_ms", "started_at", "ended_at",
    "customer_name", "customer_phone", "customer_email", "problem_summary",
]

_FIELDNAMES_MESSAGES = [
    "id", "conversation_id", "role", "content",
    "has_images", "timestamp", "token_count",
]

_FIELDNAMES_QUOTES = [
    "id", "conversation_id", "version", "job_description", "scope",
    "cost_min", "cost_max", "status", "contractor_comment",
    "created_at", "reviewed_at",
]

_FIELDNAMES_BOOKINGS = [
    "id", "conversation_id", "calendly_event_uri", "calendly_event_uuid",
    "booked_slot_text", "start_time", "end_time", "status", "confirmed_at",
]

_FIELDNAMES_CALLBACKS = [
    "id", "conversation_id", "customer_name", "customer_phone",
    "triage_level", "service_intent", "status", "notes",
    "created_at", "updated_at",
]

_FIELDNAMES_TURN_LOGS = [
    "id", "conversation_log_id", "turn_number", "sub_agent",
    "routing_decision", "state_before", "state_after", "latency_ms", "timestamp",
]


# ---------------------------------------------------------------------------
# Private GCS / CSV helpers
# ---------------------------------------------------------------------------

def _csv_path(entity_name: str) -> str:
    prefix = os.getenv("GCS_PREFIX", "interactions").strip("/")
    return f"{prefix}/{entity_name}.csv"


def _read_csv(bucket, blob_path: str) -> list[dict]:
    """Download and parse a CSV blob. Returns [] if the blob does not exist."""
    blob = bucket.blob(blob_path)
    try:
        raw = blob.download_as_text(encoding="utf-8")
    except NotFound:
        return []
    reader = csv.DictReader(io.StringIO(raw))
    return list(reader)


def _write_csv(bucket, blob_path: str, fieldnames: list[str], rows: list[dict]) -> None:
    """Serialize rows to CSV (with header) and upload."""
    buf = io.StringIO()
    writer = csv.DictWriter(
        buf,
        fieldnames=fieldnames,
        quoting=csv.QUOTE_ALL,
        extrasaction="ignore",
        lineterminator="\n",
    )
    writer.writeheader()
    writer.writerows(rows)
    bucket.blob(blob_path).upload_from_string(
        buf.getvalue(),
        content_type="text/csv; charset=utf-8",
    )


def _append_row(bucket, blob_path: str, fieldnames: list[str], row: dict) -> None:
    rows = _read_csv(bucket, blob_path)
    rows.append(row)
    _write_csv(bucket, blob_path, fieldnames, rows)


def _upsert_row(bucket, blob_path: str, fieldnames: list[str], row: dict) -> None:
    """Insert row, or replace the existing row with matching id."""
    rows = _read_csv(bucket, blob_path)
    row_id = row.get("id")
    for i, existing in enumerate(rows):
        if existing.get("id") == row_id:
            rows[i] = row
            _write_csv(bucket, blob_path, fieldnames, rows)
            return
    rows.append(row)
    _write_csv(bucket, blob_path, fieldnames, rows)


def _update_row_by_id(
    bucket, blob_path: str, fieldnames: list[str], row_id: str, updates: dict
) -> dict | None:
    """Merge updates into the row matching row_id. Returns updated row or None."""
    rows = _read_csv(bucket, blob_path)
    updated = None
    for i, row in enumerate(rows):
        if row.get("id") == row_id:
            rows[i] = {**row, **updates}
            updated = rows[i]
            break
    if updated is None:
        return None
    _write_csv(bucket, blob_path, fieldnames, rows)
    return updated


# ---------------------------------------------------------------------------
# Interactions
# ---------------------------------------------------------------------------

def store_interaction(record: dict) -> str | None:
    """Append one chat interaction to interactions.csv. Returns gs:// path or None.

    Accepts the same record shape as before:
        {"timestamp": ..., "input": ..., "output": ..., "model": ...,
         "usage": {"input_tokens": ..., "output_tokens": ..., "total_tokens": ...},
         "latency_ms": ...}
    """
    bucket, bucket_name = _get_bucket()
    if bucket is None:
        logger.warning("GCS_BUCKET not set — skipping interaction storage")
        return None
    try:
        blob_path = _csv_path("interactions")
        usage = record.get("usage") or {}
        row = {
            "id": uuid.uuid4().hex,
            "timestamp": record.get("timestamp", ""),
            "input": record.get("input", ""),
            "output": record.get("output", ""),
            "model": record.get("model", ""),
            "input_tokens": usage.get("input_tokens", ""),
            "output_tokens": usage.get("output_tokens", ""),
            "total_tokens": usage.get("total_tokens", ""),
            "latency_ms": record.get("latency_ms", ""),
        }
        _append_row(bucket, blob_path, _FIELDNAMES_INTERACTIONS, row)
        return f"gs://{bucket_name}/{blob_path}"
    except Exception:
        logger.exception("Failed to store interaction in GCS")
        return None


# ---------------------------------------------------------------------------
# Sessions (ConversationLog)
# ---------------------------------------------------------------------------

def save_session(session: dict) -> str | None:
    """Upsert a session row in sessions.csv. Generates id if absent."""
    bucket, bucket_name = _get_bucket()
    if bucket is None:
        logger.warning("GCS_BUCKET not set — skipping session storage")
        return None
    try:
        if not session.get("id"):
            session = {**session, "id": uuid.uuid4().hex}
        blob_path = _csv_path("sessions")
        _upsert_row(bucket, blob_path, _FIELDNAMES_SESSIONS, session)
        return f"gs://{bucket_name}/{blob_path}"
    except Exception:
        logger.exception("Failed to save session in GCS")
        return None


def get_session(session_id: str) -> dict | None:
    """Return the session row for session_id, or None if not found."""
    bucket, _ = _get_bucket()
    if bucket is None:
        return None
    try:
        rows = _read_csv(bucket, _csv_path("sessions"))
        return next((r for r in rows if r.get("id") == session_id), None)
    except Exception:
        logger.exception("Failed to read session from GCS")
        return None


def list_sessions(
    status: str | None = None,
    urgency: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Return a filtered, paginated list of session rows."""
    bucket, _ = _get_bucket()
    if bucket is None:
        return []
    try:
        rows = _read_csv(bucket, _csv_path("sessions"))
        if status:
            rows = [r for r in rows if r.get("status") == status]
        if urgency:
            rows = [r for r in rows if r.get("urgency_detected") == urgency]
        return rows[offset: offset + limit]
    except Exception:
        logger.exception("Failed to list sessions from GCS")
        return []


def update_session(session_id: str, updates: dict) -> dict | None:
    """Merge updates into an existing session row."""
    bucket, _ = _get_bucket()
    if bucket is None:
        return None
    try:
        return _update_row_by_id(
            bucket, _csv_path("sessions"), _FIELDNAMES_SESSIONS, session_id, updates
        )
    except Exception:
        logger.exception("Failed to update session in GCS")
        return None


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

def save_message(message: dict) -> str | None:
    """Append a message row to messages.csv."""
    bucket, bucket_name = _get_bucket()
    if bucket is None:
        logger.warning("GCS_BUCKET not set — skipping message storage")
        return None
    try:
        if not message.get("id"):
            message = {**message, "id": uuid.uuid4().hex}
        blob_path = _csv_path("messages")
        _append_row(bucket, blob_path, _FIELDNAMES_MESSAGES, message)
        return f"gs://{bucket_name}/{blob_path}"
    except Exception:
        logger.exception("Failed to save message in GCS")
        return None


def list_messages(conversation_id: str) -> list[dict]:
    """Return all messages for a conversation in insertion order."""
    bucket, _ = _get_bucket()
    if bucket is None:
        return []
    try:
        rows = _read_csv(bucket, _csv_path("messages"))
        return [r for r in rows if r.get("conversation_id") == conversation_id]
    except Exception:
        logger.exception("Failed to list messages from GCS")
        return []


# ---------------------------------------------------------------------------
# Quotes
# ---------------------------------------------------------------------------

def save_quote(quote: dict) -> str | None:
    """Upsert a quote row in quotes.csv. Generates id if absent."""
    bucket, bucket_name = _get_bucket()
    if bucket is None:
        logger.warning("GCS_BUCKET not set — skipping quote storage")
        return None
    try:
        if not quote.get("id"):
            quote = {**quote, "id": uuid.uuid4().hex}
        blob_path = _csv_path("quotes")
        _upsert_row(bucket, blob_path, _FIELDNAMES_QUOTES, quote)
        return f"gs://{bucket_name}/{blob_path}"
    except Exception:
        logger.exception("Failed to save quote in GCS")
        return None


def get_quote(quote_id: str) -> dict | None:
    """Return the quote row for quote_id, or None if not found."""
    bucket, _ = _get_bucket()
    if bucket is None:
        return None
    try:
        rows = _read_csv(bucket, _csv_path("quotes"))
        return next((r for r in rows if r.get("id") == quote_id), None)
    except Exception:
        logger.exception("Failed to read quote from GCS")
        return None


def list_quotes_for_session(conversation_id: str) -> list[dict]:
    """Return all quote rows for a given conversation_id."""
    bucket, _ = _get_bucket()
    if bucket is None:
        return []
    try:
        rows = _read_csv(bucket, _csv_path("quotes"))
        return [r for r in rows if r.get("conversation_id") == conversation_id]
    except Exception:
        logger.exception("Failed to list quotes from GCS")
        return []


def update_quote(quote_id: str, updates: dict) -> dict | None:
    """Merge updates into an existing quote row."""
    bucket, _ = _get_bucket()
    if bucket is None:
        return None
    try:
        return _update_row_by_id(
            bucket, _csv_path("quotes"), _FIELDNAMES_QUOTES, quote_id, updates
        )
    except Exception:
        logger.exception("Failed to update quote in GCS")
        return None


# ---------------------------------------------------------------------------
# Bookings
# ---------------------------------------------------------------------------

def save_booking(booking: dict) -> str | None:
    """Upsert a booking row in bookings.csv. Generates id if absent."""
    bucket, bucket_name = _get_bucket()
    if bucket is None:
        logger.warning("GCS_BUCKET not set — skipping booking storage")
        return None
    try:
        if not booking.get("id"):
            booking = {**booking, "id": uuid.uuid4().hex}
        blob_path = _csv_path("bookings")
        _upsert_row(bucket, blob_path, _FIELDNAMES_BOOKINGS, booking)
        return f"gs://{bucket_name}/{blob_path}"
    except Exception:
        logger.exception("Failed to save booking in GCS")
        return None


def get_booking(booking_id: str) -> dict | None:
    """Return the booking row for booking_id, or None if not found."""
    bucket, _ = _get_bucket()
    if bucket is None:
        return None
    try:
        rows = _read_csv(bucket, _csv_path("bookings"))
        return next((r for r in rows if r.get("id") == booking_id), None)
    except Exception:
        logger.exception("Failed to read booking from GCS")
        return None


def get_booking_for_session(conversation_id: str) -> dict | None:
    """Return the first booking row for a conversation_id, or None."""
    bucket, _ = _get_bucket()
    if bucket is None:
        return None
    try:
        rows = _read_csv(bucket, _csv_path("bookings"))
        return next((r for r in rows if r.get("conversation_id") == conversation_id), None)
    except Exception:
        logger.exception("Failed to read booking for session from GCS")
        return None


def update_booking(booking_id: str, updates: dict) -> dict | None:
    """Merge updates into an existing booking row."""
    bucket, _ = _get_bucket()
    if bucket is None:
        return None
    try:
        return _update_row_by_id(
            bucket, _csv_path("bookings"), _FIELDNAMES_BOOKINGS, booking_id, updates
        )
    except Exception:
        logger.exception("Failed to update booking in GCS")
        return None


# ---------------------------------------------------------------------------
# Callbacks
# ---------------------------------------------------------------------------

def save_callback(callback: dict) -> str | None:
    """Upsert a callback row in callbacks.csv. Generates id if absent."""
    bucket, bucket_name = _get_bucket()
    if bucket is None:
        logger.warning("GCS_BUCKET not set — skipping callback storage")
        return None
    try:
        if not callback.get("id"):
            callback = {**callback, "id": uuid.uuid4().hex}
        blob_path = _csv_path("callbacks")
        _upsert_row(bucket, blob_path, _FIELDNAMES_CALLBACKS, callback)
        return f"gs://{bucket_name}/{blob_path}"
    except Exception:
        logger.exception("Failed to save callback in GCS")
        return None


def list_callbacks(status: str | None = None) -> list[dict]:
    """Return all callbacks, optionally filtered by status."""
    bucket, _ = _get_bucket()
    if bucket is None:
        return []
    try:
        rows = _read_csv(bucket, _csv_path("callbacks"))
        if status:
            rows = [r for r in rows if r.get("status") == status]
        return rows
    except Exception:
        logger.exception("Failed to list callbacks from GCS")
        return []


def update_callback(callback_id: str, updates: dict) -> dict | None:
    """Merge updates into an existing callback row."""
    bucket, _ = _get_bucket()
    if bucket is None:
        return None
    try:
        return _update_row_by_id(
            bucket, _csv_path("callbacks"), _FIELDNAMES_CALLBACKS, callback_id, updates
        )
    except Exception:
        logger.exception("Failed to update callback in GCS")
        return None


# ---------------------------------------------------------------------------
# Pipeline turn logs
# ---------------------------------------------------------------------------

def log_pipeline_turn(turn: dict) -> str | None:
    """Append a PipelineTurnLog row to pipeline_turn_logs.csv."""
    bucket, bucket_name = _get_bucket()
    if bucket is None:
        return None
    try:
        if not turn.get("id"):
            turn = {**turn, "id": uuid.uuid4().hex}
        blob_path = _csv_path("pipeline_turn_logs")
        _append_row(bucket, blob_path, _FIELDNAMES_TURN_LOGS, turn)
        return f"gs://{bucket_name}/{blob_path}"
    except Exception:
        logger.exception("Failed to log pipeline turn in GCS")
        return None
