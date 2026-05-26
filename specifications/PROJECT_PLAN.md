# Pipeline Project Plan - Epic-Level Breakdown

**Build Duration:** 2 days (Hackathon)  
**Last Updated:** May 25, 2026  
**Status:** Planning Phase  
**Target:** ~17 high-level epics, max 60 tasks total (14 implementation + 3 design)

---

## Workflow: Design Phase → Implementation Phase

### Phase 1: Design Alignment (Day 1, Hours 0–2) — All epics in parallel
- **D1:** Domain, Data & Observability Models
- **D2:** API & System Architecture  
- **D3:** Dashboard & Chat UI Design

### Phase 2: Implementation (Day 1, Hours 2–7 + Day 2, All) — Parallel by team
- **E1–E14:** Core systems build

---

## Epic Summary (Design + Implementation)

| Epic | Title | Owner | Status | Quality |
|------|-------|-------|--------|---------|
| **D1** | Domain, Data & Observability Models | Mateen | ✅ done | 🥇 gold |
| **D2** | API & System Architecture | Jen / Emeric | ✅ done | 🥇 gold |
| **D3** | Dashboard & Chat UI Design | Calan / Joe | in progress | 🥈 silver -- badge label open |
| **E1** | Infrastructure & DevOps Setup | Emeric | ✅ done | 🥇 gold |
| **E2** | Agent Architecture Implementation | Emeric | 🔴 not started -- blocks E10, E11, E12 -- target for today | -- |
| **E3** | REST API Implementation (FastAPI) | Emeric | designed not built | 🥉 bronze -- scaffold only |
| **E4** | Backend Storage & Persistence | Mateen | started | 🥉 bronze -- E4-2 missing |
| **E5** | Logging, Debug & Observability | Emeric | not started (minimal scope) | -- |
| **E6** | Knowledge Base & System Prompt | Jen | 🟡 in progress -- match top 50 problems in Slack | 🥉 bronze |
| **E7** | Dashboard UI Implementation | Mateen | 🟡 in progress -- rebuild on updated Calan UI | 🥉 bronze |
| **E8** | ~~Chat UI~~ | — | removed | -- |
| **E9** | Triage & Urgency Logic | Joe | ✅ done | 🥇 gold -- tests + demo scenarios |
| **E10** | Scheduling & Calendar Logic | Emeric or Mateen | 🟡 just started (1/4 tasks done) | 🥉 bronze |
| **E11** | Quote Generation & Approval | Jen | not started | -- |
| **E12** | End-to-End Integration & Demo | All | 🔴 blocked -- needs E2 + E6 + E10 + E11 | -- |
| **E13** | Demo Submission | Joe | not started | -- |
| **E14** | Voice & Messaging Channel Integration | Mateen | not started (stretch -- after E12) | -- |

---

## DESIGN PHASE (Day 1, Hours 0–2)

---

## DESIGN EPIC D1: Domain, Data & Observability Models ✅ DONE

**Owner:** Mateen  
**Status:** ✅ done  
**Blockers:** None  
**Deliverables:** Comprehensive data model doc. Object models (Pydantic/dataclasses). Storage schemas. Conversation state machine. Shared understanding across team.

| Task | Details |
|------|---------|
| **D1-1** ✅ | Design business domain entities: `Customer`, `Conversation`, `Quote`, `Booking`, `Message`, `Agent Turn`. Document relationships, required fields, validation rules. |
| **D1-2** ✅ | Design JSON schemas for storage: `interactions.json` structure (sessions, messages, state), `quotes.json` structure (quotes, approvals, versions). Document versioning strategy. |
| **D1-3** ✅ | ~~Observability entity classes~~ -- **Not needed.** MS Agent SDK manages internally. SDK callbacks capture tokens, latency, model. |
| **D1-4** ✅ | Design conversation state machine: states (New, Triaged, Scheduled, Quoted, Approved, Booked, Closed), transitions, terminal states. |

**Deliverables:** 
- `data_models.md` — comprehensive entity definitions
- `storage_schema.yaml` — JSON file structures with examples
- `state_machine.txt` — state diagram
- **All team members understand:** what data flows where, what gets logged, how conversations evolve

**Acceptance:** Design doc reviewed by backend + frontend leads. No ambiguity on field names, types, or structures. Ready for implementation.

---

## DESIGN EPIC D2: API & System Architecture ✅ DONE

**Owner:** Jen / Emeric  
**Status:** ✅ done  
**Blockers:** None  
**Deliverables:** OpenAPI spec. Endpoint contracts. Orchestration choreography. Error handling strategy.

| Task | Details |
|------|---------|
| **D2-1** ✅ | REST API contracts: POST `/chat`, GET `/conversations`, GET `/conversations/{id}`, GET `/quotes/{id}`, POST `/quotes/{id}/review`. |
| **D2-2** 🟡 | Error handling & validation: 400/404/409/422/500 codes + `ErrorResponse` schema defined in `openapi.yaml`. Implementation in `main.py` only has a single 500 handler -- rest not wired yet. Design done, impl incomplete. |
| **D2-3** ✅ | Agent orchestration choreography: sub-agent call sequence, data flow between agents, session state management. |
| **D2-4** ✅ | OpenAPI/Swagger spec (`openapi.yaml`). Session ID handling documented. |

**Deliverables:** 
- `openapi.yaml` — full API spec (importable into Swagger UI)
- `orchestration_flow.txt` — agent choreography diagram
- `error_handling.md` — error codes, messages, client behavior
- **All team members understand:** what APIs exist, what they return, how agents talk to each other

**Acceptance:** OpenAPI spec can be imported into Swagger. Frontend can stub endpoints from spec. Backend understands agent orchestration flow. Zero ambiguity on request/response contracts.

---

## DESIGN EPIC D3: Dashboard & Chat UI Design ✅ DONE

**Owner:** Calan / Joe  
**Status:** ✅ done -- mockups in `specifications/image.png`, `image (1).png`, `image (2).png`, `image (3).png`  
**Blockers:** None  
**Deliverables:** Mockups (Today view, Pipeline view, Conversation detail, Safety escalation view). Joe digitized flow into mermaid.

