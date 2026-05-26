"use client";

import { useState } from "react";
import { relativeTime, type IndexEntry } from "../dashboardApi";
import { C } from "./tokens";

interface Props {
  rows: IndexEntry[];
  onSelect: (id: string) => void;
}

export default function CalendarScreen({ rows, onSelect }: Props) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const booked = rows.filter((r) => r.status === "booked");

  // Group by date string (YYYY-MM-DD) using updated_at as proxy
  const byDay: Record<string, IndexEntry[]> = {};
  for (const r of booked) {
    const day = r.updated_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(r);
  }
  const sortedDays = Object.keys(byDay).sort((a, b) => b.localeCompare(a));

  const today = new Date().toISOString().slice(0, 10);

  // Month grid — current month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const monthLabel = now.toLocaleString("en-CA", { month: "long", year: "numeric" });

  return (
    <div style={{ paddingTop: 14 }}>
      {/* Month grid */}
      <div style={{ background: C.bgSurface, border: `0.5px solid ${C.borderLight}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{monthLabel}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 500, color: C.textSecondary, padding: 4, textTransform: "uppercase" }}>
              {d}
            </div>
          ))}
          {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const hasBookings = !!byDay[dayStr];
            const isToday = dayStr === today;
            return (
              <button
                key={dayStr}
                onClick={() => setExpandedDay(expandedDay === dayStr ? null : dayStr)}
                style={{
                  aspectRatio: "1", background: hasBookings ? C.l2Fill : C.bgSurface,
                  border: isToday ? `2px solid ${C.navy}` : `0.5px solid ${hasBookings ? C.l2Stroke : C.borderLight}`,
                  borderRadius: 6, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", cursor: "pointer",
                  fontSize: 12, position: "relative", fontFamily: "inherit",
                  fontWeight: isToday ? 500 : undefined,
                }}
              >
                {dayNum}
                {hasBookings && (
                  <span style={{
                    position: "absolute", top: 2, right: 3,
                    background: C.l2Stroke, color: "white",
                    fontSize: 8, padding: "1px 4px", borderRadius: 100, fontWeight: 500,
                  }}>
                    {byDay[dayStr].length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day expansion */}
      {expandedDay && byDay[expandedDay] && (
        <div style={{ background: C.bgSecondary, borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: C.textSecondary, marginBottom: 8 }}>
            {new Date(expandedDay + "T12:00:00").toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          {byDay[expandedDay].map((r) => (
            <button
              key={r.conversation_id}
              onClick={() => onSelect(r.conversation_id)}
              style={{
                width: "100%", textAlign: "left", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 8px", borderRadius: 6, marginBottom: 4,
                background: C.bgSurface, border: `0.5px solid ${C.borderLight}`, cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 500, minWidth: 60, color: C.textPrimary }}>
                {relativeTime(r.updated_at)}
              </div>
              <div style={{ flex: 1, fontSize: 12 }}>
                {r.display_label || r.customer_name || "Unknown"}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* List of days with bookings */}
      {sortedDays.length === 0 ? (
        <div style={{ textAlign: "center", color: C.textTertiary, fontSize: 13, padding: "32px 0" }}>
          <i className="ti ti-calendar" style={{ fontSize: 28, display: "block", marginBottom: 8 }} />
          No bookings yet.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, fontWeight: 500, color: C.textSecondary, margin: "16px 4px 8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Booked jobs
          </div>
          {sortedDays.map((day) => (
            <div key={day} style={{ background: C.bgSurface, border: `0.5px solid ${C.borderLight}`, borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: C.bgSecondary, fontSize: 12, fontWeight: 500, display: "flex", justifyContent: "space-between" }}>
                <span>{new Date(day + "T12:00:00").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}</span>
                <span style={{ fontSize: 10, color: C.textSecondary }}>{byDay[day].length} job{byDay[day].length !== 1 ? "s" : ""}</span>
              </div>
              {byDay[day].map((r) => (
                <button
                  key={r.conversation_id}
                  onClick={() => onSelect(r.conversation_id)}
                  style={{
                    width: "100%", textAlign: "left", fontFamily: "inherit",
                    padding: "10px 14px",
                    background: "transparent", border: "none", borderBottom: `0.5px solid ${C.borderLight}`,
                    cursor: "pointer", display: "flex", gap: 10, alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1, fontSize: 13 }}>
                    {r.display_label || r.customer_name || "Unknown"}
                  </div>
                  <div style={{ fontSize: 11, color: C.textSecondary }}>
                    {relativeTime(r.updated_at)}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
