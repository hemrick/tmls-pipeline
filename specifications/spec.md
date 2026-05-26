# Pipeline -- App Specification
**Hackathon Draft v0.3 | May 25, 2026**

---

## Overview

Pipeline is an AI-first office assistant for skilled trades small businesses. The core problem: owner-operators are working on job sites while potential customers are calling, texting, or emailing -- and not getting answered. Missed calls = lost revenue. Pipeline acts as a 24/7 AI intake agent that handles customer inquiries, triages urgency, offers appointment slots, and sends quotes -- so the tradesperson lands the job without stopping work.

**Demo scope:** Plumbing only. One trade, done well, is the right call for a 2-day build.

**App name:** Pipeline (deliberate double meaning: plumbing + sales pipeline / intake queue)

**Competitors (none are AI-native):** Jobber, ServiceTitan, Workiz

---

## Hackathon Judging Criteria Alignment

| Criterion | How Pipeline addresses it |
|---|---|
| Impact / usefulness | Solves a real, high-frequency revenue problem for a large underserved market |
| Technical execution | Agent orchestration, triage logic, invoice gen, Calendly booking, persistent storage |
| Demo quality | Three scripted scenarios with a live chat UI and contractor dashboard |
| Novelty / creativity | AI-native from the ground up; no existing product does this end-to-end |
| Shipping mindset | Scoped hard: one trade, text-first, Calendly booking, three demo scenarios |

---

## Demo Scenarios (use these to script the walkthrough)

Three scenarios must work end-to-end for the demo:

1. **Emergency** -- "Water is spraying everywhere, my basement is flooding." Agent detects emergency, escalates immediately, prompts contractor alert, offers to stay on the line for first steps.
2. **Routine service** -- "My hot water tank stopped working." Agent gathers details, sends a Calendly booking link, client self-books, agent confirms and sends quote via email.
3. **Scheduled work** -- "I need my dishwasher reinstalled." Agent scopes the job, collects contact info, books a slot, confirms via email.

---

## Mandatory MVP Features

### F1 -- AI Customer Intake Agent (Text Chat)

The primary interface for the hackathon. Customers interact with the agent via a text chat UI.

- Agent greets the customer and identifies itself as an AI assistant (never pretends to be human)
- Asks short, plumbing-specific triage questions -- not a generic FAQ bot
- Responses must be concise: short sentences, no essays, conversational pacing
- Conversation is stateful within a session (remembers context)
- Collects: customer name, contact info (phone + email), description of problem, any relevant details

### F2 -- Urgency Triage

The agent must distinguish between emergency and non-emergency requests and route accordingly.

- Detects explicit emergency signals ("flooding", "water everywhere", "no water", "no hot water", "gas smell")
- Detects implicit urgency from tone or description
- Urgency is classified continuously throughout the conversation, not just once at intake
- **emergency** -- active damage, safety risk, no water, gas smell, sewage backup. Bypasses normal flow. Jill alerted immediately. Agent offers first-step safety guidance. No Calendly link sent.
- **priority** -- uncomfortable but contained (no hot water, slow drain, minor leak). Normal flow. Calendly link sent after intake, customer prompted to book earliest slot.
- **scheduled** -- planned work (reinstall, replacement, inspection). Normal flow. Calendly link sent after scoping.
- **out-of-scope** -- wrong trade, out of service area, or safety emergency requiring 911. Agent ends conversation gracefully, no Jill notification, status set to `closed`.
- Emergency path: red badge in dashboard, Jill alerted immediately, no quote or booking initiated
- Priority / scheduled path: proceeds to quoting and Calendly booking flow
- Out-of-scope path: agent explains and closes, no further action

### F3 -- Availability and Scheduling (Calendly)

The contractor configures a Calendly event type for their appointment bookings. The agent sends the client a Calendly scheduling link. The client self-books. Calendly notifies the backend via webhook, which updates the project state.

- Agent collects enough context to determine urgency before offering the link
- For urgent: agent sends the link immediately with a note to book the earliest available slot
- For non-urgent: agent sends the link after scoping the job
- Calendly webhook (`invitee.created`) received by FastAPI, updates Booking + Project status to Booked
- Calendly webhook (`invitee.canceled`) received by FastAPI, resets Booking status to Cancelled
- Booked slot details (date, time as human-readable text, Calendly event URI) stored on the Booking record and shown on dashboard
- Contractor is notified on dashboard when a booking is confirmed via webhook

**Calendly account setup (must be done before demo):**
- Create a free Calendly account (Basic plan is sufficient -- 1 event type)
- Create one event type: e.g., "Plumbing Consultation" -- 60 or 90 min
- Set buffer time: minimum 30 min after each event (travel time between job sites)
- Set available hours to realistic working hours (e.g., Mon-Fri 8am-5pm)
- Register the FastAPI webhook URL in Calendly (requires deployed backend -- not localhost)
- Copy the `scheduling_url` and `event_type_uri` into the app config / `.env`

### F4 -- Quote and Invoice Generation

After scoping the job via conversation, the agent generates a structured quote.