| Task | Details |
|------|---------|
| **D3-1** ✅ | Dashboard layout: Today view (alert cards, at-a-glance metrics, next up, this week). |
| **D3-2** ✅ | Pipeline view: grouped by Needs you / Customer-side / Booked / Closed. Urgency badges. Inline actions. |
| **D3-3** ✅ | Conversation detail view: transcript, customer info card, safety escalation notice, action buttons. |
| **D3-4** ✅ | Component styling: colors, badges, typography. **OPEN: badge labels -- confirm emergency/priority/scheduled vs L0/L1/L2/L3 before Joe builds.** |
| **D3-5**  | finish design, mockup SMS to plumber | |

**Deliverables:** 
- Figma link (or equivalent design tool) with all screens
- `UI_COMPONENTS.md` — component specs (button sizes, card layouts, input styles)
- `ACCESSIBILITY.md` — WCAG compliance checklist, contrast ratios, keyboard nav
- `STYLE_GUIDE.md` — color palette, typography, spacing rules
- **All team members understand:** what the app looks like, user flows, brand guidelines

**Acceptance:** Design is pixel-perfect. Accessibility checklist passed. Frontend can start implementation without ambiguity. Design is cohesive (same colors, spacing, fonts across screens).

---

## IMPLEMENTATION PHASE (Day 1 Hours 2–7 + Day 2)

---

## EPIC E1: Infrastructure & DevOps Setup ✅ DONE

**Owner:** Emeric  
**Status:** ✅ done  
**Blockers:** None

| Task | Details |
|------|---------|
| **E1-1** ✅ | GCP project setup, Cloud Storage enabled, bucket created. |
| **E1-2** ✅ | Python venv + base dependencies (FastAPI, uvicorn, GCS client, LLM SDK). |
| **E1-3** ✅ | Git repo, `.gitignore`, README. |
| **E1-4** ✅ | LLM decision: OpenAI. Credentials in `.env.local`. |
| **E1-5** ✅ | `local_setup.md` exists. `.env.local.example` exists. Not yet tested end-to-end by a fresh clone. |
| **E1-6** | Model benchmarking: gpt-4o-mini (conversation) vs gpt-4o (quote gen) -- Mateen |

---

## EPIC E2: Agent Architecture Implementation

**Owner:** Emeric or Mateen -- decide at standup  
**Status:** 🔴 not started -- critical blocker, everything else depends on this  
**Blockers:** E1 (done), D2 (done)  
**Reference:** `specifications/agent_design.mermaid` and `PIPELINE_flowchart_mermaid.md` (Joe) -- use these as implementation reference.

| Task | Details |
|------|---------|
| **E2-1** | MS Agent SDK setup + session/thread management. One thread per conversation = one `session_id`. |
| **E2-2** | Conversation Agent: full customer dialogue, continuous urgency classification, decides when to hand off. |
| **E2-3** | Scheduling Agent stub: sends Calendly link with urgency-appropriate framing. |
| **E2-4** | Quote Generator Agent stub: takes job description + customer info, returns structured Quote. |
| **E2-5** | Main Orchestrator: routing logic, conversation state machine, session state management. |

---

## EPIC E3: REST API Implementation (FastAPI) ✅ DONE

**Owner:** Emeric  
**Status:** ✅ done  
**Blockers:** E1 (done), D2 (done)

| Task | Details |
|------|---------|
| **E3-1** ✅ | FastAPI skeleton: `main.py`, router structure, CORS, logging middleware. |
| **E3-2** ✅ | POST `/chat`: accepts message, calls agent, returns reply. |
| **E3-3** ✅ | GET `/conversations`, GET `/conversations/{id}`. |
| **E3-4** ✅ | GET `/quotes/{id}`, POST `/quotes/{id}/review`. |
| **E3-5** ✅ | Wired to storage and agent orchestrator. Error handling in place. |

---

## EPIC E4: Backend Storage & Persistence ✅ DONE

**Owner:** Emeric / Mateen  
**Status:** ✅ done  
**Blockers:** E1 (done), D1 (done)

| Task | Details |
|------|---------|
| **E4-1** ✅ | Pydantic domain entity classes: `Customer`, `Conversation`, `Quote`, `Message`, etc. |
| **E4-2** 🔴 | Storage service methods NOT built. Current `storage.py` writes individual JSON blobs only. Missing: `save_session()`, `get_session()`, `list_sessions()`, `save_quote()`, `get_quote()`. Needs implementation. |
| **E4-3** ✅ | ~~CSV calendar~~ -- replaced by Calendly. Booking record created from `invitee.created` webhook. Fields: `calendly_event_uri`, `calendly_event_uuid`, `start_time`, `end_time`, `booked_slot_text`. |
| **E4-4** ✅ | GCS client integrated (`google.cloud.storage`). Writes JSON blobs to bucket. Working in `storage.py`. |

---

## EPIC E5: Logging, Debug & Observability

**Owner:** Emeric or Mateen  
**Status:** not started (minimal scope -- keep lean)  
**Blockers:** E1 (done)  
**Note:** Basic structured logging is sufficient. Every agent turn + routing decision logged to stdout. Debug panel (E7-6) covers demo-time visibility.

| Task | Details |
|------|---------|
| **E5-1** | ~~Custom observability classes~~ -- not needed. Wire MS Agent SDK callbacks to capture tokens, latency, model. |
| **E5-2** | `utils/logger.py`: structured JSON logging (request ID, timestamp, level, latency). |
| **E5-3** | FastAPI middleware: log every request/response + timing. |
| **E5-4** | Wire logger into agent I/O: every turn, every routing decision logged. |

---

## EPIC E6: Knowledge Base & System Prompt

**Owner:** Jen  
**Status:** 🟡 in progress  
**Blockers:** None (write now, wire in when E2 is ready)  
**Deliverable:** `specifications/system_prompt_draft.md` -- handed to E2 owner to drop into agent `instructions=`.

