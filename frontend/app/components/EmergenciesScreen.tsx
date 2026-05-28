"use client";

import { useCallback, useEffect, useState } from "react";

import { C } from "../dashboard/tokens";
import { getConversation } from "./api";
import { relativeTime, type IndexEntry } from "./dashboardApi";
import type { ConversationState } from "./types";

function ActionBtn({
  icon,
  label,
  primary,
  href,
  onClick,
}: {
  icon: string;
  label: string;
  primary?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    textDecoration: "none",
    border: "none",
  };
  const style: React.CSSProperties = primary
    ? { ...base, background: C.l1Stroke, color: "white" }
    : { ...base, background: C.bgSecondary, color: C.textPrimary, border: `0.5px solid ${C.borderMid}` };

  if (href) {
    return (
      <a href={href} style={style}>
        <i className={`ti ${icon}`} />
        {label}
      </a>
    );
  }
  return (
    <button style={style} onClick={onClick}>
      <i className={`ti ${icon}`} />
      {label}
    </button>
  );
}

function EmergencyCard({
  entry,
  apiUrl,
  onViewTranscript,
}: {
  entry: IndexEntry;
  apiUrl: string;
  onViewTranscript: (id: string) => void;
}) {
  const [conv, setConv] = useState<ConversationState | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getConversation(apiUrl, entry.conversation_id);
      setConv(s);
    } catch {
      // fall back to IndexEntry data
    }
  }, [apiUrl, entry.conversation_id]);

  useEffect(() => { void load(); }, [load]);

  const customer = conv?.last_turn?.customer ?? {};
  const triage = conv?.last_turn?.triage;
  const name = entry.display_label || entry.customer_name || customer.name || "Unknown";
  const phone = customer.phone;
  const email = customer.email;
  const reason = triage?.reason ?? entry.summary;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div
      style={{
        background: C.l1Fill,
        border: `1.5px solid ${C.l1Stroke}`,
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 12,
        position: "relative",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: C.l1Stroke,
            color: C.l1Fill,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.l1Deep }}>{name}</div>
          <div style={{ fontSize: 11, color: C.l1Text, marginTop: 2 }}>
            {relativeTime(entry.updated_at)}
          </div>
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 500,
            padding: "3px 10px",
            borderRadius: 100,
            background: C.l1Stroke,
            color: "white",
          }}
        >
          Emergency
        </span>
      </div>

      {/* Contact + reason grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "6px 16px",
          fontSize: 12,
          marginBottom: 12,
        }}
      >
        {phone && (
          <>
            <span style={{ color: C.textSecondary }}>Phone</span>
            <span style={{ color: C.l1Deep, fontWeight: 500 }}>{phone}</span>
          </>
        )}
        {email && (
          <>
            <span style={{ color: C.textSecondary }}>Email</span>
            <span style={{ color: C.l1Deep }}>{email}</span>
          </>
        )}
        <span style={{ color: C.textSecondary, alignSelf: "start" }}>Situation</span>
        <span style={{ color: C.l1Deep, lineHeight: 1.4 }}>{reason}</span>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {phone ? (
          <ActionBtn icon="ti-phone" label="Call now" primary href={`tel:${phone}`} />
        ) : (
          <ActionBtn icon="ti-phone" label="Call now" primary onClick={() => showToast("No phone number captured yet.")} />
        )}
        <ActionBtn
          icon="ti-truck"
          label="Dispatch myself"
          onClick={() => showToast("Dispatching — mark ETA in notes.")}
        />
        <ActionBtn
          icon="ti-users"
          label="Find a sub"
          onClick={() => showToast("Sub dispatch not yet wired — call your contact list.")}
        />
        <ActionBtn
          icon="ti-eye"
          label="Transcript"
          onClick={() => onViewTranscript(entry.conversation_id)}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "absolute",
            bottom: -40,
            left: 0,
            right: 0,
            textAlign: "center",
            background: C.navyDark,
            color: "white",
            fontSize: 12,
            padding: "8px 12px",
            borderRadius: 6,
            zIndex: 10,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default function EmergenciesScreen({
  apiUrl,
  conversations,
  onBack,
  onViewTranscript,
}: {
  apiUrl: string;
  conversations: IndexEntry[];
  onBack: () => void;
  onViewTranscript: (id: string) => void;
}) {
  const emergencies = conversations.filter(
    (c) => c.urgency === "emergency" && !c.status.startsWith("closed")
  );

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
          <div style={{ fontSize: 18, fontWeight: 500 }}>Emergencies</div>
          <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
            Active · dispatch decision needed
          </div>
        </div>
      </div>

      {/* Context banner */}
      <div
        style={{
          background: C.l1Fill,
          border: `0.5px solid ${C.l1Stroke}`,
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 12,
          color: C.l1Text,
          marginBottom: 16,
          display: "flex",
          gap: 8,
          alignItems: "center",
          lineHeight: 1.4,
        }}
      >
        <i className="ti ti-flame" style={{ fontSize: 16, flexShrink: 0 }} />
        Active emergencies requiring your call. Call the customer first, then decide on dispatch.
      </div>

      {emergencies.length === 0 && (
        <div style={{ textAlign: "center", color: C.textSecondary, marginTop: 48, fontSize: 14 }}>
          No active emergencies right now.
        </div>
      )}

      {emergencies.map((e) => (
        <EmergencyCard
          key={e.conversation_id}
          entry={e}
          apiUrl={apiUrl}
          onViewTranscript={onViewTranscript}
        />
      ))}
    </div>
  );
}
