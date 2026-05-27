"use client";

import { useEffect, useState } from "react";

import EmergenciesScreen from "../components/EmergenciesScreen";
import PipelineScreen from "../components/PipelineScreen";
import QuoteApprovalsScreen from "../components/QuoteApprovalsScreen";
import QuoteReviewScreen from "../components/QuoteReviewScreen";
import TodayScreen from "../components/TodayScreen";
import { getConversations, sortForDashboard, type IndexEntry } from "../components/dashboardApi";
import { C } from "./tokens";

type Screen = "today" | "pipeline" | "quote-review" | "emergencies" | "quote-approvals";

const NAV_ITEMS: { id: Screen | "calendar"; icon: string; label: string }[] = [
  { id: "today",    icon: "ti-home",         label: "Today" },
  { id: "pipeline", icon: "ti-list-details", label: "Pipeline" },
  { id: "calendar", icon: "ti-calendar",     label: "Schedule" },
];

export default function DashboardClient({ apiUrl, calendlyUrl }: { apiUrl: string; calendlyUrl: string }) {
  const [screen, setScreen] = useState<Screen>("today");
  const [previousScreen, setPreviousScreen] = useState<Screen>("pipeline");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<IndexEntry[]>([]);
  const [convError, setConvError] = useState<string | null>(null);

  // Poll the conversation index every 3 s
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const index = await getConversations(apiUrl);
        if (!cancelled) {
          setConversations(sortForDashboard(index.conversations));
          setConvError(null);
        }
      } catch (err) {
        if (!cancelled) setConvError(err instanceof Error ? err.message : String(err));
      }
    }
    void tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [apiUrl]);

  function handleSelectConversation(id: string) {
    setPreviousScreen(screen === "quote-review" ? previousScreen : screen);
    setSelectedConvId(id);
    setScreen("quote-review");
  }

  const pendingQuoteCount = conversations.filter((c) => c.status === "quoted").length;
  const emergencyCount = conversations.filter(
    (c) => c.urgency === "emergency" && !c.status.startsWith("closed")
  ).length;

  const activeNavId: string =
    screen === "quote-review" ? "pipeline" : screen;

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        background: "#E8E6DE",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        fontSize: 14,
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: C.navy,
          display: "flex",
          flexDirection: "column",
          padding: "20px 0",
          gap: 4,
        }}
      >
        {/* Logo */}
        <div style={{ padding: "0 16px 20px" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "white", lineHeight: 1.2 }}>
            Pipe Dreams
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
            Jill's dashboard
          </div>
        </div>

        {/* Nav items */}
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeNavId;
          const badge =
            item.id === "today"
              ? emergencyCount > 0
                ? emergencyCount
                : null
              : item.id === "pipeline"
              ? pendingQuoteCount > 0
                ? pendingQuoteCount
                : null
              : null;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "calendar") return; // not implemented yet
                setScreen(item.id as Screen);
              }}
              style={{
                background: active ? "rgba(255,255,255,0.12)" : "transparent",
                border: "none",
                borderLeft: active ? "3px solid white" : "3px solid transparent",
                borderRight: "none",
                borderTop: "none",
                borderBottom: "none",
                cursor: item.id === "calendar" ? "default" : "pointer",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: active ? "white" : "rgba(255,255,255,0.65)",
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                fontFamily: "inherit",
                textAlign: "left",
                width: "100%",
                position: "relative",
                opacity: item.id === "calendar" ? 0.4 : 1,
              }}
            >
              <i className={`ti ${item.icon}`} style={{ fontSize: 18 }} />
              <span>{item.label}</span>
              {badge !== null && (
                <span
                  style={{
                    marginLeft: "auto",
                    background:
                      item.id === "today" ? C.l1Stroke : C.l2Stroke,
                    color: "white",
                    fontSize: 9,
                    fontWeight: 500,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 5px",
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Logo near bottom */}
        <div style={{ marginTop: "auto", padding: "0 12px 12px" }}>
          <div
            style={{
              background: "#F7F6F2",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          >
            <img
              src="/branding/pipe-dreams-by-jill-mark.svg"
              alt="Pipe Dreams by Jill"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
        </div>

        {/* Status */}
        <div style={{ padding: "0 16px 16px" }}>
          {convError && (
            <div style={{ fontSize: 10, color: C.l0Stroke, lineHeight: 1.4 }}>
              <i className="ti ti-wifi-off" /> API unreachable
            </div>
          )}
          {!convError && (
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
              <i className="ti ti-refresh" /> Live · 3s refresh
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          background: C.bgPage,
          minHeight: 0,
        }}
      >
        {screen === "today" && (
          <TodayScreen
            conversations={conversations}
            calendlyUrl={calendlyUrl}
            onNavigate={(s) => setScreen(s as Screen)}
          />
        )}
        {screen === "pipeline" && (
          <PipelineScreen
            conversations={conversations}
            onSelectConversation={handleSelectConversation}
          />
        )}
        {screen === "emergencies" && (
          <EmergenciesScreen
            apiUrl={apiUrl}
            conversations={conversations}
            onBack={() => setScreen("today")}
            onViewTranscript={handleSelectConversation}
          />
        )}
        {screen === "quote-approvals" && (
          <QuoteApprovalsScreen
            conversations={conversations}
            onBack={() => setScreen("today")}
            onReviewQuote={handleSelectConversation}
          />
        )}
        {screen === "quote-review" && selectedConvId && (
          <QuoteReviewScreen
            apiUrl={apiUrl}
            conversationId={selectedConvId}
            onBack={() => setScreen(previousScreen)}
          />
        )}
        {screen === "quote-review" && !selectedConvId && (
          <div style={{ padding: 24, color: C.textSecondary }}>
            No conversation selected.
          </div>
        )}
      </main>
    </div>
  );
}
