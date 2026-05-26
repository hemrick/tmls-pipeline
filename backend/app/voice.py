"""Voice intake via the OpenAI Realtime API.

Bridges a frontend WebSocket (mic in / speaker out + text events) to an
OpenAI Realtime session. Mirrors the responsibilities of
``app.agent.run_turn`` but for a streamed, full-duplex voice loop:

- The Realtime session holds the conversation thread on OpenAI's side.
- We hold the canonical business state (``state.json``) on disk; on each
  completed response we promote the working ``last_turn`` via
  ``conversation_store.apply_turn`` exactly like the text flow does.
- Tool calls fired by the model are executed server-side against a
  ``TurnContext`` (same six tools as the text flow) and the result is
  fed back into the Realtime session as ``function_call_output``.

Frontend protocol (JSON unless noted):

    Client → Server
      • binary frames        PCM16 mono 24 kHz mic audio
      • {type:"interrupt"}   (reserved; barge-in is out of scope V1)

    Server → Client
      • binary frames                   PCM16 mono 24 kHz agent audio
      • {type:"conversation_started",   first message; carries id
         conversation_id}
      • {type:"session_ready"}          OpenAI session configured
      • {type:"user_transcript_done",   final transcript of one user
         text}                          utterance
      • {type:"agent_text_delta",       token-by-token agent reply
         text}
      • {type:"agent_text_done",        end of agent reply
         text}
      • {type:"state_update",           latest persisted last_turn
         last_turn}
      • {type:"tool_call",              observability — tool executed
         name, arguments, result}       this turn
      • {type:"error", message}
"""

from __future__ import annotations

import asyncio
import base64
import datetime
import json
import logging
import os
import time
from typing import Any, Callable, Optional

from fastapi import WebSocket, WebSocketDisconnect
from openai import AsyncOpenAI

from app import agent_tools, conversation_store as cs, system_prompts

logger = logging.getLogger("pipeline.voice")


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime-mini")
REALTIME_VOICE = os.getenv("OPENAI_REALTIME_VOICE", "verse")


# ---------------------------------------------------------------------------
# Tool schemas — must match agent_tools.TurnContext method signatures
# ---------------------------------------------------------------------------


TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "name": "set_customer_info",
        "description": (
            "Save the customer's name, phone, or email as soon as they share "
            "any of them. May be called multiple times as more details land."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Customer name."},
                "phone": {"type": "string", "description": "Phone number, any format."},
                "email": {"type": "string", "description": "Email address."},
            },
        },
    },
    {
        "type": "function",
        "name": "generate_quote_draft",
        "description": (
            "Draft a price quote for the customer's job, pending Jill's review. "
            "Only call once both scoping questions for the matching problem_type "
            "have been answered."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "problem_type": {
                    "type": "string",
                    "enum": list(agent_tools.ALLOWED_PROBLEM_TYPES),
                    "description": "Problem template key.",
                },
                "job_summary": {
                    "type": "string",
                    "description": "One short sentence describing the job for Jill.",
                },
            },
            "required": ["problem_type", "job_summary"],
        },
    },
    {
        "type": "function",
        "name": "propose_slots",
        "description": (
            "Offer the customer three appointment slots. Only call after a "
            "quote has been accepted (priority flow) or once scope is clear "
            "(scheduled flow). Never for emergencies."
        ),
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "type": "function",
        "name": "confirm_slot",
        "description": "Record the slot_id the customer picked from propose_slots.",
        "parameters": {
            "type": "object",
            "properties": {
                "slot_id": {"type": "string", "description": "e.g. 'slot-2'."},
            },
            "required": ["slot_id"],
        },
    },
    {
        "type": "function",
        "name": "close_conversation",
        "description": (
            "Close the conversation cleanly on natural terminal states. "
            "Never call for emergencies — Jill closes those manually."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "sub_reason": {
                    "type": "string",
                    "enum": list(agent_tools.ALLOWED_SUB_REASONS),
                },
            },
            "required": ["sub_reason"],
        },
    },
    {
        "type": "function",
        "name": "notify_jill",
        "description": (
            "Alert Jill of an emergency that needs her attention. Only call "
            "when urgency is 'emergency'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {"type": "string"},
            },
            "required": ["reason"],
        },
    },
]


