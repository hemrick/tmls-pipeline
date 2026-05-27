"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import ActionsPanel from "../ActionsPanel";
import QuoteApprovalPanel from "../QuoteApprovalPanel";
import { getConversation } from "../api";
import { relativeTime } from "../dashboardApi";
import type { Booking, ConversationState, Customer, Quote, Triage } from "../types";
import { C, urgencyColors } from "./tokens";

export default function ConvDetailMobile({
  apiUrl,
  conversationId,
}: {
  apiUrl: string;
  conversationId: string;
}) {
  const [state, setState] = useState<ConversationState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getConversation(apiUrl, conversationId);
      setState(s);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [apiUrl, conversationId]);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  if (error && !state) {
    return (
      <div style={{ padding: "12px 0" }}>
        <div style={{ background: C.l1Fill, color: C.l1Text, padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
          Couldn&apos;t load conversation: {error}
        </div>
      </div>
    );
  }
  if (!state) {
    return <div style={{ padding: "24px 0", color: C.textTertiary, textAlign: "center", fontSize: 13 }}>Loading…</div>;
  }

  const lt = state.last_turn;
  const customer: Customer = lt.customer ?? {};
  const col = urgencyColors(lt.urgency);

  return (
    <div style={{ paddingTop: 14 }}>
      {/* Customer header card */}
      <div style={{ background: C.bgSurface, border: `0.5px solid ${C.borderLight}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
            background: col.stroke, color: col.fill,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 500, fontSize: 14,
          }}>
            {(state.display_label || customer.name || "?").charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500 }}>
              {state.display_label || customer.name || "Unknown customer"}
            </div>
            <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
              Updated {relativeTime(state.updated_at)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {lt.urgency && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100,
              background: col.stroke, color: col.fill,
            }}>
              {lt.urgency === "emergency" ? "⚠ Emergency" : lt.urgency === "priority" ? "Priority" : "Scheduled"}
            </span>
          )}
          <StatusBadge status={lt.status} />
        </div>
        {(customer.phone || customer.email) && (
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 13 }}>
            {customer.phone && <span>📞 {customer.phone}</span>}
            {customer.email && <span>✉ {customer.email}</span>}
          </div>
        )}
      </div>

      {/* Transcript */}
      {state.messages.length > 0 && (
        <Card title="Conversation">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
            {state.messages.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "85%", padding: "8px 12px",
                  borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.role === "user" ? C.bgSecondary : C.bgSurface,
                  border: m.role === "agent" ? `1px solid ${C.l2Stroke}` : `0.5px solid ${C.borderLight}`,
                  fontSize: 13, lineHeight: 1.4, whiteSpace: "pre-wrap",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Triage */}
      {lt.triage && <TriageCard triage={lt.triage} />}

      {/* Quote */}
      {lt.quote && (
        <Card title="Quote">
          <div style={{ fontSize: 13, color: C.textPrimary }}>
            <div style={{ marginBottom: 6 }}>
              <strong>Summary:</strong> {lt.quote.job_summary}
            </div>
            <div style={{ marginBottom: 6 }}>
              <strong>Estimate:</strong> {lt.quote.estimated_price_range}
            </div>
            {lt.quote.scope.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <strong>Scope:</strong>
                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                  {lt.quote.scope.map((s, i) => <li key={i} style={{ fontSize: 12 }}>{s}</li>)}
                </ul>
              </div>
            )}
            {lt.quote.disclaimer && (
              <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 4 }}>
                {lt.quote.disclaimer}
              </div>
            )}
          </div>
          <div style={{
            marginTop: 14, paddingTop: 14,
            borderTop: `1px solid ${C.borderLight}`,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.textSecondary,
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
            }}>
              Your decision
            </div>
            <QuoteApprovalPanel
              apiUrl={apiUrl}
              conversationId={conversationId}
              quote={lt.quote}
              onChanged={refresh}
            />
          </div>
        </Card>
      )}

      {/* Booking */}
      {lt.booking && lt.booking.booking_status !== "not_started" && (
        <BookingCard booking={lt.booking} />
      )}

      {/* Actions */}
      <Card title="Actions">
        <ActionsPanel
          apiUrl={apiUrl}
          conversationId={conversationId}
          alreadyClosed={lt.status === "closed_done" || lt.status === "closed_no_action"}
          onChanged={refresh}
        />
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{
      background: C.bgSurface, border: `0.5px solid ${C.borderLight}`,
      borderRadius: 12, padding: "14px 16px", marginBottom: 10,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
        color: C.textSecondary, marginBottom: 10, textTransform: "uppercase",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function TriageCard({ triage }: { triage: Triage }) {
  return (
    <Card title="Triage">
      <div style={{ fontSize: 13, color: C.textPrimary }}>
        {triage.urgency_level && (
          <div style={{ marginBottom: 4 }}>
            <strong>Urgency:</strong> {triage.urgency_level}
            {typeof (triage as { confidence?: number }).confidence === "number" && (
              <span style={{ marginLeft: 8, fontSize: 11, color: C.textSecondary }}>
                confidence {((triage as { confidence: number }).confidence).toFixed(2)}
              </span>
            )}
          </div>
        )}
        {triage.reason && (
          <div><strong>Reason:</strong> {triage.reason}</div>
        )}
        {triage.needs_clarification && (
          <div style={{ marginTop: 6, color: C.l0Text, fontSize: 12 }}>
            ⚠ Needs clarification — borderline priority/scheduled.
          </div>
        )}
      </div>
    </Card>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <Card title="Booking">
      <div style={{ fontSize: 13, color: C.textPrimary }}>
        <div><strong>Status:</strong> {booking.booking_status}</div>
        {booking.selected_slot && (
          <div style={{ marginTop: 4 }}><strong>Slot:</strong> {booking.selected_slot.label}</div>
        )}
        {!booking.selected_slot && booking.slots_offered?.length && (
          <div style={{ marginTop: 4 }}>
            <strong>Offered:</strong> {booking.slots_offered.map((s) => s.label).join(", ")}
          </div>
        )}
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: ConversationState["last_turn"]["status"] }) {
  const cfg: Record<string, { bg: string; fg: string; label: string }> = {
    new:              { bg: "#3b82f6", fg: "white",       label: "New" },
    in_progress:      { bg: "#1d4ed8", fg: "white",       label: "In Progress" },
    quoted:           { bg: "#16a34a", fg: "white",       label: "Quoted" },
    booked:           { bg: "#16a34a", fg: "white",       label: "Booked" },
    closed_done:      { bg: "#64748b", fg: "white",       label: "Closed" },
    closed_no_action: { bg: "#94a3b8", fg: "white",       label: "Closed" },
  };
  const s = cfg[status];
  if (!s) return null;
  return (
    <span style={{
      fontSize: 11, padding: "3px 10px", borderRadius: 100,
      background: s.bg, color: s.fg, fontWeight: 600,
    }}>
      {s.label}
    </span>
  );
}
