"use client";

import { relativeTime, type IndexEntry } from "../dashboardApi";
import { C } from "./tokens";

interface Props {
  rows: IndexEntry[];
  onSelect: (id: string) => void;
}

// Notification types we can infer from IndexEntry status changes
type NotifEntry = {
  conversationId: string;
  customerName: string;
  type: string;
  reason: string;
  at: string;
};

function inferNotifications(rows: IndexEntry[]): NotifEntry[] {
  const notifs: NotifEntry[] = [];
  for (const r of rows) {
    const name = r.display_label || r.customer_name || "Unknown";
    if (r.status === "quoted") {
      notifs.push({ conversationId: r.conversation_id, customerName: name, type: "quote_drafted", reason: `Quote ready for review — ${r.summary}`, at: r.updated_at });
    }
    if (r.status === "booked") {
      notifs.push({ conversationId: r.conversation_id, customerName: name, type: "booked", reason: `Appointment booked — ${r.summary}`, at: r.updated_at });
    }
    if (r.urgency === "emergency" && (r.status === "new" || r.status === "in_progress")) {
      notifs.push({ conversationId: r.conversation_id, customerName: name, type: "emergency", reason: `Emergency — ${r.summary}`, at: r.updated_at });
    }
  }
  return notifs.sort((a, b) => b.at.localeCompare(a.at));
}

const TYPE_CONFIG: Record<string, { icon: string; bg: string; fg: string; label: string }> = {
  emergency:     { icon: "ti-flame",         bg: C.l1Fill,    fg: C.l1Text,    label: "Emergency" },
  quote_drafted: { icon: "ti-file-invoice",  bg: C.l2Fill,    fg: C.l2Text,    label: "Quote ready" },
  booked:        { icon: "ti-calendar-check",bg: C.greenFill, fg: C.greenText, label: "Booked" },
};

export default function MessagesScreen({ rows, onSelect }: Props) {
  const notifs = inferNotifications(rows);

  return (
    <div style={{ paddingTop: 14 }}>
      {notifs.length === 0 ? (
        <div style={{ textAlign: "center", color: C.textTertiary, fontSize: 13, padding: "32px 0" }}>
          <i className="ti ti-message" style={{ fontSize: 28, display: "block", marginBottom: 8 }} />
          No messages yet.
        </div>
      ) : (
        notifs.map((n, i) => {
          const cfg = TYPE_CONFIG[n.type] ?? { icon: "ti-bell", bg: C.bgSecondary, fg: C.textSecondary, label: n.type };
          return (
            <button
              key={i}
              onClick={() => onSelect(n.conversationId)}
              style={{
                width: "100%", textAlign: "left", fontFamily: "inherit",
                background: cfg.bg, border: `0.5px solid ${C.borderLight}`,
                borderRadius: 8, padding: "12px 14px", marginBottom: 8, cursor: "pointer",
                display: "flex", gap: 12, alignItems: "flex-start",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: C.bgSurface, border: `0.5px solid ${C.borderLight}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: cfg.fg, fontSize: 16,
              }}>
                <i className={`ti ${cfg.icon}`} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: cfg.fg }}>{cfg.label}</span>
                  <span style={{ fontSize: 10, color: C.textTertiary }}>{relativeTime(n.at)}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{n.customerName}</div>
                <div style={{ fontSize: 11, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {n.reason}
                </div>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
