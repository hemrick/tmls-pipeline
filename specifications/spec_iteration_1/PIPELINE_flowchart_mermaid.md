flowchart LR

    %% =========================
    %% Intake
    %% =========================
    A[Customer texts plumber] --> B[AI intro / greeting]
    B --> C[AI collects info<br/>name, problem, contact]
    C --> T[Triage<br/>emergency / priority / scheduled]

    %% =========================
    %% Triage routing
    %% =========================
    T --> D{Urgency level?}

    %% Emergency path (bypasses normal flow)
    D -->|emergency| E1[Send safety guidance<br/>'If safe, turn off main water valve']
    E1 --> E2[Alert Jill immediately<br/>dashboard + notification]
    E2 --> E3[Conversation paused for Jill<br/>status: Emergency / Manual]

    %% No call-to-action path (terminal)
    D -->|no actionable intent| N1[Polite close<br/>'Message back if you need plumbing help']
    N1 --> N2[Status: Closed - No Action<br/>sub-reason: wrong_number / out_of_area /<br/>customer_declined / out_of_scope / spam]

    %% Priority / scheduled continue normal flow
    D -->|priority / scheduled| F[Customer intent?]

    %% =========================
    %% Intent split
    %% =========================
    F -->|Quote only| Q1[AI generates quote draft]
    F -->|Appointment only| C1[AI sends Calendly link]
    F -->|Quote then appointment| Q1

    %% =========================
    %% Quote flow (Jill approves quotes only)
    %% =========================
    Q1 --> Q2[Quote status: pending_jill_review]

    %% Jill notification fires in parallel with quote generation
    Q1 -.parallel notify.-> JN[Notify Jill<br/>dashboard entry]

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
