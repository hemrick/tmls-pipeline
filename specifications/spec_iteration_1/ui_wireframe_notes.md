# UI Wireframe Notes — D3

Owner: Joe (D3)
Audience: frontend implementers (E7 dashboard, E8 chat)
Last updated: 2026-05-25

This is a practical, not-pretty spec. The goal is to remove ambiguity so the
frontend team can build without a design call. ASCII wireframes are
deliberate — the structure matters more than the pixels.

All JSON contracts referenced here come from:

- `backend/app/services/triage.py` (E9)
- `backend/app/services/scheduling.py` (E10)
- `backend/app/services/quotes.py` (E11)

---

## 1. Customer chat screen

Single panel. Mobile-first; the same layout works on desktop with a max
width.

```
┌──────────────────────────────────────────────────┐
│  Jill's Plumbing                              ☰  │  ← header
├──────────────────────────────────────────────────┤
│                                                  │
│  [Agent]  Hi! I'm Jill's AI assistant. What's    │
│           going on with your plumbing today?     │  ← agent bubble (left)
│                                                  │
│                  [You]  Water is spraying        │  ← user bubble (right)
│                         everywhere!              │
│                                                  │
│  [Agent]  Got it — Jill has been alerted.        │
│           If safe, turn off your main water      │
│           valve. She'll call you shortly.        │
│                                                  │
│           ⚠  Emergency                           │  ← inline urgency chip
│                                                  │
├──────────────────────────────────────────────────┤
│  [ Type a message…                       ] [▶]   │  ← input
└──────────────────────────────────────────────────┘
```

### Components

| Component        | Notes                                                  |
|------------------|--------------------------------------------------------|
| Header           | Business name only. No login. Optional menu icon.     |
| Agent bubble     | Left-aligned. Neutral gray background.                |
| User bubble      | Right-aligned. Accent colour background.              |
| Inline urgency   | Shown when latest triage result is `emergency` or     |
|                  | `priority`. Use the same chip styling as dashboard.   |
| Calendly card    | When E10 returns `link_sent`, render as a card with   |
|                  | a button ("Book a time") that opens                   |
|                  | `scheduling_url` in a new tab.                        |
| Quote card       | When the customer is shown an approved quote, render  |
|                  | as a card with scope, price range, disclaimer, and    |
|                  | Accept / Decline buttons.                             |
| Suggested replies| Optional. When E9 returns `needs_clarification`, show |
|                  | two chips: "Earliest available" / "Standard           |
|                  | appointment" mapped to canned customer messages.      |
| Input            | Single-line. Enter to send. Disabled while loading.   |

### States

- **Empty / first load:** show agent greeting bubble only. Input enabled.
- **Loading (waiting for agent reply):** input disabled, three-dot "typing"
  indicator under the last agent message.
- **Network error:** inline red banner above the input, "Couldn't reach the
  assistant. Retry?" with a retry button. Input remains enabled.
- **Closed — No Action:** input becomes read-only with a final agent
  message; show a small "Conversation ended" note. (Customer can still
  scroll the transcript.)

---

## 2. Jill dashboard — conversation list

Two-pane layout on desktop (list left, detail right). On mobile, list-only
with tap-through to detail.

