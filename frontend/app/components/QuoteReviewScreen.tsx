"use client";

import { useCallback, useEffect, useState } from "react";

import { C } from "../dashboard/tokens";
import { getConversation } from "./api";
import { relativeTime } from "./dashboardApi";
import type { ConversationState, Quote } from "./types";

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      style={{
        position: "fixed",
        bottom: 30,
        left: "50%",
        transform: "translateX(-50%)",
        background: C.greenDeep,
        color: "white",
        padding: "12px 20px",
        borderRadius: 8,
        fontSize: 13,
        zIndex: 1000,
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
      }}
    >
      {message}
    </div>
  );
}

function QuoteDoc({
  quote,
  customerName,
  phone,
  email,
}: {
  quote: Quote;
  customerName?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  const today = new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      style={{
        background: C.bgSurface,
        border: `0.5px solid ${C.borderLight}`,
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
      }}
    >
      {/* Letterhead */}
      <div
        style={{
          borderBottom: `2px solid ${C.navy}`,
          paddingBottom: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 500, color: C.navy }}>
          Pipe Dreams by Jill
        </div>
        <div style={{ fontSize: 10, color: C.textSecondary, marginTop: 2 }}>
          Licensed P3 · Serving the GTA since 2003 · pipedreamsbyjill.ca
        </div>
      </div>

      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          marginBottom: 14,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: C.navy,
        }}
      >
        {quote.estimated_price_range ? "Quote" : "Estimate"}
      </div>

      {/* Meta grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          fontSize: 11,
          marginBottom: 16,
        }}
      >
        <div style={{ background: C.bgSecondary, padding: "8px 10px", borderRadius: 6 }}>
          <div
            style={{
              fontSize: 9,
              color: C.textSecondary,
              textTransform: "uppercase",
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            Date issued
          </div>
          <div>{today}</div>
        </div>
        <div style={{ background: C.bgSecondary, padding: "8px 10px", borderRadius: 6 }}>
          <div
            style={{
              fontSize: 9,
              color: C.textSecondary,
              textTransform: "uppercase",
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            Version
          </div>
          <div>v{quote.version}</div>
        </div>
        {(customerName || phone || email) && (
          <div
            style={{ background: C.bgSecondary, padding: "8px 10px", borderRadius: 6, gridColumn: "1 / 3" }}
          >
            <div
              style={{
                fontSize: 9,
                color: C.textSecondary,
                textTransform: "uppercase",
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              Customer
            </div>
            <div style={{ lineHeight: 1.6 }}>
              {customerName && <div>{customerName}</div>}
              {phone && <div>{phone}</div>}
              {email && <div>{email}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Problem + scope */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: C.navy,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 6,
            paddingBottom: 4,
            borderBottom: `0.5px solid ${C.borderLight}`,
          }}
        >
          Problem &amp; scope
        </div>
        <div style={{ fontSize: 11, color: C.textPrimary, marginBottom: 8, lineHeight: 1.5 }}>
          {quote.job_summary}
        </div>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: C.textSecondary, lineHeight: 1.7 }}>
          {quote.scope.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>

      {/* Price estimate */}
      {quote.estimated_price_range && (
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: C.navy,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 6,
              paddingBottom: 4,
              borderBottom: `0.5px solid ${C.borderLight}`,
            }}
          >
            Estimated price
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 4px",
              borderBottom: `0.5px solid ${C.borderMid}`,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500, color: C.navy }}>Total estimate (incl. HST)</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: C.navy }}>
              {quote.estimated_price_range}
            </span>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div
        style={{
          background: C.bgSecondary,
          padding: "10px 12px",
          borderRadius: 6,
          marginTop: 12,
          fontSize: 10,
          color: C.textSecondary,
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: C.textPrimary, fontWeight: 500 }}>Notes &amp; terms. </strong>
        {quote.disclaimer} Quote valid for 30 days. 90-day workmanship warranty on labour.
      </div>
    </div>
  );
}

