# Text agent — how a customer message becomes one assistant turn

This section follows what happens inside the backend when a customer sends
a chat message to `POST /api/chat`. The orchestration lives in
`backend/app/agent.py` (the `run_turn` function), with the typed business
tools in `backend/app/agent_tools.py`, the prompts in
`backend/app/system_prompts.py`, and persistence in
`backend/app/conversation_store.py`.

## The 10-step `run_turn` pipeline

For every customer message, `run_turn(conversation_id, user_message)` walks
through ten ordered steps. Each one is a separate, testable concern.

### 1. Load or create state

`cs.load_state(conversation_id)` reads the persisted conversation; if the
id is missing or unknown, a fresh state is created with
`cs.new_state(cs.new_conversation_id())`. State is stored as JSON files
(GCS in the cloud, local disk in dev) and contains the full transcript,
the rolling `turn_history`, and the latest `last_turn` snapshot.

### 2. Append the user message to the transcript

`cs.append_message(state, role="user", content=user_message)` extends the
transcript before any LLM call so even failures are auditable.

### 3. Triage — single-shot LLM classification

`classify_urgency_llm` calls the triage model (`gpt-4.1-nano` by default)
with the last six turns plus the new user message and forces JSON output
via `response_format={"type": "json_object"}`. The result is normalised
into a fixed shape (`urgency_level`, `urgency_label`, `confidence`,
`reason`, `recommended_action`, `customer_facing_guidance`,
`requires_human_followup`, `continue_normal_flow`,
`needs_clarification`, `customer_claimed_emergency`,
`active_damage_confirmed`, `classification_source`, `matched_signals`).

### 4. Seed a `TurnContext` for the new turn

The previous `last_turn` plus the fresh triage are merged into a working
`TurnSnapshot` (`status`, `urgency`, `customer`, `triage`, `quote`,
`booking`, `sub_reason`, `notifications`). A `TurnContext` wraps that
snapshot and exposes the six business tools as bound methods. A first
turn that started as `new` is lifted to `in_progress`.

### 5. Inject fresh state into the prompt

`system_prompts.build_state_context_message(ctx.snapshot())` renders the
current `last_turn` as a compact JSON `<state>` block (turn number,
status, urgency, customer contact, triage reason, quote status, booking
status, offered slots, selected slot, sub-reason). The block is added as
a system message on **every** turn so the conversation agent always reacts
to fresh state, not stale memory.

The run-time message list passed to the agent is:

```
[previous LLM history]
+ [system: <state> block]
+ [user: new message]
```

The previous history is rehydrated from `agent_thread` in the LLM call log
via `_rehydrate_history` (`Message.from_dict` round-trip).

### 6. Run the conversation agent

`OpenAIChatCompletionClient.as_agent(...)` builds a fresh agent per turn,
named `PipelineConversation`, with `CONVERSATION_AGENT_INSTRUCTIONS` and
the six tools bound to the per-turn `TurnContext`. The model
(`gpt-4o-mini` by default) replies in text and may issue any number of
function calls — every call mutates `ctx.working` and appends to
`ctx.tool_calls` for observability.

### 7. Safety nets — patch missed tool calls

Two automatic corrections sit between the model run and persistence,
guarding against the well-known "model narrates instead of acts" failure
mode on smaller models:

- **Emergency notify.** If triage classified the turn as `emergency` and
  no prior or current turn has fired `notify_jill`, the loop calls it on
  the agent's behalf with the triage reason as the message.
- **Auto-close on booked.** If `booking_status == "booked"` (the customer
  picked a slot via `confirm_slot`) but the agent forgot to call
  `close_conversation`, the loop closes it with `sub_reason="booked"`.

### 8. Promote the working snapshot to `last_turn`

`cs.apply_turn(state, ctx.snapshot())` commits the new snapshot as
`last_turn`, increments `turn_number`, and rolls the previous `last_turn`
into `turn_history`.

### 9. Append the agent reply to the transcript

`cs.append_message(state, role="agent", content=reply_text)` records the
user-facing reply.

### 10. Persist state, LLM log, dashboard index

Three writes happen at the end of each turn:

- `cs.save_state(state)` — full conversation state (transcript,
  `last_turn`, `turn_history`).
- `cs.save_llm_log(full_log)` — appends two `LLMCall` records (one for
  triage, one for the conversation call) including inputs, outputs,
  function calls, token usage, latency, and a serialised `agent_thread`
  for the next turn to rehydrate.
- `cs.upsert_index(state)` — updates the lightweight dashboard index used
  by `GET /api/conversations`.

The function returns `(state, reply_text)` to the FastAPI handler, which
wraps it in the `ChatResponse` body.

## Why split triage and conversation?

Two reasons:

- **Cost.** The triage model (`gpt-4.1-nano`) is cheap and runs on every
  turn. Letting it own the urgency decision frees the conversation model
  to focus on dialogue and tools.
- **Determinism.** Triage is a JSON contract, not a free-form reply. By
  isolating it we get a stable, easily-evaluated classification surface
  that the dashboard, the prompt, and the safety nets all read.

## Why the per-turn `<state>` injection?

LLM conversation history is not a reliable place to store machine state —
the model may misremember the quote status or whether a slot was confirmed.
By rendering `last_turn` into a JSON block injected as a system message
every turn, we give the agent ground-truth context and free it from having
to reconstruct state from prior chat turns.

## Where to look in the code

| Concern | File |
|---|---|
| Orchestrator (`run_turn`, `classify_urgency_llm`) | `backend/app/agent.py` |
| Tools and per-turn `TurnContext` | `backend/app/agent_tools.py` |
| Prompts and `<state>` renderer | `backend/app/system_prompts.py` |
| Persistence (state, log, index) | `backend/app/conversation_store.py` |
| HTTP surface (`POST /api/chat`, dashboard reads) | `backend/app/main.py` |