TOOL_NAMES = {schema["name"] for schema in TOOL_SCHEMAS}


# ---------------------------------------------------------------------------
# Lazy OpenAI client
# ---------------------------------------------------------------------------

_openai_client: Optional[AsyncOpenAI] = None


def _openai() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI()
    return _openai_client


# ---------------------------------------------------------------------------
# Session config
# ---------------------------------------------------------------------------


def _build_instructions(last_turn: cs.TurnSnapshot) -> str:
    """System prompt + dynamic state block, same recipe as the text flow."""
    return (
        system_prompts.CONVERSATION_AGENT_INSTRUCTIONS
        + "\n\n"
        + system_prompts.build_state_context_message(last_turn)
    )


def _session_config(last_turn: cs.TurnSnapshot) -> dict:
    """GA Realtime session config shape (audio nested under input/output)."""
    return {
        "type": "realtime",
        "model": REALTIME_MODEL,
        "output_modalities": ["audio"],
        "instructions": _build_instructions(last_turn),
        "audio": {
            "input": {
                "format": {"type": "audio/pcm", "rate": 24000},
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 600,
                },
                "transcription": {"model": "whisper-1"},
            },
            "output": {
                "format": {"type": "audio/pcm", "rate": 24000},
                "voice": REALTIME_VOICE,
            },
        },
        "tools": TOOL_SCHEMAS,
        "tool_choice": "auto",
    }


# ---------------------------------------------------------------------------
# Per-turn working state
# ---------------------------------------------------------------------------


class VoiceTurn:
    """One in-flight voice turn — accumulates the agent reply + tool calls.

    A turn starts when the user finishes speaking (server VAD) and ends on
    the OpenAI ``response.done`` event. Persistence happens then.
    """

    def __init__(self) -> None:
        self.agent_text_parts: list[str] = []
        self.user_transcript: Optional[str] = None
        self.function_calls: list[dict] = []
        self.started_at = time.perf_counter()

    @property
    def agent_text(self) -> str:
        return "".join(self.agent_text_parts)


# ---------------------------------------------------------------------------
# Safety nets (same as run_turn)
# ---------------------------------------------------------------------------


def _already_notified(ctx: agent_tools.TurnContext) -> bool:
    notifs = ctx.working.get("notifications") or []
    return any(n.get("type") == "would_sms_jill" for n in notifs)


def _apply_safety_nets(ctx: agent_tools.TurnContext) -> None:
    """Same guarantees as app.agent.run_turn — notify_jill on emergency,
    auto-close on booked."""
    if (
        ctx.working.get("urgency") == "emergency"
        and not _already_notified(ctx)
    ):
        ctx.notify_jill(reason="Emergency reported by customer (voice intake).")

    booking = ctx.working.get("booking") or {}
    if (
        booking.get("booking_status") == "booked"
        and ctx.working.get("status") != "closed_done"
    ):
        ctx.close_conversation(sub_reason="booked")


# ---------------------------------------------------------------------------
# Tool dispatch
# ---------------------------------------------------------------------------


def _dispatch_tool(ctx: agent_tools.TurnContext, name: str, arguments: dict) -> Any:
    if name not in TOOL_NAMES:
        return f"unknown tool: {name}"
    method = getattr(ctx, name, None)
    if method is None:
        return f"tool not implemented: {name}"
    try:
        return method(**arguments)
    except TypeError as exc:
        return f"bad arguments: {exc}"
    except Exception as exc:  # noqa: BLE001 — surface to LLM, don't crash bridge
        logger.exception("Tool %s raised", name)
        return f"tool error: {exc}"


# ---------------------------------------------------------------------------
# Frontend send helpers
# ---------------------------------------------------------------------------


async def _send_json(ws: WebSocket, payload: dict) -> None:
    await ws.send_text(json.dumps(payload))


async def _send_audio(ws: WebSocket, audio_bytes: bytes) -> None:
    await ws.send_bytes(audio_bytes)


# ---------------------------------------------------------------------------
# Main bridge
# ---------------------------------------------------------------------------


