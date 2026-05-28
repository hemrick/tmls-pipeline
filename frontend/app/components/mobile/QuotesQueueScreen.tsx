"use client";

import { relativeTime, type IndexEntry } from "../dashboardApi";
import { C } from "./tokens";

interface Props {
  rows: IndexEntry[];
  onSelect: (id: string) => void;
}

export default function QuotesQueueScreen({ rows, onSelect }: Props) {
  const quotes = rows.filter((r) => r.status === "quoted");

  return (
    <div style={{ paddingTop: 14 }}>
      <ContextBanner
        icon="ti-file-invoice"
        message="Quotes drafted by the agent are waiting for your approval before they're sent to the customer."
        variant="quote"
      />
      {quotes.length === 0 ? (
        <EmptyState icon="ti-circle-check" message="No quotes pending your approval." />
      ) : (
        quotes.map((r) => (
          <DrillRow key={r.conversation_id} row={r} variant="quote" onSelect={onSelect} />
        ))
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
