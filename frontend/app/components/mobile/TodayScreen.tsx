"use client";

import { relativeTime, type IndexEntry } from "../dashboardApi";
import { C } from "./tokens";

interface Props {
  rows: IndexEntry[];
  onNavigate: (screen: string, id?: string) => void;
}

export default function TodayScreen({ rows, onNavigate }: Props) {
  const emergencyCount = rows.filter(
    (r) => r.urgency === "emergency" && r.status !== "closed_done" && r.status !== "closed_no_action",
  ).length;
  const quotesCount = rows.filter((r) => r.status === "quoted").length;
  // L0 safety callbacks: priority conversations that are closed no-action (referred elsewhere)
  const callbackCount = rows.filter(
    (r) => r.urgency === "priority" && r.status === "closed_no_action",
  ).length;

  const activeConvs = rows.filter(
    (r) => r.status !== "closed_done" && r.status !== "closed_no_action",
  );
  const newCount = rows.filter((r) => r.status === "new" || r.status === "in_progress").length;
  const bookedCount = rows.filter((r) => r.status === "booked").length;
  const quoteCount = rows.filter((r) => r.status === "quoted" || r.status === "booked").length;
  const conversionPct = rows.length > 0 ? Math.round((quoteCount / rows.length) * 100) : 0;

  const nextBookings = rows
    .filter((r) => r.status === "booked")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 3);

  return (
    <div style={{ paddingTop: 14 }}>
      {/* Time window label */}
      <div style={{
        background: C.bgSurface, borderRadius: 8, border: `0.5px solid ${C.borderLight}`,
        padding: "8px 12px", marginBottom: 14, fontSize: 13, fontWeight: 500,
        color: C.textPrimary, display: "flex", alignItems: "center", gap: 6,
      }}>
        <i className="ti ti-calendar-time" style={{ fontSize: 14, color: C.textSecondary }} />
        <span>Today</span>
      </div>

      {/* Tier-0 action cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
        <Tier0Card
          label="Safety escalation — welfare follow-up"
          count={callbackCount}
          variant="l0"
          onClick={() => onNavigate("callbacks")}
        />
        <Tier0Card
          label="Emergency — dispatch decision"
          count={emergencyCount}
          variant="l1"
          onClick={() => onNavigate("emergencies")}
        />
        <Tier0Card
          label="Quote awaiting your approval"
          count={quotesCount}
          variant="quote"
          onClick={() => onNavigate("quotes-queue")}
        />
      </div>

      {/* View shortcuts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <ShortcutCard
          icon="ti-list-details"
          title="Pipeline"
          sub={`${activeConvs.length} active`}
          onClick={() => onNavigate("pipeline")}
        />
        <ShortcutCard
          icon="ti-calendar"
          title="Schedule"
          sub={`${bookedCount} booked`}
          onClick={() => onNavigate("calendar")}
        />
      </div>

      {/* Metrics */}
      <SectionHeader label="Snapshot" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <MetricCard label="New conversations" value={String(newCount)} sub="active inquiries" />
        <MetricCard label="Bookings" value={String(bookedCount)} sub="confirmed" highlight />
        <MetricCard label="Conversion to quote" value={`${conversionPct}%`} sub="of all conversations" />
        <MetricCard label="Active pipeline" value={String(activeConvs.length)} sub="open conversations" />
      </div>

      {/* Next bookings */}
      {nextBookings.length > 0 && (
        <>
          <SectionHeader label="Upcoming bookings" />
          {nextBookings.map((r) => (
            <button
              key={r.conversation_id}
              onClick={() => onNavigate("conv-detail", r.conversation_id)}
              style={{
                width: "100%", textAlign: "left", background: C.bgSurface,
                border: `0.5px solid ${C.borderLight}`, borderRadius: 8,
                padding: "10px 14px", marginBottom: 6, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, minWidth: 56, color: C.textPrimary }}>
                <i className="ti ti-calendar-check" style={{ fontSize: 16, color: C.greenStroke }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.display_label || r.customer_name || "Unknown"}
                </div>
                <div style={{ fontSize: 11, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.summary}
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.textSecondary, flexShrink: 0 }}>
                {relativeTime(r.updated_at)}
              </div>
            </button>
          ))}
        </>
      )}

      {rows.length === 0 && (
        <div style={{ textAlign: "center", color: C.textTertiary, fontSize: 13, padding: "32px 0" }}>
          No conversations yet. Customer messages will appear here.
        </div>
      )}
    </div>
  );
}

function Tier0Card({ label, count, variant, onClick }: {
  label: string; count: number;
  variant: "l0" | "l1" | "quote"; onClick: () => void;
}) {
  const colors = {
    l0:    { fill: C.l0Fill,  stroke: C.l0Stroke,  text: C.l0Text  },
    l1:    { fill: C.l1Fill,  stroke: C.l1Stroke,  text: C.l1Text  },
    quote: { fill: C.l2Fill,  stroke: C.l2Stroke,  text: C.l2Text  },
  }[variant];
  const active = count > 0;
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? colors.fill : C.bgSurface,
        borderRadius: 8, padding: "10px 12px",
        border: active ? `2px solid ${colors.stroke}` : `0.5px solid ${C.borderLight}`,
        cursor: "pointer", textAlign: "left", fontFamily: "inherit",
        opacity: active ? 1 : 0.5,
      }}
    >
      <div style={{ fontSize: 10, color: active ? colors.text : C.textSecondary, marginBottom: 4, fontWeight: 500, lineHeight: 1.3 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 500, lineHeight: 1, color: active ? colors.text : C.textPrimary }}>
        {count}
      </div>
    </button>
  );
}

function ShortcutCard({ icon, title, sub, onClick }: {
  icon: string; title: string; sub: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: C.bgSurface, border: `0.5px solid ${C.borderLight}`,
        borderRadius: 8, padding: "10px 12px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 10,
        fontFamily: "inherit", textAlign: "left",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8, background: C.bgSecondary,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: C.navy, fontSize: 18, flexShrink: 0,
      }}>
        <i className={`ti ${icon}`} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>{sub}</div>
      </div>
      <i className="ti ti-chevron-right" style={{ color: C.textTertiary, fontSize: 16 }} />
    </button>
  );
}

function MetricCard({ label, value, sub, highlight }: {
  label: string; value: string; sub: string; highlight?: boolean;
}) {
  return (
    <div style={{
      background: highlight ? C.greenFill : C.bgSurface,
      border: `0.5px solid ${highlight ? C.greenStroke : C.borderLight}`,
      borderRadius: 8, padding: "12px 14px",
    }}>
      <div style={{ fontSize: 10, color: highlight ? C.greenText : C.textSecondary, marginBottom: 4, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.1, color: highlight ? C.greenDeep : C.textPrimary }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: highlight ? C.greenText : C.textSecondary, marginTop: 4 }}>
        {sub}
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 500, color: C.textSecondary,
      textTransform: "uppercase", letterSpacing: "0.04em",
      margin: "16px 4px 8px",
    }}>
      {label}
    </div>
  );
}
