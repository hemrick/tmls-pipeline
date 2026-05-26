import type { UrgencyLevel } from "./types";

const STYLES: Record<UrgencyLevel, { bg: string; fg: string; label: string }> = {
  emergency: { bg: "#dc2626", fg: "white", label: "⚠ Emergency" },
  priority: { bg: "#f59e0b", fg: "#1f2937", label: "Priority" },
  scheduled: { bg: "#64748b", fg: "white", label: "Scheduled" },
};

export default function UrgencyChip({ level }: { level: UrgencyLevel }) {
  const s = STYLES[level];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.15rem 0.55rem",
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      {s.label}
    </span>
  );
}
