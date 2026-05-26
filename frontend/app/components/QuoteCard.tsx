import type { Quote } from "./types";

export default function QuoteCard({
  quote,
  onAccept,
  onDecline,
  disabled,
}: {
  quote: Quote;
  onAccept: () => void;
  onDecline: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        background: "#fafafa",
        padding: "1rem 1.1rem",
        margin: "0.6rem 0",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "0.4rem" }}>
        Quote — {quote.job_summary}
      </div>
      <div style={{ fontSize: "0.9rem", color: "#374151" }}>
        <strong>Scope</strong>
        <ul style={{ margin: "0.3rem 0 0.6rem 1rem", padding: 0 }}>
          {quote.scope.map((s, i) => (
            <li key={i} style={{ marginBottom: "0.15rem" }}>{s}</li>
          ))}
        </ul>
        <div>
          <strong>Estimated:</strong> {quote.estimated_price_range}
        </div>
        <div style={{ marginTop: "0.4rem", color: "#6b7280", fontSize: "0.8rem" }}>
          {quote.disclaimer}
        </div>
      </div>
      <div style={{ marginTop: "0.8rem", display: "flex", gap: "0.5rem" }}>
        <button
          onClick={onAccept}
          disabled={disabled}
          style={{
            padding: "0.45rem 0.95rem",
            borderRadius: 6,
            border: "none",
            background: disabled ? "#9ca3af" : "#16a34a",
            color: "white",
            cursor: disabled ? "default" : "pointer",
            fontSize: "0.9rem",
          }}
        >
          Accept
        </button>
        <button
          onClick={onDecline}
          disabled={disabled}
          style={{
            padding: "0.45rem 0.95rem",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "white",
            color: "#374151",
            cursor: disabled ? "default" : "pointer",
            fontSize: "0.9rem",
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}
