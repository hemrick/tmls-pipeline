"use client";

import { useState } from "react";

const SUB_REASONS = [
  { value: "jill_manual", label: "Jill handled manually" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "out_of_area", label: "Out of area" },
  { value: "out_of_scope", label: "Out of scope" },
  { value: "spam", label: "Spam" },
  { value: "customer_declined", label: "Customer declined" },
] as const;

export default function ActionsPanel({
  apiUrl,
  conversationId,
  alreadyClosed,
  onChanged,
}: {
  apiUrl: string;
  conversationId: string;
  alreadyClosed: boolean;
  onChanged: () => void;
}) {
  const [subReason, setSubReason] = useState<string>("jill_manual");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiUrl}/api/conversations/${conversationId}/close`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sub_reason: subReason }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? `HTTP ${res.status}`);
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (alreadyClosed) {
    return (
      <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
        Conversation is already closed.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: "0.85rem", color: "#374151" }}>
          Reason:{" "}
          <select
            value={subReason}
            onChange={(e) => setSubReason(e.target.value)}
            style={{
              padding: "0.3rem 0.5rem",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: "0.9rem",
            }}
          >
            {SUB_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={close}
          disabled={submitting}
          style={{
            padding: "0.4rem 0.85rem",
            borderRadius: 6,
            border: "1px solid #dc2626",
            background: submitting ? "#fca5a5" : "white",
            color: "#b91c1c",
            cursor: submitting ? "default" : "pointer",
            fontSize: "0.9rem",
          }}
        >
          {submitting ? "Closing…" : "Close conversation"}
        </button>
      </div>
      {error && (
        <div style={{ color: "#991b1b", fontSize: "0.85rem", marginTop: "0.4rem" }}>
          {error}
        </div>
      )}
    </div>
  );
}
