# Rules and Tools for the Agent

Pipeline uses **two** AI roles working together for every customer message: a
fast triage classifier that picks an urgency level, and a conversation agent
that talks to the customer and drives the business workflow via tools.

## The two agents at a glance

### Triage classifier — *"how urgent is this?"*

**Goal.** On every customer message, decide whether the request is an
`emergency`, a `priority` job, or `scheduled` work, and surface a short
reason and matched signals so the conversation agent and the dashboard
can react.

**Behaviour.** Single-shot, JSON-only call. No tools, no conversation. It
reads the last few turns plus the newest message and returns a structured
verdict. Conservative by design: clear active damage or safety risk is
needed for an `emergency` classification; mere urgent language alone is
treated as `priority` with `needs_clarification=true`.

### Conversation agent — *"what should we say and do next?"*

**Goal.** Reply to the customer in a short, natural sentence, and call the
right business tools as a side effect (capture contact info, draft a quote,
offer slots, confirm a booking, alert Jill, close the conversation).

**Behaviour.** Identifies itself on turn 1 as Jill's AI assistant. Reads a
fresh `<state>` block injected into the prompt every turn so it always
reacts to the current quote/booking/triage status. Branches its flow on
urgency:

- **emergency** → safety mode: short calm guidance, alert Jill, do not
  quote, do not propose slots, do not close.
- **priority** → continue intake; aim for quote then booking.
- **scheduled** → continue intake; aim for booking only (no quote unless
  the customer explicitly asks the price).

## Functional details

### Models

Both models are configurable via environment variables and default to
OpenAI:

| Role | Default model | Env override |
|---|---|---|
| Triage classifier | `gpt-4.1-nano` | `PIPELINE_TRIAGE_MODEL` |
| Conversation agent | `gpt-4o-mini` | `PIPELINE_CONVERSATION_MODEL` |

The conversation agent runs on top of the Microsoft Agent Framework
(`agent_framework.openai.OpenAIChatCompletionClient`), which handles the
function-call schema generation, tool dispatch, and message history.

### Triage prompt (JSON contract)

The triage prompt (`backend/app/system_prompts.py` `TRIAGE_INSTRUCTIONS`)
demands a strict JSON object — no prose, no markdown:

```json
{
  "urgency_level": "emergency | priority | scheduled",
  "confidence": 0.0,
  "reason": "one sentence justification",
  "matched_signals": ["short phrase from the message", "..."],
  "needs_clarification": false,
  "customer_claimed_emergency": false,
  "active_damage_confirmed": false
}
```

Definitions used by the classifier:

- **emergency** — active damage or safety risk (flooding, water spraying,
  gas smell, sewage backup, no water at all, water near electrical, burst
  pipe, can't shut off main).
- **priority** — uncomfortable but contained (no hot water, slow drain
  getting worse, contained leak, "need someone soon"), no active damage.
- **scheduled** — planned, flexible work (installs, replacements, "next
  week", "whenever convenient").

The output is normalised by `_normalize_triage` in `backend/app/agent.py`
so downstream code always sees a complete, well-typed dict regardless of
what the model returned.

### Conversation prompt — rule blocks

The conversation prompt (`backend/app/system_prompts.py`
`CONVERSATION_AGENT_INSTRUCTIONS`) is organised into rule blocks the agent
must obey:

- **Identity and tone.** Disclose AI assistant role on turn 1. Never claim
  to be human. Short, conversational replies (one or two sentences). Plain
  text only — no markdown, no bullet lists in customer-facing replies.
  Never invent plumbing facts, prices, or schedules.
- **Triage-driven behaviour.** Read the `<state>` block, branch on
  `urgency` as described above.
- **Safety mode (emergency).** First reply is a short, calm safety
  instruction (turn off main valve if safe, leave area for gas, stay away
  from water near outlets) and a note that Jill has been alerted. Stay in
  the chat to answer follow-ups; never close the conversation.
- **Scoping (priority).** Before drafting a quote, ask both scoping
  questions defined for the matching problem type in `PLUMBING_KNOWLEDGE`
  and wait for answers. Never draft on the same turn the problem is first
  mentioned.
- **Quoting.** Call `generate_quote_draft` at most once per conversation.
  Never quote for `scheduled` jobs unless the customer explicitly asks
  about price. Tell the customer the quote is being reviewed by Jill and
  do not invent a timeline.
- **Booking.** Call `propose_slots` once, after a quote is accepted (or
  for scheduled jobs after scoping). When the customer picks a slot, call
  `confirm_slot`, send a brief confirmation, then call
  `close_conversation(sub_reason="booked")`.
- **Edge cases.** Wrong number, out of area, out of scope, spam, or a
  customer who declines a quote → polite one-line close with the matching
  `sub_reason`. Emergencies are never closed by the agent — Jill closes
  them manually from the dashboard.

### Plumbing knowledge

The conversation prompt embeds a small `PLUMBING_KNOWLEDGE` table
(`backend/app/system_prompts.py`) — six problem types, each with its top
two scoping questions and a typical price range:

- `hot_water_tank` — $250–$600
- `dishwasher_install` — $200–$400
- `leaking_faucet` — $150–$300
- `clogged_drain` — $150–$350
- `toilet_repair` — $150–$400
- `default` — $150–$500 (fallback when nothing else fits)

Every quote carries the disclaimer: *"Final pricing will be confirmed
on-site after inspection."* Older homes (pre-1970) and tight access push
toward the high end of the range.

### Tools the conversation agent can call

All six tools are bound methods of a per-turn `TurnContext`
(`backend/app/agent_tools.py`). The agent invokes them via OpenAI
function-calling; each call mutates the in-memory working snapshot and is
logged in `tool_calls` for observability.

| Tool | Purpose | Allow-list / notes |
|---|---|---|
| `set_customer_info(name?, phone?, email?)` | Save partial contact info as the customer reveals it. | May be called multiple times per turn. |
| `generate_quote_draft(problem_type, job_summary)` | Draft a quote pending Jill's review. | `problem_type` must be one of the six known types; unknown values are coerced to `default`. Sets `status = "quoted"` and `quote_status = "pending_jill_review"`. |
| `propose_slots()` | Offer three appointment slots (next three business days at 10:00). | No quote required for `scheduled` jobs. |
| `confirm_slot(slot_id)` | Record the slot the customer chose. | Sets `booking_status = "booked"`. |
| `close_conversation(sub_reason)` | Terminate the conversation cleanly. | `sub_reason` must be one of `booked`, `customer_declined`, `wrong_number`, `out_of_area`, `out_of_scope`, `spam`. Never used for emergencies. |
| `notify_jill(reason)` | Alert Jill that an emergency needs her attention. | Only called when urgency is `emergency`. Appends a `would_sms_jill` notification. |

Two safety nets in the agent loop (`backend/app/agent.py`) catch cases
where the model narrates an action instead of invoking the tool:

- On an `emergency` turn, if `notify_jill` was not called, the loop calls
  it on the agent's behalf using the triage reason.
- After a `confirm_slot` that leaves the conversation un-closed, the loop
  closes it with `sub_reason="booked"`.

### Operator side-channel (Jill's actions)

Beyond the agent itself, the API exposes a few Jill-only endpoints that
patch state without running a full agent turn:

- `POST /api/conversations/{id}/quote/decision` — approve or reject a
  pending quote (revisions are not supported in V1).
- `POST /api/conversations/{id}/close` — manually close any conversation
  with a `sub_reason` from a fixed list.
- `POST /api/conversations/{id}/rename` — set or clear the dashboard
  display label.

These writes do not increment `turn_number` because they are not agent
turns.

## III. Jill's service catalog

The catalog editor is the UI surface Jill uses to tune the agent's domain
knowledge without touching prompts or code. It is the editable
counterpart to the read-only `PLUMBING_KNOWLEDGE` block described above:
the editor writes structured data, the system regenerates the prompt
block from that data on the next turn.

### Why expose this and not the full prompt

Most of `CONVERSATION_AGENT_INSTRUCTIONS` is mechanics — tool ordering,
state-block consumption, JSON schemas — that would break the agent if a
non-technical user edited it. The catalog is the opposite: it is pure
domain policy (what services Jill offers, her prices, the right questions
to ask). Surfacing it as a structured editor lets Jill change the things
she is the expert on, while keeping the orchestration off-limits.

### What is editable

One row per `problem_type`. All fields are free-text except the price
bounds, which are integers.

| Field | Editable? | Notes |
|---|---|---|
| `problem_type` (slug) | Yes for new rows, locked for `default` | Snake-case identifier; passed to `generate_quote_draft`. |
| Display name | Yes | Used in dashboard labels and quote summaries. |
| Price low / Price high | Yes | Integer dollars. `generate_quote_draft` will not return numbers outside this range. |
| Scoping question 1 | Yes | The first question the agent must ask before quoting a `priority` job of this type. |
| Scoping question 2 | Yes | The second question. Both are required before `generate_quote_draft` is allowed to fire. |
| Active | Yes | Soft-delete toggle — inactive rows are excluded from the rendered `PLUMBING_KNOWLEDGE` block but kept for historical quotes. |

The `default` row is always present and cannot be deleted; it is the
fallback when no other `problem_type` matches the customer's description.
Its scoping questions and price range are still editable.

### What is NOT exposed in this editor

- The triage definitions (emergency / priority / scheduled signals).
  Those live in their own editor — see the emergency rules surface.
- The two global quote disclaimers ("Final pricing will be confirmed
  on-site after inspection." and the older-homes / tight-access caveat).
  Tone-level copy, edited elsewhere.
- The hard rule that **two scoping questions are required before a quote
  is drafted**. The editor controls the *content* of the questions, not
  whether they are asked.
- Anything about tool order, the `<state>` block, or the booking flow.

### How edits propagate

The catalog is persisted as structured data (one row per service). On
each turn, the conversation prompt is rendered by interpolating the
active rows into the `PLUMBING_KNOWLEDGE` template — same shape as
today's hardcoded block. No agent restart is needed; the next customer
message picks up the new values.

`generate_quote_draft` reads the same row to clamp its output: an unknown
or inactive `problem_type` is coerced to `default`, and the returned
range is always within `[price_low, price_high]` for the matched row.

### Audit and safety

- Every save writes a new version with timestamp + editor identity. The
  previous version stays queryable so a stray edit can be rolled back.
- Quotes already drafted under an older version of a row keep their
  original numbers (the historical row is the source of truth for that
  quote, not the live row).
- Validation on save: `price_low <= price_high`, both scoping questions
  non-empty, slug unique and snake-case. Failures block the save with an
  inline error.