| Task | Details |
|------|---------|
| **E6-1** | Write plumbing knowledge: 30-50 facts covering common problems, urgency signals, CAD cost ranges, triage questions per problem type. |
| **E6-2** | ~~RAG retrieval~~ -- replaced by system prompt. Knowledge lives directly in Conversation Agent instructions. |
| **E6-3** | Format full system prompt: identity + behavior rules, urgency classification definitions, plumbing knowledge, conversation flow rules (collect name/phone/email, flag unknowns for Jill, 3-sentence max). |
| **E6-4** | Test grounding once E2 is wired: ask edge-case questions, verify agent flags unknowns rather than guessing. |
| **E6-5** | Contractor persona (Jill's Plumbing) -- Owner: Joe. Commit to `specifications/contractor_persona.md`. Feeds into system prompt + dashboard branding. |
| **E6-6** | **[Jen]** Merge Joe's `plumbingtriageknowledgebase.md` from his branch into main before using for E6-1. Joe to resolve any git conflicts on his end first. |
| **E6-7** | **[Jen]** Reconcile service catalogs -- merge `specifications/services_catalog.md` (created Day 2) with any overlapping content in Joe's knowledge base file. One canonical reference, no duplicates. |

---

## EPIC E7: Dashboard UI Implementation

**Owner:** Emeric or Mateen  
**Status:** 🟡 in progress  
**Blockers:** E3 (done), D3 (done)  
**Design reference:** Mockups in `specifications/image.png`, `image (1).png`, `image (2).png`, `image (3).png`.  
**OPEN:** Badge labels -- confirm emergency/priority/scheduled vs L0/L1/L2/L3 before building badges.

| Task | Details |
|------|---------|
| **E7-1** | Next.js layout + styling (Tailwind). |
| **E7-2** | Pipeline list view: grouped sections (Needs you / Customer-side / Booked / Closed), urgency badges, inline approve-quote action. |
| **E7-3** | Conversation detail view: transcript, customer info card, booked slot, safety escalation notice, action buttons. |
| **E7-4** | Quote approval UI: approve/reject/revise buttons, POST to `/quotes/{id}/review`. |
| **E7-5** | Real-time polling: fetch `/conversations` every 3-5 sec. |
| **E7-6** | Debug panel (collapsible): routing decision, urgency label, state before/after, latency. |

---

## EPIC E8: ~~Chat UI~~ -- REMOVED

No customer-facing chat UI in scope. Session management note for the record: backend creates `session_id` on first `POST /chat` and returns it; frontend stores in memory only (no localStorage, no pre-creation).

---

## EPIC E9: Triage & Urgency Logic ✅ DONE

**Owner:** Joe  
**Status:** ✅ done  
**Blockers:** E2 (done), E6 (done), D2 (done)

| Task | Details |
|------|---------|
| **E9-1** ✅ | Triage logic in Conversation Agent. Urgency classified continuously: `emergency`, `priority`, `scheduled`, `out-of-scope`. |
| **E9-2** ✅ | Verified on demo scenarios: "Water everywhere" → emergency, "Hot water tank" → priority, "Dishwasher reinstall" → scheduled, "I need an electrician" → out-of-scope. |
| **E9-3** | Emergency conversations flagged RED in dashboard. (Depends on E7.) |

---

## EPIC E10: Scheduling & Calendar Logic

**Owner:** Emeric or Mateen -- decide at standup  
**Status:** 🟡 just started (E10-1 done, webhook not built)  
**Blockers:** E2 (not started)

| Task | Details |
|------|---------|
| **E10-1** ✅ | Calendly account set up, URL confirmed. `scheduling_url` + `event_type_uri` in `.env`. |
| **E10-2** | Scheduling Agent: sends link to customer with urgency-appropriate framing. Emergency bypasses Calendly entirely. |
| **E10-3** | Calendly webhook handler (`POST /webhooks/calendly`): validate signature, handle `invitee.created` (create Booking, set `booked_slot_text`, update status to Booked) and `invitee.canceled` (status to Cancelled). |
| **E10-4** | End-to-end test in demo scenarios 2 and 3. |
| **E10-5** | **[Joe]** Jill's Plumbing logo -- create/source logo asset. Add to Calendly account profile and dashboard branding. |

---

## EPIC E11: Quote Generation & Approval

**Owner:** Jen  
**Status:** just started  
**Blockers:** E2 (not started), E6 (in progress)

**Approach:** Single targeted quote assuming a proper fix. Agent asks qualifying questions before generating. Quote reads like it came from an experienced plumber -- plain-language caveats, honest about unknowns, not a guaranteed price.

| Task | Owner | Details |
|------|-------|---------|
| **E11-1** | Jen | Qualifying questions before triggering quote: (1) how old is the house, (2) when was kitchen/bathroom last renovated. If job has meaningfully different paths (patch vs. replace part vs. replace whole unit), ask customer preference before quoting. |
| **E11-2** | Jen | Quote Generator sub-agent: single scoped estimate assuming proper fix. Includes: job summary, scope, estimated cost range (CAD), plain-language caveats ("won't know until I look under your sink", "shutoff valves not touched in decades may need replacing too"), confidence score (high/medium/low + one-line reason), standard disclaimer (not a guaranteed quote, final price confirmed on-site), contractor name/number. |
| **E11-3** | Jen | Store quote to GCS, link to conversation by session ID, surface in dashboard with `pending_jill_review` status. |
| **E11-4** | Jen | Notify Jill when quote is ready: SMS + dashboard badge. (Notification Agent per agent_design.mermaid.) |
| **E11-5** | Jen | Contractor approval workflow: **Approve** → status `sent_to_customer`, email sent to customer. **Revise** (with comment) → regenerate updated quote incorporating Jill's note, return to `pending_jill_review`, loop until approved. **Reject** → flag on dashboard for manual follow-up, no customer email. |
| **E11-6** | Jen | Email customer approved quote: job scope, price range, honest caveats, what to expect on the day, appointment slot if booked, contractor contact. MVP = formatted text email, flat file output. |

---

## EPIC E12: End-to-End Integration & Demo

**Owner:** All  
**Status:** 🔴 blocked -- starts when E2 + E6 + E10 + E11 are working  
**Blockers:** All above epics

Scenarios are fully scripted in `specifications/demo_scenarios.md` (Joe). Four scenarios, one per urgency level.

| Task | Details |
|------|---------|
| **E12-1** | Scenario 1 -- emergency: "Water is spraying everywhere, my basement is flooding." → triage returns `emergency`, red badge, Jill alerted, safety guidance, no Calendly, no quote. |
| **E12-2** | Scenario 2 -- priority: "My hot water tank stopped working." → triage returns `priority`, quote drafted, Jill approves, customer accepts, Calendly link sent, booking confirmed via webhook. |
| **E12-3** | Scenario 3 -- scheduled: "I need my dishwasher reinstalled sometime next week." → triage returns `scheduled`, scope collected, Calendly link sent, customer self-books, no quote unless asked. |
| **E12-4** | Scenario 4 -- out-of-scope: "I need an electrician." → triage returns `out-of-scope`, agent closes gracefully, no Calendly, no quote, no Jill alert. Status: Closed. |
| **E12-5** | Performance + polish: response latency under 3 sec, conversational tone, UI polish. |
| **E12-6** | Demo script written. Dry run done. Team signed off. Ready for judges. |

---

## EPIC E13: Demo Submission

**Owner:** Joe / Calan  
**Status:** not started  
**Blockers:** E12 (need working demo before recording)  
**Scheduling note:** Calan NOT available Thursday. Joe/Calan sync scheduled Wednesday 9pm for demo and submission alignment.

| Task | Details |
|------|---------|
| **E13-1** | Storyboard the demo video: 3-minute arc, which scenario shown, who speaks, what the judges see on screen. |
| **E13-2** | Record demo video: all 4 scenarios or best 2-3 for time. Dashboard + agent conversation visible. |
| **E13-3** | Draft submission answers: problem statement, technical approach, novelty, impact, team. |
| **E13-4** | Jen -- digitize pitch/overview PPT slides to mermaid or markdown for submission materials. |
| **E13-5** | **[Joe]** Add out-of-scope (4th) scenario to `specifications/demo_scenarios.md`. Same format as existing 3 -- customer input, expected behaviour, E9 JSON output, dashboard state, acceptance criteria. |
| **E13-6** ✅ | Team emails collected -- already in Slack. |
| **E13-7** | **[Joe]** Pipeline product branding -- logo or wordmark for the product itself (distinct from Jill's Plumbing logo in E10-5). Used in dashboard header and submission materials. |
| **E13-8** | Final review + submit before deadline. |

---

## EPIC E14: Voice & Messaging Channel Integration

**Owner:** Mateen to start, Emeric to help and send some ideas
**Status:** not started -- stretch goal, start only after E12 is green  
**Blockers:** E2, E3 (agent + API must be working first)  
**Note:** The backend is channel-agnostic by design. Text, voice, and Telegram all route to the same `POST /chat` endpoint. The work here is the channel adapter layer, not the agent.

| Task | Details |
|------|---------|
| **E14-1** | **Investigate Telegram.** Telegram Bot API is free, no Twilio account needed, works over webhooks. Set up a bot via BotFather, wire `POST /webhooks/telegram` to receive messages and reply. Customer texts the bot, backend routes to agent, response goes back via Telegram sendMessage. Fastest channel to ship after text. |
| **E14-2** | **Web page voice button (browser STT).** Add a microphone button to the dashboard or a simple demo page. Use the browser's native `SpeechRecognition` API (no external service needed for demo) to capture speech, convert to text, POST to `/chat` as a normal message. Play back agent reply as text (TTS optional). Works in Chrome without any API key. |
| **E14-3** | **Voice with STT/TTS service (if time).** Replace browser STT with Deepgram (STT) for better accuracy. Add ElevenLabs or Google TTS for spoken replies. Requires API keys and slightly more latency budget. Do not start until E14-2 is working. |
| **E14-4** | **Telegram demo scenario.** Run at least one demo scenario (priority -- hot water tank) end to end via Telegram. Confirm agent replies, Calendly link is clickable in Telegram, quote flow works. |

**Decision point before starting E14-2:** Browser `SpeechRecognition` is Chrome-only and requires HTTPS. For a live demo on a projected screen, test it works in the demo environment before committing.

---

## Dependencies & Parallelization

```
DESIGN PHASE (Day 1, Hours 0–2) — ALL IN PARALLEL:
  D1 (Data Models)          ──→ Unblocks E4, E5, E9, E10, E11
  D2 (API & Orchestration)  ──→ Unblocks E2, E3, E9, E11
  D3 (UI Design)            ──→ Unblocks E7, E8

INFRASTRUCTURE (Hour 1–2):
  E1 (Infrastructure)  ──→ Unblocks all implementation epics

IMPLEMENTATION PHASE (Hours 2–7 + Day 2) — PARALLEL BY TEAMS:
  
  Backend Track (can run parallel):
    E3 (API) depends on: E1, D2, E2, E4, E5
      └─ E4 (Storage) depends on: E1, D1
      └─ E5 (Logging) depends on: E1, D1
      └─ E9 (Triage) depends on: E2, E6, D2
      └─ E10 (Scheduling) depends on: E2, E4, D1
      └─ E11 (Quoting) depends on: E2, E6, D1, D2
  
  Frontend Track (can run parallel):
    E7 (Dashboard) depends on: E3, D3
    E8 (Chat UI) depends on: E3, D3
  
  Feature Logic (can run parallel):
    E2 (Agent) depends on: E1, D2
    E6 (Knowledge Base) depends on: E1
  
  Demo Phase (sequential):
    E12 (Integration & Demo) depends on: All above
```

---

## Time Estimation by Day

| Deliverable | Day 1 Target | Day 2 Target | Total |
|-------------|-------------|-------------|-------|
| **E1–E8** (Foundation + Design) | ✅ Complete | — | ~8 hours |
| **E2–E7, E9–E13** (Core Systems + Features) | ✅ Complete | — | ~20 hours |
| **E14** (Integration & Demo) | — | ✅ Complete | ~4 hours |
| **Buffer/Contingency** | — | ✅ Reserve | ~2 hours |

**Total:** ~34 hours of work across ~6–8 people, 2 days.

---

## Team Assignments (3 Design + 12 Implementation Epics for 8–10 People)

### Design Phase (Day 1, Hours 0–2) — All in parallel

| Epic | Owner | Start | End | Notes |
|------|-------|-------|-----|-------|
| **D1** | Data Architect | D1 Hr 0 | D1 Hr 1.5 | Data models, state machine, observability schema |
| **D2** | API Architect | D1 Hr 0 | D1 Hr 1.5 | API contracts, orchestration flow, error handling |
| **D3** | Design Lead | D1 Hr 0 | D1 Hr 1.5 | Dashboard, chat UI, component specs, styling |

### Implementation Phase (Day 1, Hours 2–7 + Day 2)

| Epic | Owner | Depends On | Start | End | Notes |
|------|-------|-----------|-------|-----|-------|
| **E1** | Platform Lead | None | D1 Hr 1.5 | D1 Hr 3 | Infrastructure first, unblocks all. |
| **E2** | Agent Architect | E1, D2 | D1 Hr 2 | D1 Hr 4 | Agent implementation per D2 choreography. |
| **E3** | Backend Lead | E1, D2 | D1 Hr 2 | D1 Hr 5 | API per D2 spec, integrates E2, E4, E5. |
| **E4** | Storage Lead | E1, D1 | D1 Hr 2 | D1 Hr 4.5 | Storage per D1 schema, entity models. |
| **E5** | DevOps/Backend | E1, D1 | D1 Hr 2 | D1 Hr 3.5 | Logging per D1 observability schema. |
| **E6** | Product/Domain | E1 | D1 Hr 2 | D1 Hr 3.5 | Knowledge base (independent). |
| **E7** | Frontend Lead | E3, D3 | D1 Hr 3 | D1 Hr 5.5 | Dashboard per D3 design, uses E3 API. |
| **E8** | Frontend Lead | E3, D3 | D1 Hr 3 | D1 Hr 5.5 | Chat UI per D3 design, parallel with E7. |
| **E9** | Agent/Backend | E2, E6, D2 | D1 Hr 3 | D1 Hr 4.5 | Triage logic, uses D2 spec. |
| **E10** | Backend Lead | E2, E4, D1 | D1 Hr 3.5 | D1 Hr 5 | Scheduling logic, per D1 state machine. |
| **E11** | Agent/Backend | E2, E6, D1, D2 | D1 Hr 4 | D1 Hr 6 | Quote generation, per D1 Quote model. |
| **E12** | QA/Integration | All above | D2 Hr 0 | D2 Hr 4 | End-to-end demo, perf tuning, dry run. |

---

## Recommended Team Composition (8–10 People)

**Design Phase (Hours 0–2):**
- **1 Data Architect** → D1 (creates data models, observability schema, state machine)
- **1 API Architect** → D2 (creates API spec, orchestration flow)
- **1 Design Lead** → D3 (creates UI/UX design, component specs)

**Implementation Phase (Hours 2–7 + Day 2):**
- **1 Platform/DevOps Lead** → E1, E5 (infrastructure + logging)
- **1 Backend Lead** → E3, E4, E10 (API, storage, scheduling)
- **1 Agent/AI Lead** → E2, E9, E11 (agent implementation, triage, quoting)
- **1 Product/Domain Lead** → E6 (knowledge base, domain logic)
- **1–2 Frontend Leads** → E7, E8 (dashboard + chat UI implementation)
- **1 QA/Integration Lead** → E12 (demo, integration, polish)

**Total: 3 designers (Day 1 Hrs 0–2) + 8 implementers (Day 1 Hrs 2–7 + Day 2). Designers can support implementation after Hour 2.**





---

## Daily Standup Checklist (Epic-Level)

### Day 1 Morning Kickoff (Hour 0)

- [ ] **D1, D2, D3 assigned** (design leads start immediately)
- [ ] **E1 assigned** (infrastructure starts immediately)
- [ ] Team aligned on decision gates: OpenAI vs GCP model, knowledge base approach, email MVP strategy
- [ ] All team members have repo access, can clone code

### Day 1 Mid-Morning Status (Hour 2)

- [ ] **D1, D2, D3 complete** ✅ (design phase done)
- [ ] **E1 complete or 80% done** ✅ (infrastructure ready)
- [ ] Designers transition to support roles (code review, answer questions)
- [ ] Implementation teams ready to start E2–E11

### Day 1 Noon Status (Hour 4)

- [ ] **E1 complete** ✅ (infrastructure ready)
- [ ] **E2, E4, E5, E6 at 50%+ done** (in progress)
- [ ] **E3, E7, E8 started** (API + frontend)
- [ ] **E9, E10, E11 queued or started** (depends on E2, E4 progress)
- [ ] Zero blockers on critical path

### Day 1 End-of-Day (Hour 7)

- [ ] **E1–E6 complete** (infrastructure, storage, logging, KB done)
- [ ] **E2, E3 at least 80% done** (agent + API mostly working)
- [ ] **E7, E8 at least 50% done** (frontend UI in progress)
- [ ] **E9, E10, E11 started or 50%+ done** (feature logic in progress)
- [ ] No blockers preventing Day 2 integration

### Day 2 Morning (Hour 0)

- [ ] **E2–E11 complete** (all implementations done, all features working)
- [ ] **E12 ready to begin** (integration lead takes over)

### Day 2 Noon (Hour 4)

- [ ] **E12-1, E12-2, E12-3 complete** (all 3 demo scenarios tested end-to-end)
- [ ] All scenarios repeatable and stable

### Day 2 End-of-Day (Hour 8)

- [ ] **E12-4, E12-5 complete** ✅ (performance tuned, demo script ready, dry run passed)
- [ ] No errors in logs. All three scenarios work reliably.
- [ ] **Ready to ship.**

---

## Recommended Work Cadence

### Day 1: Design First, Then Build

**Hours 0–2 (Design Phase — All in parallel):**
- **3 designers** work on D1, D2, D3 in parallel
- **1 DevOps** works on E1 (infrastructure) in parallel
- **At 2-hour mark:** Design complete, infrastructure ready, all teams aligned

**Hours 2–7 (Implementation Phase — Parallel tracks):**
- **Backend track:** E3, E4, E5 (core infrastructure)
- **Frontend track:** E7, E8 (dashboard, chat UI)
- **Agent track:** E2, E9, E11 (agent + logic)
- **Feature track:** E10, E6 (scheduling, KB)
- **All tracks:** leverage D1, D2, D3 designs + E1 infrastructure

**Day 1 Goal:** 
- ✅ D1–D3 complete (design locked)
- ✅ E1–E6 complete (infrastructure, storage, logging, KB)
- ✅ E2, E3 at 80%+ (agent + API mostly working)
- ✅ E7, E8 at 50%+ (frontend in progress)
- ✅ E9–E11 in progress (feature logic)

### Day 2: Integration & Polish

**Hours 0–3 (Finish Implementation):**
- Complete E2–E11 (any remaining work)
- Final QA checks

**Hours 3–6 (E12 Integration):**
- Run all 3 demo scenarios end-to-end
- Fix any integration issues
- Performance tuning

**Hours 6–8 (Polish & Demo Prep):**
- Dry run with team
- Final sign-off

**Day 2 Goal:**
- ✅ All 3 scenarios work reliably
- ✅ Performance: < 3 sec per turn
- ✅ Demo script rehearsed
- ✅ Ready for judges

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Customer / Contractor                    │
│   (Browser: /chat for customer, /dashboard for contractor)      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP(S)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js Frontend Server                       │
│  (/chat route, /dashboard route, static assets)                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ API calls: /chat, /conversations, /quotes
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend Server                      │
│  (Routers: chat, conversations, quotes)                         │
│  (Middleware: logging, validation, error handling)              │
└──────────────┬────────────────────────────┬──────────────────────┘
               │                            │
               ▼ (orchestration)            ▼ (persistence)
     ┌─────────────────────┐      ┌──────────────────────┐
     │ MS Agent Framework  │      │ Storage Service      │
     │ - Orchestrator      │      │ - Google Storage GCS │
     │ - Sub-Agents        │      │ - Flat JSON files    │
     │   * Conversation    │      └──────────────────────┘
     │   * Scheduling      │      ┌──────────────────────┐
     │     (Calendly link) │      │ Calendly API v2      │
     │   * Quote Gen       │
     │ - Session mgmt      │
     │ - LLM calls         │
     │   (OpenAI or GCP)   │
     └─────────────────────┘
           │ (knowledge base query)
           ▼
     ┌──────────────────┐
     │ Knowledge Base   │
     │ (Plumbing Q&As)  │
     └──────────────────┘
```

---

---

## Open Decisions (Blocking)

From spec, these must be decided before full build starts:

1. **LLM Choice:** OpenAI (GPT-4, GPT-4-turbo) or GCP (Vertex AI, Gemini)? → Task **INFRA-05**
2. **Knowledge Base Source:** Hand-craft Q&As or scrape public plumbing site? → Task **KB-01**
3. **Emergency Alert:** Dashboard flag only, or add simulated Slack/email to contractor? → Task **TRIAGE-04** (optional)
4. **Contractor Persona:** Use real name or placeholder? → Task **PERF-05** (impacts credibility)
5. **Email MVP:** Flat file output or wire SMTP? → Task **QUOTE-04** (file = safe, SMTP = nicer demo)

---

## Success Criteria

✅ **All three demo scenarios run end-to-end without manual intervention.**  
✅ **Agent responds in < 3 seconds per turn.**  
✅ **Conversations persist to storage and are visible in contractor dashboard.**  
✅ **Quotes are generated and contractor can approve/reject.**  
✅ **Emergency path (scenario 1) is visually distinct and alerts contractor immediately.**  
✅ **Code is clean, logged, and ready to hand off post-hackathon.**  
✅ **Team is confident to demo to judges with no surprises.**

---

## Appendix: Quick Reference

### Key File Locations (TBD)

```
tmls-pipeline/
├── backend/
│   ├── main.py                      # FastAPI app entry
│   ├── routers/
│   │   ├── chat.py                  # POST /chat
│   │   ├── conversations.py         # GET /conversations
│   │   └── quotes.py                # POST /quotes, GET /quotes/{id}
│   ├── models/
│   │   ├── schemas.py               # Pydantic models
│   │   └── domain.py                # Business logic models
│   ├── services/
│   │   ├── agent.py                 # Orchestrator + sub-agents
│   │   ├── storage.py               # Persistence layer
│   │   ├── knowledge_base.py         # KB retrieval
│   │   ├── calendly.py              # Calendly webhook handler + link delivery
│   │   └── quoting.py                # Quote generation (E13)
│   ├── utils/
│   │   └── logger.py                # Logging utility (E6)
│   └── requirements.txt             # Dependencies
│
├── frontend/
│   ├── pages/
│   │   ├── /chat.js                 # Customer chat (E10)
│   │   └── /dashboard.js            # Contractor dashboard (E9)
│   ├── components/
│   │   ├── ChatUI.js                # Chat component
│   │   ├── ConversationList.js      # Dashboard list
│   │   └── QuoteReview.js           # Quote approval
│   └── styles/
│       └── globals.css
│
├── data/
│   ├── .env.local.example           # CALENDLY_SCHEDULING_URL, CALENDLY_EVENT_TYPE_URI, CALENDLY_WEBHOOK_SECRET
│   ├── knowledge_base.yaml          # Plumbing Q&As
│   └── contractor_profile.yaml      # "Jill's Plumbing" info
│
├── .env.local.example               # Template for secrets
├── .gitignore
├── README.md                        # Setup + run instructions
└── PROJECT_PLAN.md                  # This file
```

---

## What Gets Designed in Phase 1 (D1–D3)

### D1: Domain, Data & Observability Models
- **Business entities:** Customer, Conversation, Quote, Booking, CalendarSlot, Message, AgentTurn
- **Relationships:** How conversations link to quotes, how bookings reference calendar slots, etc.
- **Storage schemas:** JSON structure for persistence, versioning approach
- **Observability:** What gets logged (inputs, outputs, metadata, reasoning, latency, tokens)
- **State machine:** Conversation lifecycle (new → triaged → scheduled → quoted → booked → closed). Note: "approved" is a Quote status, not a Conversation status.
- **Urgency levels:** `emergency` / `priority` / `scheduled` / `out-of-scope` (tracked continuously, not classified once). Emergency bypasses normal flow. Priority and scheduled proceed to quoting and booking. Out-of-scope ends conversation with no handoff.
- **Validation rules:** What makes a valid customer, quote, booking, etc.

**Why it matters:** All backend, storage, and logging teams use this single definition. No ambiguity on data flow.

---

### D2: API & System Architecture
- **REST API contracts:** Endpoints, request/response payloads, HTTP status codes
- **Error handling:** Standard error response format, error codes, what errors are possible
- **Agent orchestration:** Which sub-agents are called in what order, what data flows between them
- **State & session management:** How to maintain conversation state across turns
- **Rate limiting & throttling:** If needed

**Why it matters:** Frontend teams can stub endpoints immediately. Backend teams know exactly what to build. Zero guessing.

---

### D3: Dashboard & Chat UI Design
- **Contractor dashboard:** Layout, conversation list, detail view, filter/search, urgency badges (red for emergency)
- **Chat UI:** Customer-facing message display, input form, typing indicator, loading states, error handling
- **Component library:** Buttons, cards, inputs, modals — all with consistent styling
- **Accessibility:** Contrast ratios, keyboard navigation, focus states
- **Responsive design:** Mobile, tablet, desktop — all work

**Why it matters:** Frontend team has pixel-perfect reference. No rework. Designers can review implementation against spec.

---

## Decision Gates (Must Resolve Before Build Starts)

These decisions are **blocking** — resolve them before Day 1 Hour 1.

| Gate | Options | Impact | Owner | Target |
|------|---------|--------|-------|--------|
| **LLM Choice** | OpenAI (GPT-4, GPT-4-turbo) vs GCP (Vertex AI, Gemini) | Latency, cost, API style, prompt engineering | E1 Owner + D2 | D1 Hr 0.5 |
| **Knowledge Base Source** | Hand-craft 30–50 Q&As vs scrape public plumbing site | Time investment, control over content, accuracy | E6 Owner + D1 | D1 Hr 0.5 |
| **Email MVP** | Flat file output vs wire real SMTP/SendGrid | Demo polish, MVP scope, time budget | E11 Owner + D2 | D1 Hr 1 |
| **Emergency Alert Strategy** | Dashboard red badge only vs add simulated Slack/SMS | Demo impact, scope creep, judging criteria | E9 Owner + D3 | D1 Hr 1 |
| **Contractor Persona** | Use Jill's Plumbing as the contractor persona (resolved) | Credibility on stage, detail level | E12 Owner + D3 | D1 Hr 1 |

---

## Success Criteria (Definition of Done)

### Design Phase (D1–D3)
✅ **D1, D2, D3 complete within 2 hours. All team members reviewed + signed off.**  
✅ **Zero ambiguity on:** data models, API contracts, UI/UX design.  
✅ **Designers have communicated:** blockers, constraints, decisions to implementation teams.

### Implementation Phase (E1–E11)
✅ **All implementations follow D1–D3 designs without deviation.**  
✅ **E1–E6 complete by Hour 4 of Day 1.** (infrastructure, storage, logging, KB ready)  
✅ **E2, E3 at 80%+ by Hour 7 of Day 1.** (agent + API core working)  
✅ **E7–E11 at 50%+ by Hour 7 of Day 1.** (frontend + feature logic in progress)

### Integration & Demo (E12)
✅ **All three demo scenarios run end-to-end without manual intervention.**  
✅ **Agent responds in < 3 seconds per turn.**  
✅ **Conversations persist and are visible in dashboard (real-time polling).**  
✅ **Quotes are generated automatically. Contractor can approve/reject from dashboard.**  
✅ **Emergency path is visually distinct (red badge per D3 design) and alerts contractor immediately.**  
✅ **Code is logged per D1 observability schema. All agent I/O captured. Debuggable.**  
✅ **Repo is clean (no secrets, LLM keys in .env.local, not committed).**  
✅ **Team has rehearsed demo 2+ times. No surprises on stage.**

---

## Testing Checklist (Final E14)

### Scenario 1: Emergency
```
Input: "Water is spraying everywhere, my basement is flooding"
Expected Behavior:
  ✅ Agent recognizes emergency within first 2 turns
  ✅ Urgency = emergency
  ✅ Dashboard conversation shows red badge
  ✅ Agent offers immediate first-step advice ("turn off water main")
  ✅ Contractor is notified (dashboard flag or alert)
  ✅ No quote generated (or marked as DRAFT pending contractor approval)
  ✅ Conversation persisted to storage
```

### Scenario 2: Routine Service
```
Input: "My hot water tank stopped working"
Expected Behavior:
  ✅ Agent asks follow-up questions (age, any noises, gas/electric, etc.)
  ✅ Urgency = priority
  ✅ Agent sends Calendly scheduling link
  ✅ Customer books via Calendly self-serve
  ✅ Webhook confirms booking, Booking record created with booked_slot_text
  ✅ Agent generates quote (job: water tank repair/replacement, est. cost range)
  ✅ Contractor sees conversation + quote in dashboard
  ✅ Contractor approves quote
  ✅ Quote is ready to send to customer
  ✅ Entire flow takes < 5 minutes in real-time
```

### Scenario 3: Scheduled Work
```
Input: "I need my dishwasher reinstalled"
Expected Behavior:
  ✅ Agent gathers scope (current status, timeline preference, etc.)
  ✅ Urgency = scheduled
  ✅ Agent sends Calendly scheduling link
  ✅ Customer books via Calendly self-serve
  ✅ Agent generates quote (job scope, estimated labor + parts, cost)
  ✅ Contractor reviews + approves quote
  ✅ Conversation status: New → In Progress → Quoted → Booked
  ✅ All data persists; dashboard updates in real-time
```

---

## Stretch Goals (If Time Permits)

If Day 2 integration finishes early:

- **SMS Channel (E15):** Add `/sms` endpoint. Simulated Twilio webhook. Route SMS to agent, respond back. ~1.5 hours.
- **Prompt Refinement UI (E16):** Contractor can edit agent prompts in dashboard. Changes take effect on next message. ~1 hour.
- **Analytics Dashboard (E17):** Show metrics: total inquiries, booking rate, avg response time. ~1.5 hours.
- **Multi-Trade Config (E18):** Load different knowledge bases + triage questions per trade (plumbing, electrical, HVAC). ~2 hours.

---

**Document Owner:** Project Lead  
**Last Updated:** May 25, 2026  
**Version:** Epic-Level (17 epics: 3 Design + 12 Implementation + 1 Integration, ~60 tasks)  
**Next Review:** Daily standup (start of each day)

---

## Design-First Approach: Why It Matters

### The Problem with Ad-Hoc Design
- Backend team builds API without frontend knowing endpoint contracts → rework
- Frontend team designs UI without backend constraints → incompatible layouts
- Agent team decides on state machine without storage team input → impedance mismatch
- Everyone guesses on data models → inconsistent field names, types, validations

### The Solution: Design Phase (D1–D3, Hours 0–2)

**All three design epics run in parallel. When complete, the entire team has:**
1. **Shared data model** (D1) — everyone speaks the same language about Customer, Conversation, Quote, etc.
2. **Locked API contract** (D2) — frontend can stub endpoints, backend knows exactly what to build
3. **Pixel-perfect UI spec** (D3) — frontend doesn't wonder "what should this look like?"

### Benefits for Team Communication

**Designers → Implementation Teams:**
- D1 Lead publishes: `data_models.md`, entity diagrams, state machine flow
- D2 Lead publishes: `openapi.yaml`, orchestration choreography, error codes
- D3 Lead publishes: Figma link, `UI_COMPONENTS.md`, `STYLE_GUIDE.md`, accessibility checklist
- **Team can now work independently without constant back-and-forth.**

**Implementation Teams → Designers (async feedback loop):**
- If E3 (Backend) discovers API needs adjustment → message D2, get async decision
- If E7 (Frontend) needs clarity on button styling → reference D3 spec, ask design lead if needed
- If E4 (Storage) needs to validate Quote model → use D1 spec as source of truth
- **Designers are available for questions but not blocking day-to-day coding.**

**Integration Lead (E12) → All Teams:**
- Uses D1 state machine to validate transitions
- Uses D2 API spec to verify endpoints return correct format
- Uses D3 design to QA UI pixel-perfect implementation
- **Dry run has zero surprises because everyone followed the same blueprint.**

---

## Key Alignment Documents (Deliverables from D1–D3)

| Epic | Deliverable | Format | Audience | Used By |
|------|------------|--------|----------|---------|
| **D1** | `data_models.md` | Markdown | All teams | E4, E5, E9, E10, E11, E12 |
| **D1** | Entity diagrams (Miro/Figma) | Visual | Backend, Storage | E4 implementation |
| **D1** | `state_machine.txt` | Diagram | All teams | E12 validation, acceptance testing |
| **D2** | `openapi.yaml` | OpenAPI 3.0 | Backend, Frontend | E3, E7, E8, E9–E11 |
| **D2** | Orchestration flow diagram | Miro/draw.io | Agent, Backend | E2, E9–E11 |
| **D2** | `error_handling.md` | Markdown | Backend, Frontend QA | E3, E7, E8, E12 |
| **D3** | Figma/design tool link | Design tool | Frontend, Designers | E7, E8, E12 |
| **D3** | `UI_COMPONENTS.md` | Markdown | Frontend | E7, E8 implementation |
| **D3** | `STYLE_GUIDE.md` | Markdown | Frontend, Design QA | E7, E8, E12 |
| **D3** | `ACCESSIBILITY.md` | Checklist | Frontend, QA | E7, E8, E12 validation |

---

## Communication During Implementation (Hours 2+)

### Daily Standup Pattern
**09:00 AM:** 5-min standup
- Any blockers on design?
- Any questions about D1/D2/D3?
- Any integration concerns?

**If blocker arises:**
- Async Slack: tag relevant design lead (designer available for quick decision)
- Designers prioritize blocking questions over design refinement
- Decision documented in appropriate design deliverable

### Integration Lead's Role (E12)
- Validates every implementation against design spec (D1–D3)
- Flags deviations: "This button doesn't match D3 spec" or "State machine transition missing per D1"
- Ensures no surprises at demo

---

## Why This Matters for a Hackathon

**Time is precious.** 
- Without design alignment: 20+ hours wasted on rework, back-and-forth, inconsistency
- With design alignment: 4–6 hours gained by knowing exactly what to build, how to build it, and how it all fits together

**Demo credibility.**
- Without design: Inconsistent UI, half-finished features, unclear state transitions → looks amateur
- With design: Pixel-perfect implementation, consistent brand, clear user flows → looks professional

**Team morale.**
- Without design: "I built this, but now I have to tear it down?" → frustration
- With design: "I know exactly what to build" → confidence, momentum, celebration when it works

---

**Design Phase is not overhead. It's the scaffolding that makes the build fast, parallel, and reliable.**

---

**Document Owner:** Project Lead  
**Last Updated:** May 25, 2026  
**Version:** Epic-Level (17 epics: 3 Design + 12 Implementation + 1 Integration, ~60 tasks)  
**Next Review:** Daily standup (start of each day)
