# Demo Scenarios

Owner: Joe
Last updated: 2026-05-25

Three scripted scenarios that must work end-to-end before the judges' run.
Each scenario lists the customer input, the exact JSON each Joe-owned
module returns, and the dashboard state at each step.

All JSON shapes are produced by:

- `backend/app/services/triage.py` (E9)
- `backend/app/services/scheduling.py` (E10)
- `backend/app/services/quotes.py` (E11)

---

## Setup checklist

- [ ] Backend running locally (`uv run uvicorn app.main:app --reload --port 8000`).
- [ ] Frontend running locally (`npm run dev`), pointing at the backend
  via `API_URL=http://localhost:8000`.
- [ ] Backend `.env` (or environment) has `CALENDLY_SCHEDULING_URL=` set,
  or relies on the demo fallback
  (`https://calendly.com/jills-plumbing/consultation`).
- [ ] Dashboard is open in a second tab so Jill's view updates live.
- [ ] No real customer PII used; demo names only.

---

## Scenario 1 — Emergency (basement flooding)

### Goal

Show that Pipeline recognises a hard emergency, bypasses normal quote and
booking flow, alerts Jill, and gives safe, short customer-facing guidance.

### Customer input

> "Water is spraying everywhere and my basement is flooding."

### Expected behaviour

1. Triage returns `emergency`, no clarification needed.
2. Agent replies with safe guidance + "Jill has been alerted."
3. Dashboard immediately shows the conversation with `⚠ Emergency` +
   `New` badges, sorted to top.
4. Scheduling module returns the emergency bypass (no Calendly link).
5. No quote is drafted.

### E9 output (rules path)

```json
{
  "urgency_level": "emergency",
  "urgency_label": "Emergency",
  "confidence": 0.95,
  "reason": "Customer reports active flooding in basement.",
  "recommended_action": "Alert Jill immediately and stop normal quote/booking flow.",
  "customer_facing_guidance": "If safe, turn off your main water valve. Jill has been alerted.",
  "requires_human_followup": true,
  "continue_normal_flow": false,
  "needs_clarification": false,
  "customer_claimed_emergency": true,
  "active_damage_confirmed": true,
  "classification_source": "rules",
  "matched_signals": ["basement flooding", "spraying everywhere"]
}
```

### E10 output (emergency bypass)

```json
{
  "booking_status": "not_started",
  "booking_method": "manual_emergency",
  "scheduling_url": null,
  "instructions_to_customer": null,
  "requires_jill_time_approval": false,
  "urgency_context": "emergency",
  "notify_jill": true
}
```

### E11 output

Not called. The orchestrator should skip quote generation for emergencies.

### Dashboard state at end of scenario

- List card: `⚠ Emergency` + `New`, pinned to top of the list.
- Detail panel:
  - Triage section shows the JSON above (rendered).
  - Booking section shows the "manual_emergency" override message.
  - Quote section shows "No quote — emergency path bypasses quoting."

### Acceptance

- Agent first message includes the safety guidance verbatim or close
  paraphrase.
- No Calendly link appears in chat.
- Dashboard pin / red badge visible within one poll cycle.

---

## Scenario 2 — Priority + quote then booking (hot water tank)

### Goal

Show the full happy path: priority classification → quote draft → Jill
approves → customer accepts → Calendly link sent.

### Customer input (sequence)

1. "My hot water tank stopped working and I need someone soon."
2. (Agent asks 1–2 scoping questions; customer answers.)
3. (Jill approves quote on dashboard.)
4. "Looks good, let's book it."

### Expected behaviour

1. Triage returns `priority`. Even though "soon" is urgent language, no
   hard emergency signals are present.
2. Agent confirms timeline framing if needed
   (`needs_clarification` may be true on a borderline phrasing — covered
   in the test suite).
3. Agent collects 1–2 scoping details.
4. Quote draft is generated; status `pending_jill_review`. Dashboard shows
   `Quote Draft` badge.
5. Jill clicks **Approve** in the quote panel. Status becomes
   `sent_to_customer`.
6. Customer sees the quote card, taps **Accept**. Status becomes
   `customer_accepted`. `should_offer_calendly_after_quote` returns
   `True`.
7. Scheduling module returns `link_sent` with the Calendly URL.

### E9 output (after the first message)

```json
{
  "urgency_level": "priority",
  "urgency_label": "Priority",
  "confidence": 0.82,
  "reason": "Customer reports hot water tank failure with urgent language but no active damage.",
  "recommended_action": "Continue intake and offer earliest Calendly slot or quote.",
  "customer_facing_guidance": null,
  "requires_human_followup": true,
  "continue_normal_flow": true,
  "needs_clarification": false,
  "customer_claimed_emergency": false,
  "active_damage_confirmed": false,
  "classification_source": "rules",
  "matched_signals": ["hot water tank stopped", "need someone soon"]
}
```

### E11 output (initial draft)

```json
{
  "quote_status": "pending_jill_review",
  "job_summary": "Customer reports hot water tank not producing heat.",
  "scope": [
    "Inspect hot water tank and heating components",
    "Diagnose root cause (element, thermostat, gas valve, etc.)",
    "Repair or recommend replacement if needed"
  ],
  "estimated_price_range": "$250-$600",
  "disclaimer": "Final pricing will be confirmed on-site after inspection.",
  "requires_jill_approval": true,
  "version": 1,
  "history": [
    {"status": "draft", "note": null, "actor": "agent"},
    {"status": "pending_jill_review", "note": null, "actor": "agent"}
  ],
  "next_action": "Awaiting Jill review."
}
```

### E11 output (after Jill approves)