```
┌─ Pipeline — Jill's Dashboard ──────────────────────────────────────────┐
│  [Filter ▼ All]  [Search…]                            🔴 1 emergency    │
├─────────────────────────────────────────────────────────────────────────┤
│ ⚠ EMERGENCY   Sarah M.   2 min ago                                      │
│   "Water spraying everywhere, basement flooding"                        │
│   [Emergency]  [New]                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│   Priority    Mike T.    18 min ago                                     │
│   "Hot water tank stopped working"                                      │
│   [Priority]  [Quote Draft]                                             │
├─────────────────────────────────────────────────────────────────────────┤
│   Scheduled   Aisha K.   1 hr ago                                       │
│   "Need dishwasher reinstalled next week"                               │
│   [Scheduled]  [Calendly Link Sent]                                     │
├─────────────────────────────────────────────────────────────────────────┤
│   Closed      Unknown    3 hr ago                                       │
│   "Is this Joe's Pizza?"                                                │
│   [Closed — No Action: wrong_number]                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Card data

Each conversation card shows:

- Urgency icon (⚠ for emergency, blank otherwise)
- Customer name (or "Unknown")
- Relative timestamp ("2 min ago")
- One-line problem summary (truncate at ~60 chars)
- 1–2 status badges (urgency + lifecycle state)

### Sort order

Emergency first (newest within), then priority by newest, then scheduled,
then closed.

### States

- **Empty:** "No conversations yet. New customer messages will appear
  here." Centered, muted.
- **Loading:** skeleton rows (3 placeholder cards).
- **Error:** banner at top, "Couldn't load conversations. Retry." List
  area shows last-known cached state if any.
- **Real-time:** poll `/conversations` every 3–5s. New emergencies should
  flash briefly or play a subtle sound (stretch).

---

## 3. Conversation detail panel

Right pane on desktop, full screen on mobile. Has a back button on mobile.

```
┌─ Sarah M.  •  emergency  •  New ─────────────────────────────────────┐
│  📞 555-0123    ✉ sarah@example.com                                  │
├──────────────────────────────────────────────────────────────────────┤
│  TRANSCRIPT                                                          │
│   [Agent] Hi! I'm Jill's AI assistant. What's going on?              │
│   [You]   Water is spraying everywhere!                              │
│   [Agent] Got it — Jill has been alerted. If safe, turn off your    │
│           main water valve. She'll call you shortly.                 │
│                                                                      │
│  TRIAGE                                                              │
│   ⚠ Emergency   confidence 0.95   source: rules                      │
│   Reason: Customer reports active flooding in basement.              │
│   Action: Alert Jill immediately. Stop normal quote/booking flow.    │
│                                                                      │
│  BOOKING                                                             │
│   manual_emergency  •  No Calendly link sent (emergency bypass).     │
│                                                                      │
│  QUOTE                                                               │
│   No quote — emergency path bypasses quoting.                        │
│                                                                      │
│  ACTIONS                                                             │
│   [ Mark Manual Follow-up ]   [ Close — No Action ]                  │
└──────────────────────────────────────────────────────────────────────┘
```

### Sections (in order)

1. **Header:** customer name, urgency badge, lifecycle badge.
2. **Customer info card:** phone + email (whatever's been collected).
3. **Transcript:** full message history. Scrollable.
4. **Triage:** latest E9 output rendered as a labelled block. Show
   `urgency_label`, `confidence`, `classification_source`, `reason`,
   `recommended_action`, `customer_facing_guidance` (if any),
   `matched_signals`.
5. **Booking:** latest E10 state. See "Calendly booking state display"
   below.
6. **Quote:** latest E11 state. If present, opens the Quote Approval panel
   (next section). Inline when there's no draft yet.
7. **Actions:** context-sensitive buttons (mark manual follow-up, close
   with reason).

### States

- **Loading:** skeleton blocks for each section.
- **Error:** inline error in the affected section only (so other sections
  still render).
- **Empty quote / booking:** show short explanatory text rather than empty
  block.

---

## 4. Quote approval panel

Lives inside the conversation detail. When a quote with status
`pending_jill_review` exists, render this prominently above the actions
row.

```
┌─ QUOTE — Pending your review (v1) ───────────────────────────────────┐
│  Job: Hot water tank not producing heat.                             │
│                                                                      │
│  Scope:                                                              │
│    • Inspect hot water tank and heating element                      │
│    • Diagnose root cause (element, thermostat, gas valve)            │
│    • Repair or recommend replacement if needed                       │
│                                                                      │
│  Estimated price range: $250 – $600                                  │
│  Disclaimer: Final pricing will be confirmed on-site after           │
│              inspection.                                             │
│                                                                      │
│  [ ✅ Approve ]   [ ✏ Request revision ]   [ ❌ Reject ]              │
│                                                                      │
│  ↳ Revision note (shown when "Request revision" clicked):            │
│    [ Add a note for the assistant…                              ]    │
│    [ Send revision request ]                                         │
└──────────────────────────────────────────────────────────────────────┘
```

### Behaviour

- **Approve** → POST to backend; quote transitions to `sent_to_customer`,
  panel collapses to read-only "Approved — sent to customer".
- **Request revision** → reveals note textarea + confirm button. On
  submit, status becomes `revision_requested` and the panel shows
  "Awaiting new draft (vN)".
- **Reject** → confirmation modal ("This will not send a quote to the
  customer. Proceed?"). On confirm, status becomes `rejected` and the
  conversation gets a `Quote Rejected` badge.

### After Jill approves

The card switches to a customer-acceptance view (read-only for Jill, but
shows the customer's response):

```
┌─ QUOTE — Approved (v1), sent to customer ────────────────────────────┐
│  Status: awaiting customer response                                  │
│  Sent at: 3:42 PM                                                    │
│  Customer response: ⏳ no response yet                                │
└──────────────────────────────────────────────────────────────────────┘
```

When the customer accepts: status flips to `customer_accepted`, and the
booking section below auto-renders the Calendly card (E10 hand-off).

### States

- **Loading (submitting decision):** disable all three buttons, show
  spinner on the clicked one.
- **Error (submit failed):** inline red text under the buttons; do not
  change status.
- **No quote yet:** instead of the panel, show small text "No quote drafted
  yet."

---

## 5. Calendly booking state display

Lives in the conversation detail under "BOOKING". Same structure regardless
of booking state — only the body changes.

### `not_started`

```
BOOKING
  not_started  •  No link sent yet.
```

### `link_sent`

```
BOOKING
  link_sent  •  Calendly link sent 5 min ago
  https://calendly.com/jills-plumbing/consultation
  Instructions to customer: "Please choose the earliest available time
                             that works for you."
  [ Resend link ]   [ Mark manual follow-up ]
