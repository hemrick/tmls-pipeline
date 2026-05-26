"use client";

export type MicState = "idle" | "connecting" | "listening" | "thinking" | "speaking";

const STATES: Record<
  MicState,
  { label: string; bg: string; fg: string; pulse: boolean }
> = {
  idle: { label: "Tap to talk", bg: "#2563eb", fg: "white", pulse: false },
  connecting: { label: "Connecting…", bg: "#9ca3af", fg: "white", pulse: false },
  listening: { label: "Listening — tap to stop", bg: "#dc2626", fg: "white", pulse: true },
  thinking: { label: "Thinking…", bg: "#6b7280", fg: "white", pulse: false },
  speaking: { label: "Agent speaking — tap to interrupt", bg: "#16a34a", fg: "white", pulse: true },
};

export default function MicButton({
  state,
  level,
  onClick,
}: {
  state: MicState;
  level?: number;
  onClick: () => void;
}) {
  const s = STATES[state];
  const ringScale = state === "listening" && level ? 1 + Math.min(level * 1.5, 0.6) : 1;

  return (
    <button
      onClick={onClick}
      disabled={state === "connecting" || state === "thinking"}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.45rem",
        padding: "0.9rem 0.75rem",
        border: "none",
        borderRadius: 12,
        background: "transparent",
        cursor:
          state === "connecting" || state === "thinking" ? "default" : "pointer",
        font: "inherit",
      }}
      aria-label={s.label}
    >
      <span
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: s.bg,
          color: s.fg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2rem",
          transform: `scale(${ringScale.toFixed(3)})`,
          boxShadow: s.pulse
            ? `0 0 0 6px ${s.bg}33, 0 0 0 12px ${s.bg}1a`
            : "0 1px 4px rgba(0,0,0,0.12)",
          transition: "transform 90ms linear, box-shadow 150ms ease",
        }}
      >
        {/* mic glyph */}
        <MicGlyph />
      </span>
      <span style={{ fontSize: "0.85rem", color: "#374151" }}>{s.label}</span>
    </button>
  );
}

function MicGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11v1a7 7 0 0 0 14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