```json
{
  "quote_status": "sent_to_customer",
  "job_summary": "Customer reports hot water tank not producing heat.",
  "scope": ["..."],
  "estimated_price_range": "$250-$600",
  "disclaimer": "Final pricing will be confirmed on-site after inspection.",
  "requires_jill_approval": true,
  "version": 1,
  "history": [
    {"status": "draft", "note": null, "actor": "agent"},
    {"status": "pending_jill_review", "note": null, "actor": "agent"},
    {"status": "approved", "note": null, "actor": "jill"},
    {"status": "sent_to_customer", "note": null, "actor": "agent"}
  ],
  "next_action": "Awaiting customer response."
}
```

### E11 output (after customer accepts)

```json
{
  "quote_status": "customer_accepted",
  "history": ["...", {"status": "customer_accepted", "note": null, "actor": "customer"}],
  "next_action": "Offer Calendly link.",
  "...": "..."
}
```

### E10 output (Calendly hand-off)

```json
{
  "booking_status": "link_sent",
  "booking_method": "calendly",
  "scheduling_url": "https://calendly.com/jills-plumbing/consultation",
  "instructions_to_customer": "Please choose the earliest available time that works for you.",
  "requires_jill_time_approval": false,
  "urgency_context": "priority",
  "notify_jill": true
}
```

### Dashboard state through the scenario

| Step                | Badges                                      |
|---------------------|---------------------------------------------|
| Customer first msg  | `Priority` + `New`                          |
| Quote drafted       | `Priority` + `Quote Draft`                  |
| Jill approves       | `Priority` + `Quote Approved`               |
| Customer accepts    | `Priority` + `Quote Approved`               |
| Calendly link sent  | `Priority` + `Calendly Link Sent`           |
| Customer books      | `Priority` + `Booked` (via webhook)         |

### Acceptance

- Quote never reaches the customer before Jill approves.
- Customer never sees a Jill approval step for appointment times.
- The Calendly URL in chat is exactly `scheduling_url` from E10.

---

## Scenario 3 — Scheduled appointment (dishwasher reinstall)

### Goal

Show the simplest happy path: scheduled classification → scope → Calendly
link → customer books.

### Customer input (sequence)

1. "I need my dishwasher reinstalled sometime next week."
2. (Agent asks 1–2 scoping questions; customer answers.)

### Expected behaviour

1. Triage returns `scheduled`. No urgency signals; "next week" implies
   flexible timing.
2. Agent scopes the job briefly.
3. Scheduling module returns `link_sent` with the Calendly URL and
   neutral instructions.
4. Customer books in Calendly; webhook flips status to `booked`.

### E9 output

```json
{
  "urgency_level": "scheduled",
  "urgency_label": "Scheduled",
  "confidence": 0.88,
  "reason": "Customer mentions planned install with flexible timing (next week).",
  "recommended_action": "Continue scoping then send Calendly link.",
  "customer_facing_guidance": null,
  "requires_human_followup": false,
  "continue_normal_flow": true,
  "needs_clarification": false,
  "customer_claimed_emergency": false,
  "active_damage_confirmed": false,
  "classification_source": "rules",
  "matched_signals": ["dishwasher reinstall", "next week"]
}
```

### E10 output

```json
{
  "booking_status": "link_sent",
  "booking_method": "calendly",
  "scheduling_url": "https://calendly.com/jills-plumbing/consultation",
  "instructions_to_customer": "Pick any time that works for you.",
  "requires_jill_time_approval": false,
  "urgency_context": "scheduled",
  "notify_jill": true
}
```

### E11 output

Not called by default for scheduled appointments. If the customer asks
"how much will it cost?", the orchestrator can call
`generate_quote_draft(...)` and run scenario 2's quote sub-flow.

### Dashboard state through the scenario

| Step                | Badges                              |
|---------------------|-------------------------------------|
| Customer first msg  | `Scheduled` + `New`                 |
| Calendly link sent  | `Scheduled` + `Calendly Link Sent`  |
| Customer books      | `Scheduled` + `Booked`              |

### Acceptance

- No quote shown (unless customer asks).
- No Jill approval step at any point.
- Customer can self-serve through to a booking with one Calendly click.

---

## Edge cases worth showing if there's time

These are not required for the scripted demo but each is covered by tests.

| Edge case                              | What happens                                |
|----------------------------------------|---------------------------------------------|
| Customer claims emergency, says contained | E9 returns `priority` with `customer_claimed_emergency=true`, `active_damage_confirmed=false`. Agent offers earliest vs standard. |
| Wrong number                           | Conversation closes with `Closed — No Action` (sub-reason: `wrong_number`). |
| Customer declines quote                | Quote status `customer_declined`. No Calendly link offered. |
| Customer ghosts after Calendly link sent | Booking status remains `link_sent`; Jill can mark `manual_follow_up`. |
| Calendly cancellation                  | Webhook flips status to `cancelled`; Jill can resend link. |

---

## Smoke checks (before the demo)

Run from `backend/`:

```bash
python -m uv run pytest -q
```

Expected: all tests pass. If anything fails, do not demo until fixed.

Manual: from a Python REPL with `backend/` as the cwd,

```python
from app.services.triage import classify_urgency
from app.services.scheduling import build_calendly_response
from app.services.quotes import generate_quote_draft, apply_jill_decision, apply_customer_decision

t1 = classify_urgency("Water is spraying everywhere and my basement is flooding.")
assert t1["urgency_level"] == "emergency"

s1 = build_calendly_response(urgency_level="emergency")
assert s1["booking_method"] == "manual_emergency"

q = generate_quote_draft(
    job_summary="Hot water tank not producing heat.",
    problem_type="hot_water_tank",
)
q = apply_jill_decision(q, decision="approve")
q = apply_customer_decision(q, decision="accept")
s2 = build_calendly_response(urgency_level="priority")
assert s2["booking_status"] == "link_sent"
```
