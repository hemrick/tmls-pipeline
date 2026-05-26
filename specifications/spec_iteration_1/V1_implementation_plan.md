# Pipeline — V1 Implementation Plan

**Iteration:** spec_iteration_1
**Status:** Decisions locked, ready to build
**Last updated:** 2026-05-26

---

## 1. Purpose

This document captures the decisions taken to build the V1 prototype of Pipeline
— the AI intake assistant for skilled-trades small businesses (plumbing, demo
scope).

It is the **single source of truth** for V1 scope, behavior and architecture. It
supersedes conflicts found in `spec.md`, `agent_design.mermaid`,
`PIPELINE_flowchart_mermaid.md`, `data_model.mermaid`, `storage_schema.yaml` and
`demo_scenarios.md` for anything covered here.

The broader product spec (`spec.md`) and the epic plan (`PROJECT_PLAN.md`)
remain valid for V2+ scope.

---

## 2. Scope summary

### In scope (V1)

- Text chat for the customer (web UI).
- AI Conversation Agent driven by MS Agent Framework (Python) + OpenAI.
- Continuous urgency triage (LLM-based, every customer turn).
- Quote generation with Jill's approval loop (max 3 revisions).
- Inline slot proposal as a stand-in for booking.
- Jill's dashboard: list of conversations + detail panel + quote review.
- Full per-conversation persistence to Google Cloud Storage (state + LLM log).
- Demo persona: **Jill's Plumbing — serving the GTA since 2003**.

### Out of scope (V1)

All external integrations are out. Wherever the product would call an external
system, the UI prints the action instead.

| Item | V1 substitute |
|---|---|
| Calendly | Agent proposes 2–3 fake slots inline; UI logs "Would create Calendly event at <slot>" |
| SMTP / email | UI logs "Would send email to <address>: <subject>" |
| PDF generation | Quote rendered as an inline card in chat; no file |
| SMS / Twilio | UI logs "Would SMS <number>: <message>" |
| Voice / STT / TTS | — |
| Auth / multi-tenant | Single contractor (Jill), no login |
| Photo intake | — |
| Trades other than plumbing | — |

---

## 3. Functional spec (consolidated)

### 3.1 Channels

Text chat only. One Next.js app, two routes:
- `/` — customer chat
- `/dashboard` — Jill's dashboard

No login.

### 3.2 Conversation flow

**Greeting:**
- Agent introduces itself as Jill's AI assistant (FR-01).
- Standard greeting asks for **name + phone + email** up-front.
- **Emergency carve-out:** if the customer's first message contains a hard
  emergency signal *as judged by the LLM*, agent replies with safety guidance
  immediately and collects contact info after the customer is calm.

**Per-turn loop (every customer message):**
1. Load `state.json`.
2. Run triage classification (LLM call, single-shot, no streaming).
3. Run Conversation Agent (LLM call, with tools, streamed reply).
4. Tools mutate a working copy of `last_turn`.
5. Persist new `last_turn`, append previous to `turn_history`, increment
   `turn_number`.
6. Write LLM call records to `llm_log.json`.
7. UI receives the new `last_turn` and re-renders.

**Urgency re-classification:** runs on **every** customer turn. Latest
classification wins (escalation and de-escalation both supported).

**Routing inferred from urgency (no explicit ask):**
- `emergency` → safety mode, no quote, no booking, conversation flagged for Jill.
- `priority` → quote then booking.
- `scheduled` → booking only, unless the customer asks about price (then quote).

**Scoping before a quote:** for each service type, the agent asks the
**top 2 questions** from `services_catalog.md` that most affect the price band
(e.g. for water heater: "gas or electric?" + "leaking or just cold?"). The
quote always carries the "final price confirmed on-site" disclaimer.

**Quote loop:** draft → `pending_jill_review` → Jill approves / requests
revision (capped at v3, then only approve/reject) / rejects → if approved, sent
to customer → customer accepts (continues to booking) or declines (polite
close).

