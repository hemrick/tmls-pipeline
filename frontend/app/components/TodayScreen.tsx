"use client";

import { C, urgencyColors, urgencyLabel } from "../dashboard/tokens";
import { relativeTime, type IndexEntry } from "./dashboardApi";

type Screen = "today" | "pipeline" | "quote-review" | "emergencies" | "quote-approvals";

function MetricCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: highlight ? C.greenFill : C.bgSurface,
        border: `0.5px solid ${highlight ? C.greenStroke : C.borderLight}`,
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: highlight ? C.greenText : C.textSecondary,
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 500,
          color: highlight ? C.greenDeep : C.textPrimary,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: highlight ? C.greenText : C.textSecondary, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Tier0Card({
  label,
  count,
  age,
  variant,
  onClick,
}: {
  label: string;
  count: number;
  age: string;
  variant: "l0" | "l1" | "quote";
  onClick: () => void;
}) {
  const colors =
    variant === "l0"
      ? { fill: C.l0Fill, stroke: C.l0Stroke, text: C.l0Text }
      : variant === "l1"
      ? { fill: C.l1Fill, stroke: C.l1Stroke, text: C.l1Text }
      : { fill: C.l2Fill, stroke: C.l2Stroke, text: C.l2Text };

  const idle = count === 0;

  return (
    <button
      onClick={onClick}
      style={{
        background: idle ? C.bgSurface : colors.fill,
        border: idle ? `0.5px solid ${C.borderLight}` : `2px solid ${colors.stroke}`,
        borderRadius: 8,
        padding: "10px 12px",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        opacity: idle ? 0.5 : 1,
        transition: "opacity 0.15s",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: idle ? C.textSecondary : colors.text,
          marginBottom: 4,
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 500, color: idle ? C.textPrimary : colors.text, lineHeight: 1 }}>
        {count}
      </div>
      <div style={{ fontSize: 10, color: idle ? C.textSecondary : colors.text, marginTop: 4 }}>
        {age}
      </div>
    </button>
  );
}

