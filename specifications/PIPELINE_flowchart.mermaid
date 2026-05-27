flowchart LR

    %% =========================
    %% Intake
    %% =========================
    A[Customer texts plumber] --> B[AI intro / greeting]
    B --> C[AI collects info<br/>name, problem, contact]
    C --> T[Triage<br/>L0 safety / OOS<br/>L1 emergency<br/>L2 priority<br/>L3 scheduled]

    %% =========================
    %% Triage routing
    %% =========================
    T --> D{Urgency level?}

    %% -------------------------
    %% L0 SAFETY (gas, electrical, vulnerable + sewage)
    %% No quote, no Calendly
    %% -------------------------
    D -->|L0 safety<br/>gas / electrical /<br/>vulnerable + sewage| L0S1[Deliver safety script<br/>with specific phone number<br/>e.g. Enbridge 1-866-763-5427]
    L0S1 --> L0S2[Confirm customer is acting<br/>'Are you outside now?']
    L0S2 --> L0COM[Alert Jill immediately<br/>Dashboard: Safety Escalation<br/>NO quote, NO Calendly]

    %% -------------------------
    %% L0 WRONG-TRADE OOS (pool, well, septic, gas boiler, irrigation)
    %% No quote, no Calendly; referral
    %% -------------------------
    D -->|L0 wrong-trade OOS<br/>pool / well / septic /<br/>gas boiler / irrigation| L0W1[Acknowledge problem<br/>Suggest correct specialist type]
    L0W1 --> L0COM

    %% -------------------------
    %% L0 BOUNDARY OOS (municipal vs owner-side)
    %% -------------------------
    D -->|L0 boundary OOS<br/>no water + neighbours,<br/>low pressure + neighbours,<br/>yard sewer signs| L0B1[Gather symptoms<br/>location, neighbours, timing]
    L0B1 --> L0B2{Likely municipal?}
    L0B2 -->|Yes| L0B3[Suggest 311 first<br/>Offer message-back if not resolved]
    L0B2 -->|No / unclear| L0B4[Offer diagnostic visit<br/>continue to L2 path]
    L0B3 --> L0COM
    L0B4 --> F

    %% L0 common terminal
    L0COM --> L0END[Status: closed_safety_escalation<br/>after Jill follows up]

    %% -------------------------
    %% L1 EMERGENCY
    %% -------------------------
    D -->|L1 emergency<br/>active uncontrolled water,<br/>sewage in living space,<br/>frozen pipe risk| L1A[First-step advice<br/>e.g. turn off main valve]
    L1A --> L1B[Alert Jill immediately]
    L1B --> F

    %% -------------------------
    %% L2 / L3 normal flow
    %% -------------------------
    D -->|L2 priority / L3 scheduled| F[Customer intent?]

    %% -------------------------
    %% No actionable intent (terminal)
    %% -------------------------
    D -->|No actionable intent| N1[Polite close<br/>'Message back if you need help']
    N1 --> N2[Status: Closed - No Action<br/>sub-reason: wrong_number / out_of_area /<br/>customer_declined / out_of_scope / spam]

    %% -------------------------
    %% Intent split
    %% -------------------------
    F -->|Quote only| Q1[AI generates quote draft]
    F -->|Appointment only| C1[AI sends Calendly link]
    F -->|Quote then appointment| Q1

    %% =========================
    %% Quote flow (Jill approves quotes only)
    %% =========================
    Q1 --> Q2[Quote status: pending_jill_review]

    %% Jill notification fires in parallel with quote generation
    Q1 -.parallel notify.-> JN[Notify Jill<br/>dashboard tile]

    Q2 --> Q3{Jill decision?}
    Q3 -->|Approve| Q4[Send quote to customer<br/>status: sent_to_customer]
    Q3 -->|Request revision| Q5[Quote returns to draft<br/>new version]
    Q5 --> Q1
    Q3 -->|Reject| Q6[Status: rejected<br/>dashboard manual follow-up]

    Q4 --> Q7{Customer decision?}
    Q7 -->|Accept| Q8[Status: customer_accepted]
    Q7 -->|Decline| Q9[Status: customer_declined<br/>polite close]

    %% Quote-then-appointment hand-off
    Q8 --> C1

    %% =========================
    %% Calendly flow (NO Jill time approval)
    %% =========================
    C1 --> C2[Booking status: link_sent]

    %% Jill notification fires in parallel with link send
    C1 -.parallel notify.-> JN

    C2 --> C3{Customer action?}
    C3 -->|Books in Calendly| C4[Webhook: invitee.created<br/>status: booked]
    C3 -->|Cancels| C5[Webhook: invitee.canceled<br/>status: cancelled]
    C3 -->|No action| C6[Jill marks manual_follow_up]

    C4 --> C7[Job booked<br/>Jill sees confirmed booking]
    C5 --> C1
    C6 --> C1