async def handle_voice_ws(websocket: WebSocket, conversation_id: str) -> None:
    """Bridge browser WS ↔ OpenAI Realtime for one conversation.

    ``conversation_id`` may be ``"new"`` to start a fresh conversation;
    the id assigned is returned in the first JSON event.
    """
    await websocket.accept()

    # Resolve / create state.
    if conversation_id == "new":
        conversation_id = cs.new_conversation_id()
        state = cs.new_state(conversation_id)
    else:
        state = cs.load_state(conversation_id) or cs.new_state(conversation_id)

    await _send_json(
        websocket,
        {"type": "conversation_started", "conversation_id": conversation_id},
    )

    # Seed the TurnContext from the last_turn (same as run_turn step 4).
    ctx = agent_tools.TurnContext(_seed_from_state(state))
    if ctx.working.get("status") == "new":
        ctx.working["status"] = "in_progress"

    # Shared mutable holders so the two pumps can rotate the in-flight
    # turn + the latest persisted state without locks.
    holder = {"state": state, "turn": VoiceTurn()}

    try:
        async with _openai().realtime.connect(model=REALTIME_MODEL) as conn:
            # Configure session.
            await conn.send(
                {"type": "session.update", "session": _session_config(ctx.snapshot())}
            )

            client_task = asyncio.create_task(
                _pump_client_to_openai(websocket, conn),
                name="voice_client_to_openai",
            )
            server_task = asyncio.create_task(
                _pump_openai_to_client(websocket, conn, ctx, holder),
                name="voice_openai_to_client",
            )

            done, pending = await asyncio.wait(
                {client_task, server_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
            for task in done:
                exc = task.exception()
                if exc and not isinstance(exc, WebSocketDisconnect):
                    logger.exception("voice task crashed", exc_info=exc)

    except WebSocketDisconnect:
        logger.info("voice ws disconnected conv=%s", conversation_id)
    except Exception as exc:  # noqa: BLE001 — last-resort guard
        logger.exception("voice bridge crashed conv=%s", conversation_id)
        try:
            await _send_json(websocket, {"type": "error", "message": str(exc)})
        except Exception:
            pass


def _seed_from_state(state: cs.ConversationState) -> cs.TurnSnapshot:
    previous = state["last_turn"]
    return cs.TurnSnapshot(
        status=previous.get("status", "new"),
        urgency=previous.get("urgency"),
        customer=dict(previous.get("customer", {}) or {}),
        triage=previous.get("triage"),
        quote=previous.get("quote"),
        booking=dict(previous.get("booking") or cs.empty_booking()),
        sub_reason=previous.get("sub_reason"),
        notifications=list(previous.get("notifications", []) or []),
    )


# ---------------------------------------------------------------------------
# Pump 1: browser → OpenAI
# ---------------------------------------------------------------------------


async def _pump_client_to_openai(websocket: WebSocket, conn) -> None:
    """Forward mic audio (binary frames) from the browser into the Realtime
    session as base64-encoded audio buffer appends."""
    while True:
        msg = await websocket.receive()
        if msg.get("type") == "websocket.disconnect":
            raise WebSocketDisconnect()

        audio_bytes = msg.get("bytes")
        if audio_bytes:
            await conn.send(
                {
                    "type": "input_audio_buffer.append",
                    "audio": base64.b64encode(audio_bytes).decode("ascii"),
                }
            )
            continue

        text = msg.get("text")
        if text:
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                continue
            if payload.get("type") == "interrupt":
                # Best-effort cancel — barge-in is reserved for V2.
                await conn.send({"type": "response.cancel"})


# ---------------------------------------------------------------------------
# Pump 2: OpenAI → browser (+ tool execution + per-turn persistence)
# ---------------------------------------------------------------------------


async def _pump_openai_to_client(
    websocket: WebSocket,
    conn,
    ctx: agent_tools.TurnContext,
    holder: dict,
) -> None:
    """Forward Realtime events to the browser and persist per turn."""
    async for event in conn:
        et = getattr(event, "type", None)
        turn: VoiceTurn = holder["turn"]

        if et in ("session.created", "session.updated"):
            await _send_json(websocket, {"type": "session_ready"})

        elif et == "input_audio_buffer.speech_started":
            await _send_json(websocket, {"type": "user_speaking"})

        elif et == "input_audio_buffer.speech_stopped":
            await _send_json(websocket, {"type": "user_stopped"})

        elif et == "conversation.item.input_audio_transcription.completed":
            transcript = getattr(event, "transcript", "") or ""
            turn.user_transcript = transcript
            await _send_json(
                websocket,
                {"type": "user_transcript_done", "text": transcript},
            )
            # Append to canonical transcript right away.
            holder["state"] = cs.append_message(
                holder["state"], role="user", content=transcript
            )

        elif et == "response.output_audio.delta":
            audio_b64 = getattr(event, "delta", "")
            if audio_b64:
                try:
                    await _send_audio(websocket, base64.b64decode(audio_b64))
                except Exception:
                    logger.exception("agent audio forward failed")

        elif et == "response.output_audio_transcript.delta":
            delta = getattr(event, "delta", "")
            if delta:
                turn.agent_text_parts.append(delta)
                await _send_json(
                    websocket,
                    {"type": "agent_text_delta", "text": delta},
                )

        elif et == "response.function_call_arguments.done":
            name = getattr(event, "name", "")
            call_id = getattr(event, "call_id", "")
            args_str = getattr(event, "arguments", "{}") or "{}"
            try:
                args = json.loads(args_str)
            except json.JSONDecodeError:
                args = {}

            result = _dispatch_tool(ctx, name, args)
            turn.function_calls.append(
                {"name": name, "arguments": args, "result": result}
            )

            await _send_json(
                websocket,
                {
                    "type": "tool_call",
                    "name": name,
                    "arguments": args,
                    "result": str(result),
                },
            )

            # Feed the result back to the model and ask it to continue.
            await conn.send(
                {
                    "type": "conversation.item.create",
                    "item": {
                        "type": "function_call_output",
                        "call_id": call_id,
                        "output": json.dumps(result, default=str),
                    },
                }
            )
            await conn.send({"type": "response.create"})

        elif et == "response.done":
            await _send_json(
                websocket,
                {"type": "agent_text_done", "text": turn.agent_text},
            )

            # Persist only if this turn produced any user/agent content.
            if turn.user_transcript or turn.agent_text:
                # Apply safety nets before promoting the snapshot.
                _apply_safety_nets(ctx)

                latency_ms = int((time.perf_counter() - turn.started_at) * 1000)
                new_state = cs.apply_turn(holder["state"], ctx.snapshot())
                if turn.agent_text:
                    new_state = cs.append_message(
                        new_state, role="agent", content=turn.agent_text
                    )
                cs.save_state(new_state)
                cs.upsert_index(new_state)
                _log_voice_turn(
                    conversation_id=new_state["conversation_id"],
                    turn_number=new_state["last_turn"]["turn_number"],
                    turn=turn,
                    latency_ms=latency_ms,
                )
                holder["state"] = new_state

                await _send_json(
                    websocket,
                    {
                        "type": "state_update",
                        "last_turn": dict(new_state["last_turn"]),
                    },
                )

                # Refresh the system prompt so the next turn sees the
                # updated <state> block (urgency / quote / booking).
                # GA requires session.type on every session.update.
                await conn.send(
                    {
                        "type": "session.update",
                        "session": {
                            "type": "realtime",
                            "instructions": _build_instructions(ctx.snapshot()),
                        },
                    }
                )

            # Rotate the turn accumulator.
            holder["turn"] = VoiceTurn()

        elif et == "error":
            err = getattr(event, "error", None)
            msg = getattr(err, "message", None) or str(err)
            logger.warning("realtime error: %s", msg)
            await _send_json(websocket, {"type": "error", "message": msg})


def _log_voice_turn(
    *,
    conversation_id: str,
    turn_number: int,
    turn: VoiceTurn,
    latency_ms: int,
) -> None:
    """Append one record to the conversation's llm_log.json."""
    call = cs.LLMCall(
        turn_number=turn_number,
        purpose="conversation",  # same bucket as text turns
        model=REALTIME_MODEL,
        input_messages=(
            [{"role": "user", "content": turn.user_transcript}]
            if turn.user_transcript
            else []
        ),
        output=turn.agent_text,
        function_calls=turn.function_calls,
        usage={"input_tokens": None, "output_tokens": None, "total_tokens": None},
        latency_ms=latency_ms,
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    )
    cs.append_llm_call(conversation_id, call)
