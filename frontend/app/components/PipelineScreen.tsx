"use client";

import React, { useState } from "react";

import { C, urgencyColors, urgencyLabel, statusLabel } from "../dashboard/tokens";
import { byCreatedDesc, relativeTime, type IndexEntry } from "./dashboardApi";

function GroupHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: C.textSecondary,
        margin: "16px 4px 6px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      <i className={`ti ${icon}`} />
      {label}
    </div>
  );
}

function ConvRow({
  row,
  onClick,
}: {
  row: IndexEntry;
  onClick: () => void;
}) {
  const uc = urgencyColors(row.urgency);
  const isEmergency = row.urgency === "emergency" || (row.urgency as string) === "safety_escalation";
  const isClosed = row.status.startsWith("closed");

  const statusPillStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 500,
    padding: "2px 8px",
    borderRadius: 100,
    background: C.bgSecondary,
    color: C.textSecondary,
  };

  const needsYouPill: React.CSSProperties = {
    ...statusPillStyle,
    background: C.bgSurface,
    border: `0.5px solid ${C.borderMid}`,
    color: C.textPrimary,
  };

  const bookedPill: React.CSSProperties = {
    ...statusPillStyle,
    background: C.greenFill,
    color: C.greenText,
  };

  function pillForRow(r: IndexEntry): React.CSSProperties {
    if (r.status === "booked") return bookedPill;
    if (r.status === "new" || r.urgency === "emergency") return needsYouPill;
    if (r.status === "quoted") return needsYouPill;
    return statusPillStyle;
  }

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        background: isEmergency ? uc.fill : C.bgSurface,
        border: `0.5px solid ${isEmergency ? uc.stroke : C.borderLight}`,
        borderLeft: `5px solid ${uc.stroke}`,
        borderRadius: 8,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        padding: "10px 12px 10px 14px",
        marginBottom: 6,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background 0.15s",
        opacity: isClosed ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 500, flex: 1, color: isEmergency ? uc.text : C.textPrimary }}>
          {row.display_label || row.customer_name || "Unknown"}
        </div>
        <div style={{ fontSize: 11, color: isEmergency ? uc.stroke : C.textSecondary }}>
          {relativeTime(row.updated_at)}
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          color: isEmergency ? uc.text : C.textSecondary,
          lineHeight: 1.4,
          marginBottom: 6,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {row.summary}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: 100,
            background: uc.stroke,
            color: uc.fill,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          {urgencyLabel(row.urgency)}
        </span>
        <span style={pillForRow(row)}>{statusLabel(row.status)}</span>
      </div>
    </button>
  );
}

export default function PipelineScreen({
  conversations,
  onSelectConversation,
}: {
  conversations: IndexEntry[];
  onSelectConversation: (id: string) => void;
}) {
  // Group conversations. Each bucket is independently sorted by creation
  // time descending — newest at the top within its section.
  const needsYou = conversations
    .filter(
      (c) =>
        !c.status.startsWith("closed") &&
        c.status !== "booked" &&
        (c.urgency === "emergency" ||
          (c.urgency as string) === "safety_escalation" ||
          c.status === "new" ||
          c.status === "quoted")
    )
    .sort(byCreatedDesc);

  const customerSide = conversations
    .filter(
      (c) =>
        !c.status.startsWith("closed") &&
        c.status !== "booked" &&
        c.status === "in_progress" &&
        c.urgency !== "emergency" &&
        (c.urgency as string) !== "safety_escalation"
    )
    .sort(byCreatedDesc);

  const booked = conversations
    .filter((c) => c.status === "booked")
    .sort(byCreatedDesc);

  const closed = conversations
    .filter((c) => c.status.startsWith("closed"))
    .sort(byCreatedDesc);

  const [closedOpen, setClosedOpen] = useState(false);

  return (
    <div
      style={{
        maxWidth: 780,
        margin: "0 auto",
        padding: "24px 24px 48px",
        color: C.textPrimary,
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 500 }}>Pipeline</div>
        <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
          All active conversations
        </div>
      </div>

      {conversations.length === 0 && (
        <div style={{ textAlign: "center", color: C.textSecondary, marginTop: 48, fontSize: 14 }}>
          No conversations yet. New customer messages will appear here.
        </div>
      )}

      {needsYou.length > 0 && (
        <>
          <GroupHeader icon="ti-alert-triangle" label={`Needs you · ${needsYou.length}`} />
          {needsYou.map((c) => (
            <ConvRow key={c.conversation_id} row={c} onClick={() => onSelectConversation(c.conversation_id)} />
          ))}
        </>
      )}

      {customerSide.length > 0 && (
        <>
          <GroupHeader icon="ti-clock" label={`In progress · ${customerSide.length}`} />
          {customerSide.map((c) => (
            <ConvRow key={c.conversation_id} row={c} onClick={() => onSelectConversation(c.conversation_id)} />
          ))}
        </>
      )}

      {booked.length > 0 && (
        <>
          <GroupHeader icon="ti-calendar-check" label={`Booked · ${booked.length}`} />
          {booked.map((c) => (
            <ConvRow key={c.conversation_id} row={c} onClick={() => onSelectConversation(c.conversation_id)} />
          ))}
        </>
      )}

      {closed.length > 0 && (
        <>
          <button
            onClick={() => setClosedOpen((v) => !v)}
            style={{
              width: "100%",
              cursor: "pointer",
              padding: "12px 14px",
              background: C.bgSurface,
              border: `0.5px solid ${C.borderLight}`,
              borderRadius: 8,
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12,
              color: C.textPrimary,
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                background: C.bgSecondary,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.textSecondary,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              <i className="ti ti-archive" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>Closed · {closed.length}</div>
              <div style={{ fontSize: 10, color: C.textSecondary, marginTop: 2 }}>
                {closedOpen ? "Tap to collapse" : "Tap to see archived conversations"}
              </div>
            </div>
            <i
              className="ti ti-chevron-right"
              style={{
                color: C.textSecondary,
                fontSize: 16,
                transform: closedOpen ? "rotate(90deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </button>
          {closedOpen &&
            closed.map((c) => (
              <ConvRow key={c.conversation_id} row={c} onClick={() => onSelectConversation(c.conversation_id)} />
            ))}
        </>
      )}
    </div>
  );
}

