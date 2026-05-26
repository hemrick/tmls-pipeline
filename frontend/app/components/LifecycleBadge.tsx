import type { ConversationStatus } from "./types";

interface BadgeStyle {
  bg: string;
  fg: string;
  label: string;
}

const STYLES: Partial<Record<ConversationStatus, BadgeStyle>> = {
  new: { bg: "#3b82f6", fg: "white", label: "New" },
  in_progress: { bg: "#1d4ed8", fg: "white", label: "In Progress" },
  quoted: { bg: "#16a34a", fg: "white", label: "Quoted" },
  booked: { bg: "#16a34a", fg: "white", label: "Booked" },
  closed_done: { bg: "#64748b", fg: "white", label: "Closed (done)" },
  closed_no_action: { bg: "#94a3b8", fg: "white", label: "Closed" },
};

export default function LifecycleBadge({
  status,
  subReason,
}: {
  status: ConversationStatus;
  subReason?: string | null;
}) {
  const s = STYLES[status];
  if (!s) return null;
  return (
    <span style={{ display: "inline-flex", gap: "0.3rem", alignItems: "center" }}>
      <span
        style={{
          padding: "0.15rem 0.55rem",
          borderRadius: 999,
          background: s.bg,
          color: s.fg,
          fontSize: "0.72rem",
          fontWeight: 600,
        }}
      >
        {s.label}
      </span>
      {subReason && status === "closed_no_action" && (
        <span
          style={{
            padding: "0.12rem 0.45rem",
            borderRadius: 999,
            background: "#e5e7eb",
            color: "#374151",
            fontSize: "0.68rem",
          }}
        >
          {subReason}
        </span>
      )}
    </span>
  );
}