- Agent asks for and captures customer email address during intake
- PDF Quote includes: job description, estimated scope, estimated cost range, contractor name/contact, disclaimer that final price is confirmed on-site
- sends a SMS and email to plumber that a quote is ready for review
- plumber can :approve, reject or revise (with a comment) the quote
- if approved - email quote to client
- if revised- generate updated qutoe to plumber
- if rejected - flag on dashbaord for plumber to do manually
- Quote is formatted clearly (not a wall of text) with a logo, contractor contact info, contractor number
- **Delivery:** After approved, quote is emailed to the customer at the email address collected during intake

- Sends quote/confirmation email to customer at end of conversation
- Email includes: appointment slot, job scope, what to expect, contractor contact info, quoted price
 
### F5 -- Plumbing Knowledge (System Prompt)

Plumbing domain knowledge is included directly in the Conversation Agent system prompt. No retrieval layer.

- Knowledge authored as a structured section of the system prompt: common problems, urgency signals per problem type, typical cost ranges, triage questions to ask
- Simpler and faster than RAG for the hackathon scope -- the knowledge set is small enough to fit in context
- Agent must stay grounded in the prompt content -- if a question is outside the knowledge provided, it says so and flags the conversation for Jill to follow up, rather than guessing
- Knowledge prompt is editable by the contractor via the dashboard (F6) to refine over time
 

### 6 -- Contractor Dashboard ("The Pipeline")

A simple web view the contractor opens to see their incoming inquiries and current status.

- List of all incoming conversations with: customer name, timestamp, problem summary, urgency flag, status
- Status values: New, In Progress, Quoted, Booked, Closed
- Each row expandable to show full conversation transcript and generated quote and proposed schedule
- Emergency-flagged entries are visually distinct (e.g., red badge)
- Dashboard updates in near-real time (polling acceptable for hackathon)
- No login/auth required for demo -- single contractor view
- contractor can edit all of the propmpts to refine over time

---

## Nice to Have Features (stretch goals -- build only if core is solid)

These are explicitly deferred but are in the architecture diagram. Text chat must be working end-to-end before any of these are touched. They are designed as layers on top of the core, not replacements for it.

| Feature | Notes |
|---|---|
| **Phone channel (STT / TTS via Twilio)** | Customer calls a Twilio number. Speech-to-API service converts voice to text, sends to FastAPI backend, response converted back to speech. Requires a Twilio account, a provisioned number, webhook config, and a low-latency STT/TTS model (e.g., Deepgram for STT, ElevenLabs or Google TTS). Do not start this until text chat is done. |
| **SMS channel (Twilio)** | Customer texts a Twilio number. Twilio webhook delivers message to FastAPI backend. Agent responds via SMS. Same Twilio account as phone, simpler than voice. Still non-trivial to wire -- ngrok or deployed URL needed for webhook. |
| Real-time Calendly availability display | Show available slots inline in chat rather than redirecting to Calendly link. Requires Calendly `GET /event_type_available_times` polling. |
| Inbound email channel | Customer emails info@[contractor].com, agent processes and responds |
| Photo / image intake | Customer sends a photo of the problem via SMS MMS. Agent acknowledges and routes image to contractor dashboard. |
| Multi-trade support | Configuration layer that swaps out the knowledge base and triage questions per trade |
| Contractor onboarding questionnaire | 20-question setup flow that generates a custom FAQ and seeds the RAG |
| Analytics / conversion dashboard | Inquiry-to-booking conversion rate, response time, revenue influenced |
| Full invoice workflow | Post-job invoice with actual line items, tracked for payment |
| Contractor mobile alert | Push notification or SMS to contractor phone on emergency triage |

## Out of Scope (explicitly not in this build)

- Authentication / multi-user / multi-contractor
- Payment processing
- Mobile app
- Any trade other than plumbing
- Displaying available slots inline in chat (Calendly link is sufficient for MVP)
- Compliance / legal disclaimer generation (add a static boilerplate)
- Invoicing based on actual time spent and parts

---

## Functional Requirements Summary

| ID | Requirement |
|---|---|
| FR-01 | The agent must identify itself as AI at the start of every conversation |
| FR-02 | The agent must ask plumbing-specific triage questions, not generic ones |
| FR-03 | The agent must classify urgency within the first 2-5 turns |
| FR-04 | Emergency conversations must be flagged and surfaced immediately in the dashboard |
| FR-05 | The agent must collect customer name, email, phone, and problem description before closing |
| FR-06 | The agent must send a Calendly scheduling link to the client at the appropriate point in the conversation |
| FR-06b | The backend must expose a webhook endpoint to receive Calendly `invitee.created` and `invitee.canceled` events and update booking state accordingly |
| FR-07 | A quote must be generated and emailed to the customer before the conversation ends |
| FR-08 | All conversations must be persisted to the database |
| FR-09 | The contractor dashboard must display all conversations with status and urgency |
| FR-10 | Agent responses must be short and conversational -- no paragraph-length answers |
| FR-11 | **[Nice to Have]** Voice -- customer will speak and get answered back both in text and speech. Requires STT + TTS service (see Nice to Have section). |


---

## Non-Functional Requirements

