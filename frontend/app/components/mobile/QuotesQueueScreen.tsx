"use client";

import { relativeTime, type IndexEntry } from "../dashboardApi";
import { C } from "./tokens";

interface Props {
  rows: IndexEntry[];
  onSelect: (id: string) => void;
}

const QUOTE_STATUS_RANK: Record<string, number> = {
  pending_jill_review: 0,
  approved: 1,
  sent_to_customer: 2,
  customer_accepted: 3,
  customer_declined: 4,
  revision_requested: 5,
  rejected: 6,
};

const QUOTE_STATUS_LABEL: Record<string, string> = {
  pending_jill_review: "Awaiting your review",
  approved: "Approved",
  sent_to_customer: "Sent to customer",
  customer_accepted: "Accepted",
  customer_declined: "Declined",
  revision_requested: "Revision requested",
  rejected: "Rejected",
};

export default function QuotesQueueScreen({ rows, onSelect }: Props) {
  const allQuotes = rows
    .filter((r) => r.status === "quoted" || r.quote_status)
    .sort((a, b) => {
      const ra = QUOTE_STATUS_RANK[a.quote_status ?? ""] ?? 99;
      const rb = QUOTE_STATUS_RANK[b.quote_status ?? ""] ?? 99;
      if (ra !== rb) return ra - rb;
      return b.updated_at.localeCompare(a.updated_at);
    });

  const pending = allQuotes.filter((r) => r.quote_status === "pending_jill_review");
  const others = allQuotes.filter((r) => r.quote_status !== "pending_jill_review");

  return (
    <div style={{ paddingTop: 14 }}>
      {pending.length > 0 && (
        <>
          <ContextBanner
            icon="ti-file-invoice"
            message="These quotes need your review before they're sent to the customer."
            variant="quote"
          />
          {pending.map((r) => (
            <DrillRow key={r.conversation_id} row={r} variant="quote" onSelect={onSelect} />
          ))}
        </>
      )}

      {others.length > 0 && (
        <>
          <div style={{
            fontSize: 11, fontWeight: 600, color: "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.05em",
            padding: "10px 4px 6px",
            marginTop: pending.length > 0 ? 8 : 0,
          }}>
            Other quotes
          </div>
          {others.map((r) => (
            <div key={r.conversation_id} style={{ position: "relative" }}>
              <DrillRow row={r} variant="quote" onSelect={onSelect} />
              {r.quote_status && (
                <div style={{
                  position: "absolute", top: 12, right: 14,
                  fontSize: 10, fontWeight: 500,
                  color: "#6b7280",
                  background: "#f3f4f6",
                  borderRadius: 4,
                  padding: "2px 6px",
                }}>
                  {QUOTE_STATUS_LABEL[r.quote_status] ?? r.quote_status}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {allQuotes.length === 0 && (
        <EmptyState icon="ti-file-invoice" message="No quotes yet." />
      )}
    </div>
  );
}

export function ContextBanner({ icon, message, variant }: {
  icon: string; message: string; variant: "l0" | "l1" | "quote";
}) {
  const colors = {
    l0:    { fill: C.l0Fill,  text: C.l0Text  },
    l1:    { fill: C.l1Fill,  text: C.l1Text  },
    quote: { fill: C.l2Fill,  text: C.l2Text  },
  }[variant];
  return (
    <div style={{
      background: colors.fill, borderRadius: 8, padding: "10px 12px",
      marginBottom: 10, fontSize: 11, lineHeight: 1.4, color: colors.text,
      display: "flex", alignItems: "flex-start", gap: 8,
    }}>
      <i className={`ti ${icon}`} style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }} />
      <span>{message}</span>
    </div>
  );
}

export function DrillRow({ row, variant, onSelect }: {
  row: IndexEntry; variant: "l0" | "l1" | "quote"; onSelect: (id: string) => void;
}) {
  const colors = {
    l0:    { fill: C.l0Fill,  stroke: C.l0Stroke, text: C.l0Text,  deep: C.l0Deep,  label: C.l0Stroke },
    l1:    { fill: C.l1Fill,  stroke: C.l1Stroke, text: C.l1Text,  deep: C.l1Deep,  label: C.l1Stroke },
    quote: { fill: C.l2Fill,  stroke: C.l2Stroke, text: C.l2Text,  deep: C.l2Deep,  label: C.l2Stroke },
  }[variant];
  const initials = (row.display_label || row.customer_name || "?").slice(0, 2).toUpperCase();

  return (
    <button
      onClick={() => onSelect(row.conversation_id)}
      style={{
        width: "100%", textAlign: "left", fontFamily: "inherit",
        background: colors.fill, borderRadius: "0 8px 8px 0",
        border: `0.5px solid ${colors.stroke}`,
        borderLeft: `5px solid ${colors.stroke}`,
        padding: "12px 14px", marginBottom: 8, cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: colors.stroke, color: colors.fill,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 500, fontSize: 13,
        }}>
          {initials}
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, flex: 1, color: colors.deep }}>
          {row.display_label || row.customer_name || "Unknown"}
        </div>
        <div style={{ fontSize: 11, color: colors.label, flexShrink: 0 }}>
          {relativeTime(row.updated_at)}
        </div>
      </div>
      <div style={{ fontSize: 11, color: colors.text, lineHeight: 1.4, paddingLeft: 46 }}>
        {row.summary}
      </div>
    </button>
  );
}

export function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{
      textAlign: "center", color: C.textTertiary, padding: "32px 0",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    }}>
      <i className={`ti ${icon}`} style={{ fontSize: 28 }} />
      <span style={{ fontSize: 13 }}>{message}</span>
    </div>
  );
}