export default function QuoteReviewScreen({
  apiUrl,
  conversationId,
  onBack,
}: {
  apiUrl: string;
  conversationId: string;
  onBack: () => void;
}) {
  const [conv, setConv] = useState<ConversationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<null | "approve" | "revise" | "reject">(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const refresh = useCallback(async () => {
    try {
      const s = await getConversation(apiUrl, conversationId);
      setConv(s);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [apiUrl, conversationId]);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  async function submitDecision(decision: "approve" | "reject") {
    setSubmitting(decision);
    try {
      const res = await fetch(
        `${apiUrl}/api/conversations/${conversationId}/quote/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? `HTTP ${res.status}`);
      }
      const msg =
        decision === "approve"
          ? "Quote approved. Sending to customer."
          : "Quote rejected. Flagged for follow-up.";
      setToast(msg);
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(null);
    }
  }

  if (error && !conv) {
    return (
      <div style={{ padding: 24, color: C.l1Text }}>
        Could not load conversation: {error}
      </div>
    );
  }

  if (!conv) {
    return (
      <div style={{ padding: 24, color: C.textSecondary }}>Loading…</div>
    );
  }

  const lt = conv.last_turn;
  const quote = lt.quote;
  const customer = lt.customer ?? {};
  const isPending = quote?.quote_status === "pending_jill_review";
  const isSent = quote?.quote_status === "sent_to_customer";
  const isApproved = quote?.quote_status === "approved";
  const isTerminal = ["rejected", "customer_accepted", "customer_declined"].includes(
    quote?.quote_status ?? ""
  );

  return (
    <div
      style={{
        maxWidth: 680,
        margin: "0 auto",
        padding: "20px 24px 80px",
        color: C.textPrimary,
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            width: 32,
            height: 32,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.textPrimary,
            fontSize: 20,
            marginLeft: -6,
          }}
        >
          <i className="ti ti-chevron-left" />
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>
            {isPending ? "Review quote" : "Quote"}
          </div>
          <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
            {customer.name ?? conv.display_label ?? "Unknown customer"}
            {conv.updated_at && ` · Updated ${relativeTime(conv.updated_at)}`}
          </div>
        </div>
        {isPending && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 9,
              fontWeight: 500,
              padding: "4px 10px",
              borderRadius: 100,
              background: C.l2Fill,
              color: C.l2Text,
              border: `0.5px solid ${C.l2Stroke}`,
            }}
          >
            Awaiting your review
          </span>
        )}
        {(isSent || isApproved) && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 9,
              fontWeight: 500,
              padding: "4px 10px",
              borderRadius: 100,
              background: C.greenFill,
              color: C.greenText,
              border: `0.5px solid ${C.greenStroke}`,
            }}
          >
            Approved
          </span>
        )}
      </div>

      {/* Info banner */}
      {isPending && (
        <div
          style={{
            fontSize: 11,
            color: C.textSecondary,
            margin: "4px 4px 12px",
            lineHeight: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <i className="ti ti-info-circle" style={{ fontSize: 14 }} />
          This is exactly what the customer will see. Approve to send, or reject to flag for follow-up.
        </div>
      )}

      {!quote && (
        <div
          style={{
            background: C.bgSurface,
            border: `0.5px solid ${C.borderLight}`,
            borderRadius: 8,
            padding: 24,
            textAlign: "center",
            color: C.textSecondary,
            fontSize: 13,
          }}
        >
          No quote drafted yet for this conversation.
        </div>
      )}

      {quote && (
        <QuoteDoc
          quote={quote}
          customerName={customer.name}
          phone={customer.phone}
          email={customer.email}
        />
      )}

      {/* Transcript */}
      {conv.messages.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              color: C.textSecondary,
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontWeight: 500,
            }}
          >
            Conversation transcript
          </div>
          <div
            style={{
              background: C.bgSecondary,
              borderRadius: 8,
              padding: "10px 12px",
              maxHeight: 240,
              overflowY: "auto",
            }}
          >
            {conv.messages.map((m, i) => (
              <div
                key={i}
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  marginBottom: 8,
                  ...(m.role === "agent"
                    ? {
                        color: C.textSecondary,
                        paddingLeft: 12,
                        borderLeft: `2px solid ${C.borderMid}`,
                      }
                    : { color: C.textPrimary }),
                }}
              >
                {m.content}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "8px 12px",
            background: C.l1Fill,
            color: C.l1Text,
            borderRadius: 6,
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Action bar — sticky bottom */}
      {quote && isPending && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: C.bgPage,
            padding: "12px 0",
            display: "grid",
            gridTemplateColumns: "2fr 1.5fr 1fr",
            gap: 8,
            borderTop: `0.5px solid ${C.borderLight}`,
            margin: "0 -24px",
            paddingLeft: 24,
            paddingRight: 24,
            zIndex: 10,
          }}
        >
          <button
            onClick={() => void submitDecision("approve")}
            disabled={submitting !== null}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "14px 8px",
              fontSize: 13,
              fontWeight: 500,
              cursor: submitting ? "default" : "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: C.greenStroke,
              color: "white",
              opacity: submitting === "approve" ? 0.7 : 1,
            }}
          >
            <i className="ti ti-check" />
            {submitting === "approve" ? "Approving…" : "Approve & send"}
          </button>
          <button
            disabled={submitting !== null}
            style={{
              border: `1px solid ${C.navy}`,
              borderRadius: 8,
              padding: "14px 8px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "default",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: C.bgSurface,
              color: C.navy,
              opacity: 0.5,
            }}
          >
            <i className="ti ti-edit" /> Revise
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={submitting !== null}
            style={{
              border: `1px solid ${C.l1Stroke}`,
              borderRadius: 8,
              padding: "14px 8px",
              fontSize: 13,
              fontWeight: 500,
              cursor: submitting ? "default" : "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: C.bgSurface,
              color: C.l1Text,
            }}
          >
            <i className="ti ti-x" /> Reject
          </button>
        </div>
      )}

      {quote && isTerminal && (
        <div
          style={{
            padding: "12px 16px",
            background: C.bgSecondary,
            borderRadius: 8,
            fontSize: 12,
            color: C.textSecondary,
            textAlign: "center",
          }}
        >
          Decision recorded — status: <strong>{quote.quote_status}</strong>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div
          onClick={() => setShowRejectModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.bgSurface,
              borderRadius: 12,
              padding: 18,
              width: "100%",
              maxWidth: 400,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
              Reject this quote?
            </div>
            <div
              style={{
                fontSize: 12,
                color: C.textSecondary,
                marginBottom: 14,
                lineHeight: 1.5,
              }}
            >
              The customer won't receive this quote. Pipeline will flag the conversation
              for manual follow-up. Why are you rejecting?
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., need site visit before quoting, scope unclear…"
              style={{
                width: "100%",
                minHeight: 80,
                background: C.bgSecondary,
                border: `0.5px solid ${C.borderMid}`,
                borderRadius: 6,
                padding: 10,
                fontSize: 12,
                fontFamily: "inherit",
                resize: "vertical",
                marginBottom: 12,
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowRejectModal(false)}
                style={{
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 500,
                  background: C.bgSecondary,
                  color: C.textSecondary,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  void submitDecision("reject");
                }}
                style={{
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 500,
                  background: C.l1Stroke,
                  color: "white",
                }}
              >
                Reject &amp; flag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
