"use client";

import { C } from "../dashboard/tokens";
import { relativeTime, type IndexEntry } from "./dashboardApi";

export default function QuoteApprovalsScreen({
  conversations,
  onBack,
  onReviewQuote,
}: {
  conversations: IndexEntry[];
  onBack: () => void;
  onReviewQuote: (id: string) => void;
}) {
  const pending = conversations.filter((c) => c.status === "quoted");

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 24px 48px", color: C.textPrimary }}>
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
            fontSize: 20,
            color: C.textPrimary,
            marginLeft: -6,
          }}
        >
          <i className="ti ti-chevron-left" />
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Quote approvals</div>
          <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
            Drafted by agent · awaiting your sign-off
          </div>
        </div>
      </div>

      {/* Context banner */}
      <div
        style={{
          background: C.l2Fill,
          border: `0.5px solid ${C.l2Stroke}`,
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 12,
          color: C.l2Text,
          marginBottom: 16,
          display: "flex",
          gap: 8,
          alignItems: "center",
          lineHeight: 1.4,
        }}
      >
        <i className="ti ti-file-dollar" style={{ fontSize: 16, flexShrink: 0 }} />
        Approve to send to the customer. The customer won't see anything until you sign off.
      </div>

      {pending.length === 0 && (
        <div style={{ textAlign: "center", color: C.textSecondary, marginTop: 48, fontSize: 14 }}>
          No quotes waiting for approval right now.
        </div>
      )}

      {pending.map((c) => {
        const name = c.display_label || c.customer_name || "Unknown";
        const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

        return (
          <div
            key={c.conversation_id}
            style={{
              background: C.bgSurface,
              border: `0.5px solid ${C.borderLight}`,
              borderRadius: 10,
              padding: "14px 16px",
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: C.l2Stroke,
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{name}</div>
                <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
                  {relativeTime(c.updated_at)}
                </div>
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 500,
                  padding: "3px 10px",
                  borderRadius: 100,
                  background: C.l2Fill,
                  color: C.l2Text,
                  border: `0.5px solid ${C.l2Stroke}`,
                }}
              >
                Awaiting review
              </span>
            </div>

            <div
              style={{
                fontSize: 12,
                color: C.textSecondary,
                marginBottom: 12,
                lineHeight: 1.4,
              }}
            >
              {c.summary}
            </div>

            <button
              onClick={() => onReviewQuote(c.conversation_id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 18px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                border: "none",
                background: C.navy,
                color: "white",
              }}
            >
              <i className="ti ti-eye" />
              Review quote
            </button>
          </div>
        );
      })}
    </div>
  );
}