**Booking (Calendly substitute):** agent calls `propose_slots()` → 2–3 fake
slots presented as buttons in chat (e.g. next 3 business days at 10:00 / 14:00).
Customer clicks → `confirm_slot(slot_id)` → UI logs "Would create Calendly
event at <slot>".

**Clarification chips:** triage may return `needs_clarification=true` *only* on
borderline priority/scheduled cases. UI shows two chips ("Earliest available"
/ "Standard appointment") that map to canned customer replies. Never triggers
on emergency or clear scheduled work.

### 3.3 Emergency behavior

- Safety guidance is sent immediately, before contact-info collection.
- Conversation chat **stays open in safety mode**: agent keeps answering
  follow-up safety questions (turn off main, where's the water, etc.).
- Agent calls `notify_jill(reason)` → UI logs "Would SMS Jill: <reason>".
- Conversation is **never auto-closed**. Only Jill can close an emergency
  from the dashboard.
- No quote drafted. No booking offered.

### 3.4 Customer wait state during Jill's quote review

- Input is **disabled**.
- Agent message: "Jill is reviewing — I'll show it here as soon as she's done."
- Frontend polls `GET /api/conversations/{id}` every 2s.
- When `quote.quote_status` flips to `sent_to_customer`, the quote card
  appears and input re-enables.

### 3.5 Closing rules

Agent auto-closes on natural terminal states:
- Customer confirmed a slot → `status=closed_done`, `sub_reason=booked`.
- Customer declined a quote → `status=closed_no_action`, `sub_reason=customer_declined`.
- Agent detects wrong number / out of area / out of scope →
  `status=closed_no_action`, `sub_reason=wrong_number|out_of_area|out_of_scope|spam`.

Jill closes everything else via a dashboard "Close conversation" button
(emergencies, manual follow-ups, ghosts).

### 3.6 Status enum (final)

```
new | in_progress | quoted | booked | closed_no_action | closed_done
```

- `new` — first message received, no triage yet.
- `in_progress` — active conversation, post-triage.
- `quoted` — quote sent to customer, awaiting decision.
- `booked` — customer picked a slot.
- `closed_done` — successful terminal close.
- `closed_no_action` — closed without a job (carries `sub_reason`).

`sub_reason` values: `booked | customer_declined | wrong_number | out_of_area | out_of_scope | spam | jill_manual`.

### 3.7 Urgency enum (final)

```
emergency | priority | scheduled
```

(`out-of-scope` is NOT an urgency; it's a `sub_reason` under `closed_no_action`.)

### 3.8 Dashboard

- Polls `GET /api/conversations` every 3s.
- List sorted: emergencies first, then by `updated_at` desc.
- Detail panel renders all sections from `ui_wireframe_notes.md` §3 against
  the `last_turn` payload.
- Jill actions: approve / request revision / reject quote;
  close conversation; mark manual follow-up.
- Prompt editing: **read-only** in V1 (stretch goal for V2).

---

## 4. Technical architecture

### 4.1 Agent topology

**Single Conversation LLM agent** (MS Agent Framework, Python) with Python
services exposed as **function-call tools**. No multi-agent handoffs.

Triage runs as a separate, single-shot LLM call (no tools) before the
conversation agent each turn.

### 4.2 Frontend topology

One Next.js 14 app, two routes (`/` and `/dashboard`). Standalone build. Same
deploy.

### 4.3 LLM models

| Call | Model | Why |
|---|---|---|
| Triage classification | `gpt-4.1-nano` | Single-shot classification, no tools, speed-first |
| Conversation reply (with tools) | `gpt-4o-mini` (streamed) | Reliable function-calling on a 7-tool surface; TTFT ~300ms |

### 4.4 MS Agent Framework thread persistence

Framework owns the conversation thread. On each turn we
`AgentThread.serialize()` → store the result inside `llm_log.json` under
`agent_thread`. On the next turn we deserialize from there and resume.

`state.json` stays free of framework internals.

### 4.5 Storage layout (GCS)

```
gs://tmls-pipeline/
  index.json                              # dashboard list (lightweight)
  conversations/
    {conv_id}/
      state.json                          # business state
      llm_log.json                        # every LLM call + agent_thread
```

Per-conversation files mean writes are scoped per conversation. NFR-12's
"single concurrent conversation" constraint **no longer applies** — multiple
customers can chat in parallel during the demo.

`index.json` is updated on conversation create, status change and close. It
holds only the fields the dashboard list needs (id, customer.name, last
message snippet, urgency, status, updated_at).

### 4.6 Streaming

- `POST /api/chat`: streams the assistant reply as SSE
  (`text/event-stream`). Final event carries the new `last_turn`.
- Triage call: blocking, no streaming.
- Dashboard list and customer wait state: HTTP polling (3s / 2s).

---

## 5. Data schemas

### 5.1 `state.json`

```json
{
  "conversation_id": "uuid",
  "created_at": "iso-8601",
  "updated_at": "iso-8601",
  "last_turn": {
    "turn_number": 5,
    "status": "in_progress",
    "urgency": "priority",
    "customer": {
      "name": "Mike T.",
      "phone": "555-0123",
      "email": "mike@example.com"
    },
    "triage": {
      "urgency_level": "priority",
      "urgency_label": "Priority",
      "confidence": 0.82,
      "reason": "Hot water tank failure, urgent language, no active damage.",
      "recommended_action": "Continue intake; offer quote.",
      "customer_facing_guidance": null,
      "requires_human_followup": true,
      "continue_normal_flow": true,
      "needs_clarification": false,
      "matched_signals": ["hot water tank stopped"]
    },
    "quote": {
      "quote_status": "pending_jill_review",
      "version": 1,
      "job_summary": "Hot water tank not producing heat.",
      "scope": ["..."],
      "estimated_price_range": "$250-$600",
      "disclaimer": "Final pricing will be confirmed on-site after inspection.",
      "history": [
        {"status": "draft", "note": null, "actor": "agent"},
        {"status": "pending_jill_review", "note": null, "actor": "agent"}
      ],
      "next_action": "Awaiting Jill review."
    },
    "booking": {
      "booking_status": "not_started",
      "booking_method": null,
      "slots_offered": [],
      "selected_slot": null,
      "ui_log": []
    },
    "sub_reason": null,
    "notifications": [
      {"type": "would_sms_jill", "reason": "Priority intake", "at": "iso-8601"}
    ],
    "updated_at": "iso-8601"
  },
  "turn_history": [
    { "turn_number": 1, "status": "new", "urgency": null, "...": "..." },
    { "turn_number": 2, "status": "in_progress", "urgency": "priority", "...": "..." }
  ]
}
```

**Rules:**
- `last_turn` is the canonical current state.
- `turn_history` is append-only; never edited.
- Each tool call mutates a working copy of `last_turn` during the turn; the
  working copy replaces `last_turn` at end of turn, and the previous
  `last_turn` is appended to `turn_history`.
- The LLM receives the current `last_turn` as part of its input on every
  conversation call (see §6.3).

### 5.2 `llm_log.json`

```json
{
  "conversation_id": "uuid",
  "calls": [
    {
      "turn_number": 5,
      "purpose": "triage" | "conversation",
      "model": "gpt-4.1-nano",
      "input_messages": [{"role": "...", "content": "..."}],
      "output": "...",
      "function_calls": [
        {"name": "classify_urgency", "arguments": {...}, "result": {...}}
      ],
      "usage": {
        "input_tokens": 412,
        "output_tokens": 78,
        "total_tokens": 490
      },
      "latency_ms": 612,
      "timestamp": "iso-8601"
    }
  ],
  "agent_thread": "<base64 or json blob from AgentThread.serialize()>"
}
```

### 5.3 `index.json`

```json
{
  "updated_at": "iso-8601",
  "conversations": [
    {
      "conversation_id": "uuid",
      "customer_name": "Mike T.",
      "summary": "Hot water tank stopped working",
      "urgency": "priority",
      "status": "quoted",
      "sub_reason": null,
      "updated_at": "iso-8601"
    }
  ]
}
```

---

## 6. Tools — function-call inventory

All tools are exposed to the Conversation Agent. Each one mutates a specific
field of the working `last_turn`. None hit external services in V1; "Would
do X" actions are appended to `last_turn.notifications` or
`last_turn.booking.ui_log`.

| Tool | Purpose | Mutates |
|---|---|---|
| `set_customer_info(name?, phone?, email?)` | Capture contact details as collected | `customer` |
| `generate_quote_draft(service_type, scope_answers)` | Returns E11 JSON, status `pending_jill_review` | `quote`, `status → quoted` (on send) |
| `propose_slots()` | Returns 2–3 deterministic fake slots (next 3 business days at 10:00 / 14:00) | `booking.slots_offered`, `booking.booking_status → link_sent` |
| `confirm_slot(slot_id)` | Customer picked a slot | `booking.selected_slot`, `booking.booking_status → booked`, `status → booked`, `ui_log += "Would create Calendly event"` |
| `close_conversation(sub_reason)` | Agent's natural-end close | `status`, `sub_reason` |
| `notify_jill(reason)` | UI-log-only Jill notification | `notifications` |

Triage (`classify_urgency`) is NOT a tool — it's a separate single-shot LLM
call before the conversation agent runs.

### 6.3 How `last_turn` reaches the LLM

The conversation agent system prompt has two parts:

1. **Static prompt** — persona ("Jill's Plumbing"), plumbing knowledge from
   `services_catalog.md` (top-2 questions per service, typical price ranges),
   conversation rules (short, conversational, AI-disclosed, no fabricating).
2. **Dynamic state injection** — a developer/system message inserted before
   every conversation call, containing the current `last_turn` as a structured
   JSON block, prefixed by "CURRENT STATE — react to this:".

The agent reads state from this block and mutates it via tool calls. No
hidden state.

---

## 7. API contracts

All endpoints are FastAPI. CORS allowlist driven by `ALLOWED_ORIGINS` env var.

### Customer-facing

- `POST /api/chat`
  - Body: `{ conversation_id?: string, message: string }`
  - If `conversation_id` is absent → creates a new conversation.
  - Returns: SSE stream of tokens, final event carries
    `{ conversation_id, last_turn }`.

- `GET /api/conversations/{id}`
  - Returns full `state.json`. Used by frontend polling during Jill review and
    by the dashboard detail panel.

### Dashboard-facing

- `GET /api/conversations`
  - Returns `index.json`. Polled every 3s.

- `POST /api/conversations/{id}/quote/decision`
  - Body: `{ decision: "approve" | "revise" | "reject", note?: string }`
  - Mutates `quote.quote_status` and `quote.history` accordingly.
  - On `approve`: status flips to `sent_to_customer`; the customer's polling
    will pick it up.
  - On `revise`: triggers a new draft (re-runs the conversation agent with
    the note as additional context).
  - Hard cap: revisions blocked at v3.

- `POST /api/conversations/{id}/close`
  - Body: `{ sub_reason: string }`
  - Jill's manual close button.

### Debug

- `GET /api/conversations/{id}/llm-log`
  - Returns `llm_log.json`. Not linked from main UI; for debugging.

---

## 8. Frontend

### 8.1 Routes

- `/` — Customer chat. Persists `conversation_id` in `localStorage` so a tab
  refresh keeps the same conversation.
- `/dashboard` — Two-pane Jill view (list left, detail right). No auth.

### 8.2 Components

| Component | Where | Purpose |
|---|---|---|
| `ChatBox` | `/` | Message list + input. Replaces current minimal `ChatBox.tsx`. |
| `UrgencyChip` | `/`, `/dashboard` | Emergency / Priority / Scheduled pill. |
| `QuoteCard` | `/` | Scope + price range + disclaimer + Accept / Decline. |
| `SlotButtons` | `/` | 2–3 slot pills the customer can click. |
| `ClarificationChips` | `/` | Two-chip prompt when triage returns `needs_clarification`. |
| `WaitingForJill` | `/` | Disabled input + "Jill is reviewing…" banner. |
| `ConversationList` | `/dashboard` | List of cards, sorted, polling. |
| `ConversationDetail` | `/dashboard` | Header + customer info + transcript + triage + booking + quote + actions. |
| `QuoteApprovalPanel` | `/dashboard` | Approve / Request revision / Reject + note textarea. |
| `ActionsPanel` | `/dashboard` | Close conversation + sub-reason picker. |

### 8.3 Wireframes

Follow `ui_wireframe_notes.md` for layout. Map `last_turn` fields to UI
sections as documented there.

---

## 9. Build order

Tight dependency order. Each step is roughly independently demoable.

1. **Storage layer.** Per-conversation `state.json` + `llm_log.json` + global
   `index.json` read/write helpers. Unit-test the state mutation logic
   (`last_turn` → append → new `last_turn`).
2. **Tool implementations.** Wrap existing `services/triage.py`,
   `services/quotes.py`, `services/scheduling.py` as function-call tools. Add
   `set_customer_info`, `confirm_slot`, `close_conversation`, `notify_jill`.
3. **Agent loop.** MS Agent Framework setup. Static system prompt (persona +
   plumbing knowledge). Dynamic `last_turn` injection. Tool registration.
   Thread serialization to `llm_log.json`.
4. **`POST /api/chat`.** Sessioned by `conversation_id`. Per-turn loop:
   triage → conversation agent → persist → return SSE stream.
5. **Customer chat UI.** Real `ChatBox` with `conversation_id`,
   `UrgencyChip`, `QuoteCard`, `SlotButtons`, `WaitingForJill`,
   `ClarificationChips`. localStorage persistence.
6. **Dashboard list.** `GET /api/conversations` + `ConversationList` +
   polling.
7. **Dashboard detail.** `GET /api/conversations/{id}` + all
   `ConversationDetail` sections + `QuoteApprovalPanel` + `ActionsPanel`.
8. **Jill actions.** `POST .../quote/decision` and `POST .../close`.
9. **Demo polish.** Run the three scenarios end-to-end. Tune the system
   prompt. Smoke-test edge cases.

### 9.1 Deploy

Existing `deploy_test.md` (per-branch preview) and `deploy_prod.md` (production)
flows apply unchanged — backend + frontend Cloud Run services, branch-suffixed
service names, shared SA / bucket. No new infra needed for V1.

---

## 10. Defaults for items not explicitly decided

These are my picks for everything we didn't ask about. Push back inline if any
are wrong.

| Item | Default |
|---|---|
| Dashboard polling interval | 3s |
| Customer wait-state polling interval | 2s |
| Conversation ID generation | UUIDv4, server-side, returned on first response |
| Frontend conversation persistence | `localStorage` keyed by `conversation_id` |
| LLM logging granularity | Full prompt + output + function calls + usage + latency per call |
| Max turns per conversation | None (rely on agent's `close_conversation`) |
| GCS write strategy | Read-modify-write per turn (per-conv file, no contention) |
| Customer identity / dedupe | None — each browser session = new conversation |
| Greeting language | English only (matches CLAUDE.md) |
| Demo seed data | One contractor persona ("Jill's Plumbing"), no pre-seeded conversations |

---

## 11. Risks to watch

| # | Risk | Mitigation |
|---|---|---|
| R1 | LLM mis-classifies a hard emergency as `priority` | Acceptance tests with the three scripted emergency phrasings. If we see a single miss, add a keyword floor (revisit Q16). |
| R2 | Tool-calling drift (agent calls wrong tool / wrong args) | Strong tool descriptions + tight examples in system prompt. Smoke-test with the three scenarios. |
| R3 | GCS read-modify-write race within a single conversation (e.g. customer + Jill writing at once) | Jill writes only on her endpoints (quote decision, close), customer writes only via `/api/chat`. Both touch the same `state.json` — for V1, accept last-write-wins. If we see corruption, add an ETag / generation precondition. |
| R4 | Quote agent over-scopes (asks 6 questions instead of 2) | Top-2 questions baked into per-service prompts. Cap on conversation rounds before drafting. |
| R5 | Streaming SSE behind Cloud Run | Verify proxy timeout config; fall back to non-streaming POST if needed. |
| R6 | Customer's tab closed during Jill review | localStorage keeps `conversation_id`; reopening the tab resumes via `GET /api/conversations/{id}`. |

---

## 12. Decisions log

Audit trail of decisions taken during the spec review (2026-05-26 working
session). Format: question → decision → rationale.

### Functional

| ID | Decision | Rationale |
|---|---|---|
| Q1 | Booking = agent proposes 2–3 inline slot buttons; UI logs "Would create Calendly event" | Concrete, clickable demo beat without external dependency |
| Q2 | Customer wait state = transparent ("Jill is reviewing") + polling | Honest about human-in-the-loop; matches product story |
| Q3 | Emergency chat stays open in safety mode | Best UX in real emergency; agent keeps helping until Jill arrives |
| Q4 | Out-of-scope = `status=closed_no_action` + `sub_reason`, not a 4th urgency value | Keeps urgency enum semantically clean |
| Q5 | Re-classify urgency every customer turn | Catches escalation and de-escalation; matches spec NFR-05 |
| Q6 | Triage always LLM, no rules, no keyword floor | User confidence in model; simpler code |
| Q7 | Scoping = top-2 questions per service | Fast demo + disclaimer covers the gap |
| Q8 | Intent inferred from urgency (no explicit ask) | Matches the three demo scenarios exactly |
| Q9bis | Contact up-front in greeting, emergency carve-out (safety first) | Reconciles form-style intake with emergency UX |
| Q10 | Quote revisions capped at v3, then only Approve / Reject | Prevents infinite loop |
| Q11 | Customer declines quote → polite close (`closed_no_action / customer_declined`) | Matches flowchart's "polite close" |
| Q12 | Agent auto-closes natural terminal states; Jill closes everything else; emergencies always Jill | Right authority split |
| Q13 | Prompt editing in dashboard = read-only in V1 | Saves a day for a stretch feature |
| Q14 | Status enum = `new / in_progress / quoted / booked / closed_no_action / closed_done` | Captures success vs abandonment at a glance |
| Q15 | Clarification chips only on borderline priority/scheduled | Avoids extra clicks on clear cases |

### Technical

| ID | Decision | Rationale |
|---|---|---|
| Q16 | No emergency keyword floor — pure LLM | User chose to trust model |
| Q17 | Two JSON files per conversation: `state.json` (business) + `llm_log.json` (LLM); plus global `index.json` | Splits observability from business state; per-conv files eliminate NFR-12 single-concurrency constraint |
| Q18 | Single Conversation LLM + Python services as tools | Fits 2-day build; matches existing services code |
| Q19 | Framework owns the AgentThread; serialized per turn into our log | Single source of truth, framework handles message ordering |
| Q20 | Same Next.js app, two routes (`/`, `/dashboard`) | Single deploy, shared code |
| Q21 | `AgentThread.serialize()` lives in `llm_log.json` | Framework bookkeeping belongs with LLM observability |
| Q22 | `last_turn` displayed in both surfaces, different framings | Dashboard renders full JSON; chat renders only customer-visible pieces |
| Q23 | Tool list: `set_customer_info`, `generate_quote_draft`, `propose_slots`, `confirm_slot`, `close_conversation`, `notify_jill` (+ triage as separate call) | Covers all state transitions in §3 |
| Q24 | `gpt-4.1-nano` for triage, `gpt-4o-mini` (streamed) for conversation | Speed for classification + reliability for tool calls |