export default function TodayScreen({
  conversations,
  calendlyUrl,
  onNavigate,
}: {
  conversations: IndexEntry[];
  calendlyUrl: string;
  onNavigate: (screen: Screen) => void;
}) {
  // Compute real counts from live conversations
  const emergencies = conversations.filter(
    (c) => c.urgency === "emergency" && !c.status.startsWith("closed")
  );
  const safetyEscalations = conversations.filter(
    (c) => (c.urgency as string) === "safety_escalation" && !c.status.startsWith("closed")
  );
  // "quoted" status means a quote was generated — needs Jill review if not yet approved
  // We use status="quoted" as a proxy; real quote_status requires a full fetch
  const quotedPending = conversations.filter(
    (c) => c.status === "quoted"
  );
  const activeCount = conversations.filter((c) => !c.status.startsWith("closed")).length;
  const bookedCount = conversations.filter((c) => c.status === "booked").length;

  const oldestEmergency = emergencies.length > 0
    ? `Oldest: ${relativeTime(emergencies.sort((a, b) => a.updated_at.localeCompare(b.updated_at))[0].updated_at)}`
    : "—";
  const oldestSafety = safetyEscalations.length > 0
    ? `Oldest: ${relativeTime(safetyEscalations.sort((a, b) => a.updated_at.localeCompare(b.updated_at))[0].updated_at)}`
    : "—";
  const oldestQuote = quotedPending.length > 0
    ? `Oldest: ${relativeTime(quotedPending.sort((a, b) => a.updated_at.localeCompare(b.updated_at))[0].updated_at)}`
    : "—";

  const now = new Date();
  const todayLabel = now.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      style={{
        maxWidth: 780,
        margin: "0 auto",
        padding: "24px 24px 48px",
        color: C.textPrimary,
      }}
    >
      {/* Date header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 500 }}>Today</div>
        <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
          Pipe Dreams by Jill · {todayLabel}
        </div>
      </div>

      {/* Tier-0 alert strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <Tier0Card
          label="Safety escalation — welfare follow-up"
          count={safetyEscalations.length}
          age={oldestSafety}
          variant="l0"
          onClick={() => onNavigate("pipeline")}
        />
        <Tier0Card
          label="Emergency — dispatch decision"
          count={emergencies.length}
          age={oldestEmergency}
          variant="l1"
          onClick={() => onNavigate("emergencies")}
        />
        <Tier0Card
          label="Quote awaiting your approval"
          count={quotedPending.length}
          age={oldestQuote}
          variant="quote"
          onClick={() => onNavigate("quote-approvals")}
        />
      </div>

      {/* View shortcuts */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <button
          onClick={() => onNavigate("pipeline")}
          style={{
            background: C.bgSurface,
            border: `0.5px solid ${C.borderLight}`,
            borderRadius: 8,
            padding: "10px 12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "inherit",
            textAlign: "left",
            transition: "background 0.15s",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: C.bgSecondary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.navy,
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            <i className="ti ti-list-details" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Pipeline</div>
            <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
              {activeCount} active conversation{activeCount !== 1 ? "s" : ""}
            </div>
          </div>
          <i className="ti ti-chevron-right" style={{ marginLeft: "auto", color: C.textTertiary }} />
        </button>

        <a
          href={calendlyUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: C.bgSurface,
            border: `0.5px solid ${C.borderLight}`,
            borderRadius: 8,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: C.bgSecondary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.navy,
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            <i className="ti ti-calendar" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Schedule</div>
            <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
              {bookedCount} booked · Open Calendly
            </div>
          </div>
          <i className="ti ti-external-link" style={{ marginLeft: "auto", color: C.textTertiary, fontSize: 14 }} />
        </a>
      </div>

      {/* Snapshot metrics */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: C.textSecondary,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 8,
          marginTop: 16,
        }}
      >
        Today's snapshot
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        <MetricCard
          label="New conversations"
          value={conversations.filter((c) => c.status === "new" || c.status === "in_progress").length}
          sub={`Emergency: ${emergencies.length} · Priority: ${conversations.filter((c) => c.urgency === "priority").length} · Scheduled: ${conversations.filter((c) => c.urgency === "scheduled").length}`}
        />
        <MetricCard
          label="Booked today"
          value={bookedCount}
          sub={bookedCount === 0 ? "None yet" : `${bookedCount} confirmed`}
        />
        <MetricCard
          label="Conversion · to quote"
          value={
            conversations.length > 0
              ? `${Math.round((quotedPending.length + conversations.filter((c) => c.status === "booked").length) / Math.max(conversations.length, 1) * 100)}%`
              : "—"
          }
          sub="Quoted or booked of all conversations"
          highlight
        />
        <MetricCard
          label="Active pipeline"
          value={activeCount}
          sub={`${conversations.filter((c) => c.status.startsWith("closed")).length} closed`}
        />
      </div>

      {/* Recent conversations preview */}
      {conversations.length > 0 && (
        <>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: C.textSecondary,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 8,
              marginTop: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Recent activity</span>
            <button
              onClick={() => onNavigate("pipeline")}
              style={{
                background: "transparent",
                border: "none",
                color: C.textSecondary,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <i className="ti ti-arrow-right" /> See all
            </button>
          </div>
          {conversations.slice(0, 3).map((c) => {
            const uc = urgencyColors(c.urgency);
            return (
              <div
                key={c.conversation_id}
                style={{
                  background: C.bgSurface,
                  border: `0.5px solid ${C.borderLight}`,
                  borderLeft: `4px solid ${uc.stroke}`,
                  borderRadius: 8,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  padding: "10px 12px",
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {c.display_label || c.customer_name || "Unknown"}
                  </div>
                  <div style={{ fontSize: 11, color: C.textSecondary }}>
                    {relativeTime(c.updated_at)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.textSecondary }}>{c.summary}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      padding: "2px 8px",
                      borderRadius: 100,
                      background: uc.stroke,
                      color: uc.fill,
                    }}
                  >
                    {urgencyLabel(c.urgency)}
                  </span>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
