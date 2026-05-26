"""Pipeline API.

V1 endpoints:

- POST /api/chat                       sessioned chat (creates a conversation if no id)
- GET  /api/conversations              dashboard list (lightweight index)
- GET  /api/conversations/{id}         full conversation state
- GET  /api/conversations/{id}/log     LLM call log (debug)
- POST /api/conversations/{id}/quote/decision   Jill approves/revises/rejects
- POST /api/conversations/{id}/close            Jill manual close

Jill endpoints land in task #8 of the build order; this file ships the
customer-facing surface first.

Plus the legacy /api/hello kept while the frontend is still on V0.
"""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app import conversation_store as cs
from app.agent import run_turn
from app.services import quotes as quotes_service
from app.voice import handle_voice_ws

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pipeline.api")

app = FastAPI(title="Pipeline API")

# CORS — comma-separated list of allowed origins; "*" by default.
_allowed = os.environ.get("ALLOWED_ORIGINS", "*")
_origins = [o.strip() for o in _allowed.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_credentials="*" not in _origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health + legacy
# ---------------------------------------------------------------------------


@app.get("/")
def health() -> dict:
    """Health check — Cloud Run pings this to confirm the container is up."""
    return {"status": "ok"}


@app.get("/api/hello")
def hello() -> dict:
    return {"message": "Hello from FastAPI"}


# ---------------------------------------------------------------------------
# /api/chat
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    conversation_id: str | None = None
    message: str = Field(min_length=1)


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
    last_turn: dict


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    """Send one customer message; receive the assistant reply + new state.

    If ``conversation_id`` is omitted a new conversation is created and its
    id is returned in the response.
    """
    try:
        state, reply = await run_turn(req.conversation_id, req.message)
    except Exception as exc:
        logger.exception("run_turn failed")
        raise HTTPException(status_code=500, detail=f"Agent error: {exc}") from exc

    return ChatResponse(
        conversation_id=state["conversation_id"],
        reply=reply,
        last_turn=dict(state["last_turn"]),
    )


# ---------------------------------------------------------------------------
# Read-only views (dashboard + customer polling)
# ---------------------------------------------------------------------------


@app.get("/api/conversations")
def list_conversations() -> dict:
    """Dashboard list. Lightweight: the index file only.

    Sorting is the frontend's job (emergencies first, then by updated_at).
    """
    return dict(cs.load_index())


@app.get("/api/conversations/{conv_id}")
def get_conversation(conv_id: str) -> dict:
    """Full conversation state — transcript, last_turn, turn_history."""
    state = cs.load_state(conv_id)
    if state is None:
        raise HTTPException(status_code=404, detail="conversation not found")
    return dict(state)


@app.get("/api/conversations/{conv_id}/log")
def get_conversation_log(conv_id: str) -> dict:
    """Full LLM call log for a conversation. Debug surface."""
    state = cs.load_state(conv_id)
    if state is None:
        raise HTTPException(status_code=404, detail="conversation not found")
    return dict(cs.load_llm_log(conv_id))


# ---------------------------------------------------------------------------
# /api/voice — full-duplex voice via OpenAI Realtime
# ---------------------------------------------------------------------------


@app.websocket("/api/voice/{conversation_id}")
async def voice_socket(websocket: WebSocket, conversation_id: str) -> None:
    """Bridge browser ↔ OpenAI Realtime for one conversation.

    Pass ``conversation_id="new"`` to start a fresh conversation; the
    assigned id comes back as the first JSON frame.
    """
    await handle_voice_ws(websocket, conversation_id)


# ---------------------------------------------------------------------------
# Jill actions
# ---------------------------------------------------------------------------


class QuoteDecisionRequest(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")
    note: str | None = None


@app.post("/api/conversations/{conv_id}/quote/decision")
def quote_decision(conv_id: str, req: QuoteDecisionRequest) -> dict:
    """Jill approves or rejects a pending quote.

    Revisions are not supported in V1 — Jill approves or rejects only.
    """
    state = cs.load_state(conv_id)
    if state is None:
        raise HTTPException(status_code=404, detail="conversation not found")

    quote = state["last_turn"].get("quote")
    if not quote:
        raise HTTPException(status_code=400, detail="no quote drafted yet")
    if quote.get("quote_status") != "pending_jill_review":
        raise HTTPException(
            status_code=400,
            detail=f"quote is not pending review (status={quote.get('quote_status')})",
        )

    try:
        new_quote = quotes_service.apply_jill_decision(
            quote, decision=req.decision, note=req.note  # type: ignore[arg-type]
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Patch last_turn in place — this is a Jill side-channel write, not a
    # full agent turn, so we don't bump turn_number.
    new_last_turn = dict(state["last_turn"])
    new_last_turn["quote"] = dict(new_quote)
    new_last_turn["updated_at"] = cs._now()
    new_state = cs.ConversationState(
        conversation_id=state["conversation_id"],
        created_at=state["created_at"],
        updated_at=cs._now(),
        messages=list(state["messages"]),
        last_turn=new_last_turn,  # type: ignore[typeddict-item]
        turn_history=list(state["turn_history"]),
        display_label=state.get("display_label"),
    )
    cs.save_state(new_state)
    cs.upsert_index(new_state)

    logger.info(
        "quote_decision conv=%s decision=%s new_status=%s",
        conv_id,
        req.decision,
        new_quote.get("quote_status"),
    )
    return {"quote": dict(new_quote)}


class RenameRequest(BaseModel):
    display_label: str | None = None


@app.post("/api/conversations/{conv_id}/rename")
def rename_conversation(conv_id: str, req: RenameRequest) -> dict:
    """Set or clear Jill's display label for a conversation.

    Empty (or whitespace-only) input clears the override, restoring the
    agent-captured customer name as the dashboard label.
    """
    state = cs.load_state(conv_id)
    if state is None:
        raise HTTPException(status_code=404, detail="conversation not found")

    cleaned = (req.display_label or "").strip()
    new_label = cleaned or None

    new_state = cs.ConversationState(
        conversation_id=state["conversation_id"],
        created_at=state["created_at"],
        updated_at=cs._now(),
        messages=list(state["messages"]),
        last_turn=state["last_turn"],
        turn_history=list(state["turn_history"]),
        display_label=new_label,
    )
    cs.save_state(new_state)
    cs.upsert_index(new_state)

    logger.info("rename conv=%s label=%r", conv_id, new_label)
    return {"display_label": new_label}


class CloseRequest(BaseModel):
    sub_reason: str = Field(
        pattern="^(jill_manual|wrong_number|out_of_area|out_of_scope|spam|customer_declined)$"
    )


@app.post("/api/conversations/{conv_id}/close")
def close_conversation(conv_id: str, req: CloseRequest) -> dict:
    """Jill's manual close button. Sets status=closed_no_action + sub_reason."""
    state = cs.load_state(conv_id)
    if state is None:
        raise HTTPException(status_code=404, detail="conversation not found")

    new_last_turn = dict(state["last_turn"])
    new_last_turn["status"] = "closed_no_action"
    new_last_turn["sub_reason"] = req.sub_reason
    new_last_turn["updated_at"] = cs._now()
    new_state = cs.ConversationState(
        conversation_id=state["conversation_id"],
        created_at=state["created_at"],
        updated_at=cs._now(),
        messages=list(state["messages"]),
        last_turn=new_last_turn,  # type: ignore[typeddict-item]
        turn_history=list(state["turn_history"]),
        display_label=state.get("display_label"),
    )
    cs.save_state(new_state)
    cs.upsert_index(new_state)

    logger.info("close conv=%s sub_reason=%s", conv_id, req.sub_reason)
    return {"status": "closed_no_action", "sub_reason": req.sub_reason}
