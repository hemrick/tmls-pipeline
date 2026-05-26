"use client";

import { useState } from "react";

import type { Quote } from "./types";

export default function QuoteApprovalPanel({
  apiUrl,
  conversationId,
  quote,
  onChanged,
}: {
  apiUrl: string;
  conversationId: string;
  quote: Quote;
  onChanged: () => void;
}) {
  const [submitting, setSubmitting] = useState<null | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);

  const pending = quote.quote_status === "pending_jill_review";
  const terminal =
    quote.quote_status === "rejected" ||
    quote.quote_status === "sent_to_customer" ||
    quote.quote_status === "customer_accepted" ||
    quote.quote_status === "customer_declined";

  async function submit(decision: "approve" | "reject") {
    setSubmitting(decision);
    setError(null);
    try {
      const res = await fetch(
        `${apiUrl}/api/conversations/${conversationId}/quote/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
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
      setSubmitting(null);
    }
  }

  if (!pending) {
    // Show a read-only summary of the decision already taken.
    return (
      <div
        style={{
          padding: "0.5rem 0.75rem",
          borderRadius: 6,
          background: terminal ? "#ecfdf5" : "#fef3c7",
          color: "#065f46",
          fontSize: "0.85rem",
        }}
      >
        Decision recorded — status:{" "}
        <strong>{quote.quote_status}</strong>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={() => submit("approve")}
          disabled={submitting !== null}
          style={btnStyle(submitting === "approve" ? "loading" : "primary")}
        >
          {submitting === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          onClick={() => submit("reject")}
          disabled={submitting !== null}
          style={btnStyle(submitting === "reject" ? "loading" : "secondary")}
        >
          {submitting === "reject" ? "Rejecting…" : "Reject"}
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

function btnStyle(kind: "primary" | "secondary" | "loading") {
  const base = {
    padding: "0.45rem 0.95rem",
    borderRadius: 6,
    border: "1px solid transparent",
    fontSize: "0.9rem",
    cursor: kind === "loading" ? "default" : "pointer",
  } as const;
  if (kind === "primary") {
    return { ...base, background: "#16a34a", color: "white", borderColor: "#16a34a" };
  }
  if (kind === "secondary") {
    return { ...base, background: "white", color: "#374151", borderColor: "#d1d5db" };
  }
  return { ...base, background: "#9ca3af", color: "white" };
}
