"use client";

import { useEffect, useState } from "react";

import LifecycleBadge from "./LifecycleBadge";
import UrgencyChip from "./UrgencyChip";
import {
  getConversations,
  relativeTime,
  sortForDashboard,
  type IndexEntry,
} from "./dashboardApi";

export default function DashboardList({
  apiUrl,
  selectedId,
  onSelect,
}: {
  apiUrl: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [rows, setRows] = useState<IndexEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const index = await getConversations(apiUrl);
        if (!cancelled) {
          setRows(sortForDashboard(index.conversations));
          setError(null);
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    void tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [apiUrl]);

  const emergencyCount = rows.filter((r) => r.urgency === "emergency").length;

  return (
    <aside
      style={{
        width: "100%",
        maxWidth: 420,
        borderRight: "1px solid #e5e7eb",
        background: "white",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <header style={{ padding: "0.9rem 1rem", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700 }}>Pipeline — Jill's Dashboard</div>
          {emergencyCount > 0 && (
            <span style={{ color: "#dc2626", fontSize: "0.85rem", fontWeight: 600 }}>
              {emergencyCount} emergency
            </span>
          )}
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {error && (
          <div
            style={{
              margin: "0.6rem 1rem",
              padding: "0.5rem 0.75rem",
              borderRadius: 6,
              background: "#fee2e2",
              color: "#991b1b",
              fontSize: "0.85rem",
            }}
          >
            Couldn't load conversations: {error}
          </div>
        )}
        {!loaded && !error && (
          <div style={{ padding: "1rem", color: "#9ca3af" }}>Loading…</div>
        )}
        {loaded && rows.length === 0 && (
          <div
            style={{
              padding: "2rem 1rem",
              color: "#6b7280",
              textAlign: "center",
              fontSize: "0.9rem",
            }}
          >
            No conversations yet. New customer messages will appear here.
          </div>
        )}
        {rows.map((row) => {
          const isSelected = row.conversation_id === selectedId;
          const isEmergency = row.urgency === "emergency";
          return (
            <button
              key={row.conversation_id}
              onClick={() => onSelect(row.conversation_id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.85rem 1rem",
                background: isSelected ? "#eff6ff" : "white",
                borderLeft: isSelected
                  ? "3px solid #2563eb"
                  : isEmergency
                    ? "3px solid #dc2626"
                    : "3px solid transparent",
                borderTop: "none",
                borderRight: "none",
                borderBottom: "1px solid #f3f4f6",
                cursor: "pointer",
                color: "#111827",
                font: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontWeight: 600 }}>
                  {row.display_label || row.customer_name || "Unknown"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  {relativeTime(row.updated_at)}
                </div>
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#374151",
                  marginTop: "0.2rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={row.summary}
              >
                {row.summary || <span style={{ color: "#9ca3af" }}>(no message)</span>}
              </div>
              <div style={{ marginTop: "0.4rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {row.urgency && <UrgencyChip level={row.urgency} />}
                <LifecycleBadge status={row.status} subReason={row.sub_reason} />
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
