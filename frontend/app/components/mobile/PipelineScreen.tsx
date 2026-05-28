"use client";

import { useState } from "react";
import { relativeTime, sortForDashboard, type IndexEntry } from "../dashboardApi";
import { C, urgencyColors } from "./tokens";

interface Props {
  rows: IndexEntry[];
  onSelect: (id: string) => void;
}

export default function PipelineScreen({ rows, onSelect }: Props) {
  const [closedExpanded, setClosedExpanded] = useState(false);
  const sorted = sortForDashboard(rows);

  const needsYou = sorted.filter(
    (r) =>
      (r.status === "new" || r.status === "in_progress" || r.status === "quoted") &&
      (r.urgency === "emergency" || r.urgency === "priority"),
  );
  const customerSide = sorted.filter(
    (r) =>
      (r.status === "in_progress" || r.status === "quoted") &&
      r.urgency !== "emergency" && r.urgency !== "priority",
  );
  const booked = sorted.filter((r) => r.status === "booked");
  const closed = sorted.filter(
    (r) => r.status === "closed_done" || r.status === "closed_no_action",
  );
  // Catch remaining new/in-progress with no urgency not already placed
  const remaining = sorted.filter(
    (r) =>
      (r.status === "new" || r.status === "in_progress") &&
      r.urgency !== "emergency" && r.urgency !== "priority" &&
      !customerSide.includes(r),
  );
  const customerSideAll = [...customerSide, ...remaining];

  return (
    <div style={{ paddingTop: 14 }}>
      {sorted.length === 0 && (
        <div style={{ textAlign: "center", color: C.textTertiary, fontSize: 13, padding: "32px 0" }}>
          No conversations yet.
        </div>
      )}

      <ConvGroup
        label="Needs you"
        badge={needsYou.length}
        rows={needsYou}
        onSelect={onSelect}
      />
      <ConvGroup
        label="Customer-side"
        badge={customerSideAll.length}
        rows={customerSideAll}
        onSelect={onSelect}
      />
      <ConvGroup
        label="Booked"
        badge={booked.length}
        rows={booked}
        onSelect={onSelect}
      />

      {/* Closed — collapsible */}
      {closed.length > 0 && (
        <>
          <button
            onClick={() => setClosedExpanded((v) => !v)}
            style={{
              cursor: "pointer", padding: "12px 14px",
              background: C.bgSurface, border: `0.5px solid ${C.borderLight}`,
              borderRadius: 8, marginTop: 12,
              display: "flex", alignItems: "center", gap: 10,
              fontSize: 12, color: C.textPrimary, width: "100%",
              fontFamily: "inherit", textAlign: "left",
            }}
          >
            <div style={{
              width: 28, height: 28, background: C.bgSecondary, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: C.textSecondary, fontSize: 14, flexShrink: 0,
            }}>
              <i className="ti ti-archive" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>Closed</div>
              <div style={{ fontSize: 10, color: C.textSecondary, marginTop: 2 }}>
                {closed.length} conversation{closed.length !== 1 ? "s" : ""}
              </div>
            </div>
            <i
              className="ti ti-chevron-right"
              style={{
                color: C.textSecondary, fontSize: 16,
                transform: closedExpanded ? "rotate(90deg)" : undefined,
                transition: "transform 0.2s",
              }}
            />
          </button>
          {closedExpanded && (
            <div style={{ marginTop: 6 }}>
              {closed.map((r) => <ConvRow key={r.conversation_id} row={r} onSelect={onSelect} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ConvGroup({ label, badge, rows, onSelect }: {
  label: string; badge: number; rows: IndexEntry[]; onSelect: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <div style={{
        fontSize: 11, fontWeight: 500, color: C.textSecondary,
        margin: "14px 4px 6px", display: "flex", alignItems: "center",
        gap: 6, textTransform: "uppercase", letterSpacing: "0.04em",
      }}>
        {label}
        <span style={{
          background: C.bgSecondary, color: C.textSecondary,
          fontSize: 9, padding: "1px 6px", borderRadius: 100, fontWeight: 500,
        }}>
          {badge}
        </span>
      </div>
      {rows.map((r) => <ConvRow key={r.conversation_id} row={r} onSelect={onSelect} />)}
    </>
  );
}

function ConvRow({ row, onSelect }: { row: IndexEntry; onSelect: (id: string) => void }) {
  const col = urgencyColors(row.urgency);
  return (
    <button
      onClick={() => onSelect(row.conversation_id)}
      style={{
        width: "100%", textAlign: "left", fontFamily: "inherit",
        background: row.urgency === "emergency" ? C.l1Fill : row.urgency === "priority" ? C.l2Fill : C.bgSurface,
        borderRadius: "0 8px 8px 0",
        border: `0.5px solid ${col.stroke}`,
        borderLeft: `5px solid ${col.stroke}`,
        padding: "10px 12px 10px 14px", marginBottom: 6,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 500, flex: 1, color: col.deep }}>
          {row.display_label || row.customer_name || "Unknown"}
        </div>
        <div style={{ fontSize: 11, color: col.stroke, flexShrink: 0 }}>
          {relativeTime(row.updated_at)}
        </div>
      </div>
      {row.summary && (
        <div style={{
          fontSize: 11, color: col.text, lineHeight: 1.4, marginBottom: 6,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {row.summary}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {row.urgency && (
          <span style={{
            fontSize: 9, fontWeight: 500, padding: "2px 8px", borderRadius: 100,
            background: col.stroke, color: col.fill, display: "inline-flex", alignItems: "center",
          }}>
            {row.urgency === "emergency" ? "⚠ Emergency" : row.urgency === "priority" ? "Priority" : "Scheduled"}
          </span>
        )}
        <StatusPill status={row.status} />
      </div>
    </button>
  );
}

function StatusPill({ status }: { status: IndexEntry["status"] }) {
  const cfg: Record<string, { bg: string; fg: string; label: string }> = {
    new:             { bg: C.bgSurface,  fg: C.textPrimary,   label: "New" },
    in_progress:     { bg: C.bgSecondary, fg: C.textSecondary, label: "In progress" },
    quoted:          { bg: C.bgSurface,  fg: C.textPrimary,   label: "Needs review" },
    booked:          { bg: C.greenFill,  fg: C.greenText,     label: "Booked" },
    closed_done:     { bg: C.bgSecondary, fg: C.textSecondary, label: "Done" },
    closed_no_action:{ bg: C.bgSecondary, fg: C.textSecondary, label: "Closed" },
  };
  const s = cfg[status];
  if (!s) return null;
  return (
    <span style={{
      fontSize: 9, fontWeight: 500, padding: "2px 8px", borderRadius: 100,
      background: s.bg, color: s.fg,
      border: status === "quoted" ? `0.5px solid ${C.borderMid}` : undefined,
    }}>
      {s.label}
    </span>
  );
}
