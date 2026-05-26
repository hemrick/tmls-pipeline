"use client";

import { useCallback, useEffect, useState } from "react";

import ActionsPanel from "./ActionsPanel";
import LifecycleBadge from "./LifecycleBadge";
import QuoteApprovalPanel from "./QuoteApprovalPanel";
import UrgencyChip from "./UrgencyChip";
import { getConversation } from "./api";
import { relativeTime } from "./dashboardApi";
import type {
  Booking,
  ConversationState,
  Customer,
  Quote,
  Triage,
} from "./types";

export default function DashboardDetail({
  apiUrl,
  conversationId,
}: {
  apiUrl: string;
  conversationId: string;
}) {
  const [state, setState] = useState<ConversationState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getConversation(apiUrl, conversationId);
      setState(s);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [apiUrl, conversationId]);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  if (error && !state) {
    return <SectionError msg={error} />;
  }
  if (!state) return <Skeleton />;

  const lt = state.last_turn;
  const customer: Customer = lt.customer ?? {};

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", color: "#111827" }}>
      <Header
        apiUrl={apiUrl}
        conversationId={conversationId}
        customerName={customer.name ?? null}
        displayLabel={state.display_label ?? null}
        urgency={lt.urgency ?? null}
        status={lt.status}
        subReason={lt.sub_reason}
        updatedAt={state.updated_at}
        onChanged={refresh}
      />
      <CustomerInfo customer={customer} />
      <Transcript messages={state.messages} />
      <TriagePanel triage={lt.triage ?? null} />
      <BookingPanel booking={lt.booking} />
      <QuotePanel
        apiUrl={apiUrl}
        conversationId={conversationId}
        quote={lt.quote ?? null}
        onChanged={refresh}
      />
      <NotificationsPanel notifications={lt.notifications ?? []} />
      <Section title="Actions">
        <ActionsPanel
          apiUrl={apiUrl}
          conversationId={conversationId}
          alreadyClosed={
            lt.status === "closed_done" || lt.status === "closed_no_action"
          }
          onChanged={refresh}
        />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function Header({
  apiUrl,
  conversationId,
  customerName,
  displayLabel,
  urgency,
  status,
  subReason,
  updatedAt,
  onChanged,
}: {
  apiUrl: string;
  conversationId: string;
  customerName: string | null;
  displayLabel: string | null;
  urgency: ConversationState["last_turn"]["urgency"];
  status: ConversationState["last_turn"]["status"];
  subReason?: string | null;
  updatedAt: string;
  onChanged: () => void;
}) {
  const effective = displayLabel || customerName || "Unknown customer";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayLabel ?? customerName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the draft in sync with incoming props when not actively editing
  // (e.g. another tab renamed; polling refreshed the state).
  useEffect(() => {
    if (!editing) setDraft(displayLabel ?? customerName ?? "");
  }, [displayLabel, customerName, editing]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiUrl}/api/conversations/${conversationId}/rename`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ display_label: draft }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? `HTTP ${res.status}`);
      }
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(displayLabel ?? customerName ?? "");
    setEditing(false);
    setError(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.2rem" }}>
      {editing ? (
        <div>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            onBlur={() => void save()}
            disabled={saving}
            placeholder="Label (empty to clear)"
            style={{
              fontSize: "1.2rem",
              fontWeight: 700,
              padding: "0.3rem 0.5rem",
              borderRadius: 6,
              border: "1px solid #2563eb",
              width: "100%",
              maxWidth: 480,
              fontFamily: "inherit",
            }}
          />
          {error && (
            <div style={{ color: "#991b1b", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              {error}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{effective}</div>
          <button
            onClick={() => setEditing(true)}
            title="Rename conversation"
            aria-label="Rename conversation"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "0.95rem",
              color: "#6b7280",
              padding: "0.15rem 0.4rem",
              borderRadius: 4,
            }}
          >
            ✏
          </button>
          {displayLabel && customerName && displayLabel !== customerName && (
            <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
              (captured: {customerName})
            </span>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {urgency && <UrgencyChip level={urgency} />}
        <LifecycleBadge status={status} subReason={subReason} />
        <span style={{ color: "#6b7280", fontSize: "0.8rem" }}>
          Updated {relativeTime(updatedAt)}
        </span>
      </div>
    </div>
  );
}

function CustomerInfo({ customer }: { customer: Customer }) {
  if (!customer.phone && !customer.email) return null;
  return (
    <Section title="Contact">
      <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.9rem" }}>
        {customer.phone && <div>📞 {customer.phone}</div>}
        {customer.email && <div>✉ {customer.email}</div>}
      </div>
    </Section>
  );
}

function Transcript({ messages }: { messages: ConversationState["messages"] }) {
  return (
    <Section title="Transcript">
      {messages.length === 0 ? (
        <Empty>No messages yet.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ fontSize: "0.9rem" }}>
              <span
                style={{
                  fontWeight: 600,
                  color: m.role === "agent" ? "#1d4ed8" : "#374151",
                  marginRight: "0.5rem",
                }}
              >
                [{m.role === "agent" ? "Agent" : "Customer"}]
              </span>
              <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function TriagePanel({ triage }: { triage: Triage | null }) {
  return (
    <Section title="Triage">
      {!triage ? (
        <Empty>No triage yet.</Empty>
      ) : (
        <div style={{ fontSize: "0.9rem", color: "#374151" }}>
          <div style={{ marginBottom: "0.3rem" }}>
            <strong>Urgency:</strong> {triage.urgency_level ?? "—"}
            {typeof (triage as { confidence?: number }).confidence === "number" && (
              <span style={{ marginLeft: "0.6rem", color: "#6b7280" }}>
                confidence {((triage as { confidence: number }).confidence).toFixed(2)}
              </span>
            )}
          </div>
          {triage.reason && (
            <div>
              <strong>Reason:</strong> {triage.reason}
            </div>
          )}
          {triage.needs_clarification && (
            <div style={{ marginTop: "0.4rem", color: "#92400e" }}>
              ⚠ Needs clarification — borderline priority/scheduled.
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function BookingPanel({ booking }: { booking?: Booking }) {
  if (!booking || booking.booking_status === "not_started") {
    return (
      <Section title="Booking">
        <Empty>No booking yet.</Empty>
      </Section>
    );
  }
  return (
    <Section title="Booking">
      <div style={{ fontSize: "0.9rem", color: "#374151" }}>
        <div>
          <strong>Status:</strong> {booking.booking_status}
        </div>
        {booking.selected_slot && (
          <div style={{ marginTop: "0.3rem" }}>
            <strong>Slot:</strong> {booking.selected_slot.label}
          </div>
        )}
        {!!booking.slots_offered?.length && !booking.selected_slot && (
          <div style={{ marginTop: "0.3rem" }}>
            <strong>Offered:</strong>{" "}
            {booking.slots_offered.map((s) => s.label).join(", ")}
          </div>
        )}
        {!!booking.ui_log?.length && (
          <div style={{ marginTop: "0.4rem" }}>
            <strong>UI log:</strong>
            <ul style={{ margin: "0.2rem 0 0 1rem", padding: 0 }}>
              {booking.ui_log.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}

function QuotePanel({
  apiUrl,
  conversationId,
  quote,
  onChanged,
}: {
  apiUrl: string;
  conversationId: string;
  quote: Quote | null;
  onChanged: () => void;
}) {
  if (!quote) {
    return (
      <Section title="Quote">
        <Empty>No quote drafted.</Empty>
      </Section>
    );
  }
  return (
    <Section title="Quote">
      <div style={{ fontSize: "0.9rem", color: "#374151" }}>
        <div style={{ marginBottom: "0.3rem" }}>
          <strong>Status:</strong> {quote.quote_status}
          <span style={{ marginLeft: "0.6rem", color: "#6b7280" }}>v{quote.version}</span>
        </div>
        <div>
          <strong>Summary:</strong> {quote.job_summary}
        </div>
        <div style={{ marginTop: "0.3rem" }}>
          <strong>Scope:</strong>
          <ul style={{ margin: "0.2rem 0 0 1rem", padding: 0 }}>
            {quote.scope.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div style={{ marginTop: "0.3rem" }}>
          <strong>Estimate:</strong> {quote.estimated_price_range}
        </div>
        <div style={{ marginTop: "0.3rem", color: "#6b7280", fontSize: "0.8rem" }}>
          {quote.disclaimer}
        </div>
      </div>
      <div style={{ marginTop: "0.7rem" }}>
        <QuoteApprovalPanel
          apiUrl={apiUrl}
          conversationId={conversationId}
          quote={quote}
          onChanged={onChanged}
        />
      </div>
    </Section>
  );
}

function NotificationsPanel({
  notifications,
}: {
  notifications: NonNullable<ConversationState["last_turn"]["notifications"]>;
}) {
  if (!notifications.length) return null;
  return (
    <Section title="Notifications">
      <div style={{ fontSize: "0.85rem", color: "#374151" }}>
        {notifications.map((n, i) => (
          <div key={i} style={{ marginBottom: "0.2rem" }}>
            <span style={{ color: "#6b7280", marginRight: "0.4rem" }}>
              [{relativeTime(n.at)}]
            </span>
            <strong>{n.type}:</strong> {n.reason}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "1rem 1.1rem",
        marginBottom: "1rem",
      }}
    >
      <div
        style={{
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: "#6b7280",
          marginBottom: "0.55rem",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>{children}</div>;
}

function Skeleton() {
  return (
    <div style={{ color: "#9ca3af", padding: "1rem" }}>Loading conversation…</div>
  );
}

function SectionError({ msg }: { msg: string }) {
  return (
    <div
      style={{
        padding: "0.6rem 0.9rem",
        borderRadius: 8,
        background: "#fee2e2",
        color: "#991b1b",
      }}
    >
      Couldn't load conversation: {msg}
    </div>
  );
}
