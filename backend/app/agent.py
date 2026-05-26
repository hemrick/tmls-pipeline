"""Conversation Agent loop.

Replaces the V0 hello-world singleton. The new flow per turn:

    1. Load conversation state (or create new).
    2. Append the user message to the transcript.
    3. Classify urgency (gpt-4.1-nano, single shot, no tools).
    4. Build a TurnContext seeded with the previous last_turn + fresh triage.
    5. Run the Conversation Agent (gpt-4o-mini, with the 6 function-call
       tools), feeding it the previous LLM message history + a fresh
       <state> system message + the new user message.
    6. The agent may invoke tools; those mutate ctx.working.
    7. Promote ctx.snapshot() into the new last_turn (apply_turn).
    8. Append the agent reply to the transcript.
    9. Persist state, llm_log (with serialized message history), index.
   10. Return (new_state, reply_text).
"""

from __future__ import annotations

import datetime
import json
import logging
import os
import time
from typing import Any, Optional

from openai import AsyncOpenAI

from agent_framework import Message
from agent_framework.openai import OpenAIChatCompletionClient

from app import agent_tools, conversation_store as cs, system_prompts

logger = logging.getLogger("pipeline.agent")


# Models. Set via env to override (e.g. for cost-saving in CI).
TRIAGE_MODEL = os.getenv("PIPELINE_TRIAGE_MODEL", "gpt-4.1-nano")
CONVERSATION_MODEL = os.getenv("PIPELINE_CONVERSATION_MODEL", "gpt-4o-mini")


# ---------------------------------------------------------------------------
# Lazy clients
# ---------------------------------------------------------------------------

_openai_client: Optional[AsyncOpenAI] = None
_chat_client: Optional[OpenAIChatCompletionClient] = None


def _openai() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI()
    return _openai_client


def _chat() -> OpenAIChatCompletionClient:
    """Reused MS Agent Framework client for the Conversation Agent.

    Re-created per turn at the agent level (the chat client itself is
    cheap to reuse). We make a fresh ``as_agent`` call per turn because
    the tools are bound to a per-turn TurnContext.
    """
    global _chat_client
    if _chat_client is None:
        _chat_client = OpenAIChatCompletionClient(model=CONVERSATION_MODEL)
    return _chat_client


# ---------------------------------------------------------------------------
# Triage — single-shot LLM classification
# ---------------------------------------------------------------------------