```

### `booked`

```
BOOKING
  ✅ booked  •  Tuesday Jun 2, 2:00 PM – 3:00 PM
  Booked via Calendly  •  invitee: sarah@example.com
  [ View in Calendly ]
```

### `cancelled`

```
BOOKING
  ❌ cancelled  •  Customer cancelled 1 hr ago
  [ Send new link ]   [ Mark manual follow-up ]
```

### `manual_follow_up`

```
BOOKING
  ⚠ manual_follow_up  •  Customer hasn't booked. Jill to call.
  [ Send link again ]   [ Mark booked manually ]
```

### Emergency override

For emergency conversations, render this instead of any of the above:

```
BOOKING
  manual_emergency  •  No Calendly link sent (emergency bypass).
  Jill has been alerted.
```

---

## 6. Badges — catalogue

All badges are small pills with a coloured background and short label.

### Urgency badges (driven by E9 `urgency_level`)

| Label      | JSON value   | Colour token   | Notes                          |
|------------|--------------|----------------|--------------------------------|
| Emergency  | `emergency`  | `red-600`      | White text. ⚠ icon prefix.     |
| Priority   | `priority`   | `amber-500`    | Black text.                    |
| Scheduled  | `scheduled`  | `slate-500`    | White text.                    |

### Lifecycle badges (driven by conversation/quote/booking status)

| Label               | Source field                | Colour token  |
|---------------------|------------------------------|---------------|
| New                 | conversation.status = new    | `blue-500`    |
| In Progress         | conversation.status = in_progress | `blue-700` |
| Quote Draft         | quote.quote_status = pending_jill_review | `amber-500` |
| Quote Approved      | quote.quote_status = approved or sent_to_customer or customer_accepted | `green-600` |
| Quote Rejected      | quote.quote_status = rejected | `red-500`    |
| Calendly Link Sent  | booking.booking_status = link_sent | `purple-500` |
| Booked              | booking.booking_status = booked | `green-600` |
| Manual Follow-up    | booking.booking_status = manual_follow_up | `amber-600` |
| Closed — No Action  | conversation.status = closed_no_action | `slate-400` |

Closed-No-Action also displays a sub-reason chip
(`wrong_number`, `out_of_area`, `customer_declined`, `out_of_scope`,
`spam`).

### Combination rules

- A card may show **up to two** badges: one urgency, one lifecycle.
- Emergency urgency always wins position 1.
- If the conversation is closed, only the `Closed — No Action` badge +
  sub-reason chip are shown.

---

## 7. Frontend integration checklist

Use this checklist to verify the implementation matches the spec.

- [ ] Customer chat renders agent + user bubbles correctly aligned.
- [ ] Chat shows urgency chip when latest E9 result is `emergency` or
  `priority`.
- [ ] Chat shows clarification chips ("Earliest available" / "Standard
  appointment") when E9 returns `needs_clarification = true`.
- [ ] Chat renders Calendly card when E10 returns `link_sent`.
- [ ] Chat renders quote card with Accept / Decline when E11 returns
  `sent_to_customer`.
- [ ] Dashboard list polls every 3–5s; sort puts emergencies first.
- [ ] Dashboard card shows at most two badges (urgency + lifecycle).
- [ ] Detail panel renders all six sections (header, customer info,
  transcript, triage, booking, quote, actions).
- [ ] Quote approval panel shows Approve / Request revision / Reject and
  posts the right action.
- [ ] Booking section renders correctly for all six states (including the
  emergency override).
- [ ] Empty / loading / error states implemented per section.
- [ ] Closed-No-Action conversations still appear in the list with the
  sub-reason chip.

---

## 8. JSON shapes the UI consumes (quick reference)

### E9 triage result

```json
{
  "urgency_level": "emergency | priority | scheduled",
  "urgency_label": "Emergency | Priority | Scheduled",
  "confidence": 0.0,
  "reason": "string",
  "recommended_action": "string",
  "customer_facing_guidance": "string | null",
  "requires_human_followup": true,
  "continue_normal_flow": false,
  "needs_clarification": false,
  "customer_claimed_emergency": true,
  "active_damage_confirmed": true,
  "classification_source": "rules | llm | safe_default",
  "matched_signals": ["string"]
}
```

### E10 scheduling result

```json
{
  "booking_status": "not_started | link_sent | booked | cancelled | manual_follow_up",
  "booking_method": "calendly | manual_emergency",
  "scheduling_url": "string | null",
  "instructions_to_customer": "string | null",
  "requires_jill_time_approval": false,
  "urgency_context": "emergency | priority | scheduled",
  "notify_jill": true
}
```

### E11 quote object

```json
{
  "quote_status": "draft | pending_jill_review | approved | revision_requested | rejected | sent_to_customer | customer_accepted | customer_declined",
  "job_summary": "string",
  "scope": ["string"],
  "estimated_price_range": "string",
  "disclaimer": "string",
  "requires_jill_approval": true,
  "version": 1,
  "history": [
    {"status": "string", "note": "string | null", "actor": "agent | jill | customer"}
  ],
  "next_action": "string"
}
```