| ID | Requirement | Notes |
|---|---|---|
| NFR-01 | Response latency | Agent must respond within 3 seconds for non-voice. No 30-second waits. |
| NFR-02 | Conversation quality | Short, natural responses. If it sounds like a press-1-for-billing IVR, it has failed. |
| NFR-03 | Persistence | All conversations, quotes, and booking state stored in JSON flat files on Google Storage (interactions.json and quotes.json). See NFR-12 re: single concurrent access. |
| NFR-04 | Modularity | Text is the base. Voice, email, and SMS are channels layered on top. Do not couple channel to logic. |
| NFR-05 | Knowledge grounding | Agent must not fabricate plumbing facts. All domain claims must be grounded in the system prompt knowledge section. Unknown questions are flagged for Jill -- not guessed. |
| NFR-06 | Scoped LLM use | Use a lightweight/fast model for conversation. Reserve heavier reasoning for triage classification and quote generation if needed. |
| NFR-07 | No auth required for demo | Single contractor context. No login, no multi-tenant. Ship it. |
| NFR-08 | Graceful fallback | If the agent cannot answer a question, it must say so clearly and offer to have the contractor follow up -- not hallucinate an answer. |
| NFR-09 | Calendly webhook security | Webhook endpoint must validate the `Calendly-Webhook-Signature` header to reject spoofed events. |
| NFR-10 | Demo stability | The three scripted scenarios must work reliably. No live unknown inputs during the judged demo. |
| NFR-11 | Debug mode | Logging layer that captures all agent inputs and outputs -- every turn, every tool call, every routing decision. Required for diagnosing failures during the build. |
| NFR-12 | Single concurrent access | JSON flat files on Google Storage do not support concurrent writes. One active conversation at a time is acceptable for the hackathon demo. Do not attempt parallel sessions without adding a write lock or switching to a DB. |

---

## Architecture (confirmed from diagram + team decisions)

**Platform:** GCP

```
Clients
  Plumber  -----> Dashboard UI (Next.js)  <-----+
  Customer -----> Dashboard UI (Next.js)         |
  Customer -----> [Nice to Have] SMS via Twilio  |
  Customer -----> [Nice to Have] Phone via Speech-to-API service
                         |
                         v
                  Backend (FastAPI / Python)
                         |
                         v
               MS Agent Orchestrator
           (session + thread management)
           https://learn.microsoft.com/en-us/agent-framework
                    /overview/?pivots=programming-language-python
                         |
          _______________+_______________
         |               |               |
    Sub-Agents      Calendar access   Model access
    (Triage,        (Calendly API)    (OpenAI or GCP model)
     Scheduling,
     Quote Gen,
     FAQ)
         |
    Persistence
         |
    Google Storage
      - interactions.json   (all conversations + messages)
      - quotes.json         (generated quotes, linked by session ID)
```

**Confirmed tech decisions:**

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js | Dashboard for plumber; also hosts customer chat UI |
| Backend | FastAPI (Python) | Single entry point for all channels |
| Agent orchestration | MS Agent SDK | Session and thread management |
| LLM | OpenAI or GCP model | Decide and commit before building. Fast model for conversation; heavier call acceptable for quote gen. |
| Storage | JSON flat files on Google Storage | Two files: interactions.json, quotes.json |
| Calendar | Calendly API v2 | Agent sends scheduling_url to client. Webhook (`invitee.created` / `invitee.canceled`) updates booking state. Requires deployed URL for webhook -- not localhost. |
| Email | Flat file output (MVP) | Generate a formatted flat file for now. Wire SMTP later. |
| Voice STT / TTS | [Nice to Have] Speech-to-API service | e.g., Deepgram for STT, ElevenLabs or Google TTS for output |
| SMS / Phone | [Nice to Have] Twilio | Webhook-based; requires deployed URL, not just localhost |
| Plumbing knowledge | System prompt | Authored as a structured section of the Conversation Agent prompt. No retrieval layer. Editable via dashboard. |
| Debug / observability | Logging layer | All agent I/O logged per turn. Required. Build this first. |

 

---

## Open Questions for the Team

| # | Question | Why it matters |
|---|---|---|
| 1 | OpenAI or GCP model? | Commit before building. Affects prompt style, latency, and cost. |
| 2 | Who writes the plumbing knowledge prompt section? | Hand-write 30-50 facts covering common problems, urgency signals, and cost ranges. Goes directly in the system prompt. Someone needs to own this on Day 1. |
| 3 | Emergency notification -- dashboard flag only, or something more dramatic for the demo? | A red alert banner or simulated ping would sell the emergency scenario. Worth 30 min if time allows. |
| 4 | Contractor persona for the demo? | Jill's Plumbing has been selected as the demo persona. See specifications/contractor_persona.md (forthcoming) for details. |
| 5 | Who owns the debug / logging layer? | Build this first. Everything else is harder to fix without it. |
| 6 | **[BLOCKING] Who creates the Calendly account?** | Needs to be done on Day 1 before any scheduling or webhook work can be tested. Free Basic plan. Set up event type + 30 min travel buffer + working hours. Register webhook URL once backend is deployed. |