async def classify_urgency_llm(
    user_message: str,
    *,
    prior_messages: Optional[list[cs.Message]] = None,
) -> tuple[dict, dict]:
    """Classify the urgency of the latest user message.

    Returns ``(triage_result, llm_call_record)``. The triage dict matches
    the shape consumed by the UI and stored in ``last_turn.triage``.
    """
    history_text = ""
    if prior_messages:
        # Last few turns only — triage doesn't need the whole transcript.
        tail = prior_messages[-6:]
        history_text = "\n".join(
            f"{m['role']}: {m['content']}" for m in tail
        )

    user_block = (
        f"Conversation so far:\n{history_text}\n\nLatest customer message:\n{user_message}"
        if history_text
        else f"Customer message:\n{user_message}"
    )

    t0 = time.perf_counter()
    resp = await _openai().chat.completions.create(
        model=TRIAGE_MODEL,
        messages=[
            {"role": "system", "content": system_prompts.TRIAGE_INSTRUCTIONS},
            {"role": "user", "content": user_block},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    latency_ms = int((time.perf_counter() - t0) * 1000)

    raw_text = resp.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.warning("Triage LLM returned non-JSON; defaulting to priority")
        parsed = {
            "urgency_level": "priority",
            "confidence": 0.4,
            "reason": "Triage parse failure; defaulted to priority for follow-up.",
            "matched_signals": [],
            "needs_clarification": True,
        }

    triage = _normalize_triage(parsed)

    call_record = cs.LLMCall(
        turn_number=0,  # caller sets the real turn_number after apply_turn
        purpose="triage",
        model=TRIAGE_MODEL,
        input_messages=[
            {"role": "system", "content": system_prompts.TRIAGE_INSTRUCTIONS[:200] + "..."},
            {"role": "user", "content": user_block},
        ],
        output=raw_text,
        function_calls=[],
        usage={
            "input_tokens": resp.usage.prompt_tokens if resp.usage else None,
            "output_tokens": resp.usage.completion_tokens if resp.usage else None,
            "total_tokens": resp.usage.total_tokens if resp.usage else None,
        },
        latency_ms=latency_ms,
        timestamp=cs._now(),
    )
    return triage, dict(call_record)


_VALID_LEVELS = {"emergency", "priority", "scheduled"}
_LEVEL_LABELS = {
    "emergency": "Emergency",
    "priority": "Priority",
    "scheduled": "Scheduled",
}
_LEVEL_ACTIONS = {
    "emergency": "Alert Jill immediately and stop normal quote/booking flow.",
    "priority": "Continue intake and aim for quote-then-booking.",
    "scheduled": "Continue scoping then offer slots.",
}


def _normalize_triage(raw: dict) -> dict:
    """Coerce an LLM JSON response into our triage shape."""
    level = raw.get("urgency_level")
    if level not in _VALID_LEVELS:
        level = "priority"

    confidence = raw.get("confidence", 0.6)
    try:
        confidence = max(0.0, min(0.99, float(confidence)))
    except (TypeError, ValueError):
        confidence = 0.6

    guidance = None
    if level == "emergency":
        guidance = (
            "If safe, turn off your main water valve. Jill has been alerted."
        )

    return {
        "urgency_level": level,
        "urgency_label": _LEVEL_LABELS[level],
        "confidence": confidence,
        "reason": str(raw.get("reason") or "LLM classification."),
        "recommended_action": _LEVEL_ACTIONS[level],
        "customer_facing_guidance": guidance,
        "requires_human_followup": level != "scheduled",
        "continue_normal_flow": level != "emergency",
        "needs_clarification": bool(raw.get("needs_clarification", False)),
        "customer_claimed_emergency": bool(raw.get("customer_claimed_emergency", False)),
        "active_damage_confirmed": bool(raw.get("active_damage_confirmed", level == "emergency")),
        "classification_source": "llm",
        "matched_signals": list(raw.get("matched_signals") or []),
    }


# ---------------------------------------------------------------------------
# Conversation Agent loop
# ---------------------------------------------------------------------------


def _rehydrate_history(serialized: Optional[list[dict]]) -> list[Message]:
    if not serialized:
        return []
    return [Message.from_dict(d) for d in serialized]


def _serialize_history(history: list[Message]) -> list[dict]:
    return [m.to_dict() for m in history]


async def run_turn(
    conversation_id: Optional[str],
    user_message: str,
) -> tuple[cs.ConversationState, str]:
    """Run one full turn for the given conversation.

    If ``conversation_id`` is None or unknown, a new conversation is
    created. Returns the updated state and the assistant's reply text.
    """
    # 1. Load or create state.
    if conversation_id:
        state = cs.load_state(conversation_id)
    else:
        state = None
    if state is None:
        conv_id = conversation_id or cs.new_conversation_id()
        state = cs.new_state(conv_id)

    # 2. Append the user message to the transcript.
    state = cs.append_message(state, role="user", content=user_message)

    # 3. Triage.
    triage, triage_call = await classify_urgency_llm(
        user_message, prior_messages=state["messages"][:-1]
    )

    # 4. Seed the working state from the previous last_turn + triage.
    previous = state["last_turn"]
    seed = cs.TurnSnapshot(
        status=previous.get("status", "new"),
        urgency=triage["urgency_level"],
        customer=dict(previous.get("customer", {}) or {}),
        triage=triage,
        quote=previous.get("quote"),
        booking=dict(previous.get("booking") or cs.empty_booking()),
        sub_reason=previous.get("sub_reason"),
        notifications=list(previous.get("notifications", []) or []),
    )
    # First turn lifts new -> in_progress (the agent's reply will be turn 1).
    if seed["status"] == "new":
        seed["status"] = "in_progress"

    ctx = agent_tools.TurnContext(seed)

    # 5. Build run-time message list: previous LLM history + fresh state + new user msg.
    log = cs.load_llm_log(state["conversation_id"])
    serialized_history = json.loads(log["agent_thread"]) if log.get("agent_thread") else None
    history = _rehydrate_history(serialized_history)

    state_block = system_prompts.build_state_context_message(ctx.snapshot())
    run_messages: list[Message] = (
        list(history)
        + [Message(role="system", contents=[state_block])]
        + [Message(role="user", contents=[user_message])]
    )

    # 6. Run the agent.
    agent = _chat().as_agent(
        name="PipelineConversation",
        instructions=system_prompts.CONVERSATION_AGENT_INSTRUCTIONS,
        tools=ctx.as_tool_list(),
    )

    t0 = time.perf_counter()
    response = await agent.run(messages=run_messages)
    latency_ms = int((time.perf_counter() - t0) * 1000)

    reply_text = response.text or ""

    # Safety net: on emergency, ensure notify_jill fires even if the model
    # only described the action without calling the tool. Mini-tier models
    # sometimes narrate instead of invoking.
    if triage["urgency_level"] == "emergency" and not _already_notified(ctx):
        ctx.notify_jill(reason=triage.get("reason") or "Emergency reported by customer.")

    # Safety net: when a slot has just been confirmed, auto-close the
    # conversation if the model forgot. Booking is a terminal state.
    booking = ctx.working.get("booking") or {}
    if (
        booking.get("booking_status") == "booked"
        and ctx.working.get("status") != "closed_done"
    ):
        ctx.close_conversation(sub_reason="booked")

    # 7. Promote the working snapshot to the new last_turn.
    state = cs.apply_turn(state, ctx.snapshot())

    # 8. Append agent reply to transcript.
    state = cs.append_message(state, role="agent", content=reply_text)

    # 9. Persist. New persisted history = previous + user message + r.messages.
    new_history = (
        list(history)
        + [Message(role="user", contents=[user_message])]
        + list(response.messages)
    )

    conversation_call = cs.LLMCall(
        turn_number=state["last_turn"]["turn_number"],
        purpose="conversation",
        model=CONVERSATION_MODEL,
        input_messages=[m.to_dict() for m in run_messages],
        output=reply_text,
        function_calls=[c for c in ctx.tool_calls],
        usage=_extract_usage(response),
        latency_ms=latency_ms,
        timestamp=cs._now(),
    )
    # Stamp the triage record with the real turn number too.
    triage_call["turn_number"] = state["last_turn"]["turn_number"]

    # Append both calls in one log write.
    full_log = cs.load_llm_log(state["conversation_id"])
    full_log["calls"] = list(full_log.get("calls", [])) + [triage_call, dict(conversation_call)]
    full_log["agent_thread"] = json.dumps(_serialize_history(new_history))
    cs.save_llm_log(full_log)

    cs.save_state(state)
    cs.upsert_index(state)

    logger.info(
        "turn conv=%s turn=%s urgency=%s status=%s latency_ms=%s",
        state["conversation_id"],
        state["last_turn"]["turn_number"],
        state["last_turn"].get("urgency"),
        state["last_turn"].get("status"),
        latency_ms,
    )

    return state, reply_text


def _already_notified(ctx: agent_tools.TurnContext) -> bool:
    """True if any prior turn or this turn has already fired notify_jill."""
    notifs = ctx.working.get("notifications") or []
    return any(n.get("type") == "would_sms_jill" for n in notifs)


def _extract_usage(response: Any) -> dict:
    usage = getattr(response, "usage_details", None)
    if usage is None:
        return {"input_tokens": None, "output_tokens": None, "total_tokens": None}

    def get(key: str) -> Optional[int]:
        if isinstance(usage, dict):
            return usage.get(key)
        return getattr(usage, key, None)

    return {
        "input_tokens": get("input_token_count"),
        "output_tokens": get("output_token_count"),
        "total_tokens": get("total_token_count"),
    }
