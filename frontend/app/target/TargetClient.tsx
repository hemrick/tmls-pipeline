"use client";

import { useEffect, useState } from "react";
import { getConversations, sortForDashboard, type IndexEntry } from "../components/dashboardApi";
import MobileLayout, { type Tab } from "../components/mobile/MobileLayout";
import TodayScreen from "../components/mobile/TodayScreen";
import PipelineScreen from "../components/mobile/PipelineScreen";
import CalendarScreen from "../components/mobile/CalendarScreen";
import MessagesScreen from "../components/mobile/MessagesScreen";
import ConvDetailMobile from "../components/mobile/ConvDetailMobile";
import QuotesQueueScreen from "../components/mobile/QuotesQueueScreen";
import CallbacksScreen from "../components/mobile/CallbacksScreen";
import EmergenciesScreen from "../components/mobile/EmergenciesScreen";

type Screen =
  | "today" | "pipeline" | "calendar" | "messages"
  | "callbacks" | "emergencies" | "quotes-queue"
  | "conv-detail";

const TAB_SCREENS: Tab[] = ["today", "pipeline", "calendar", "messages"];

// Which tab should be highlighted for each screen
function activeTab(screen: Screen): Tab {
  if (["callbacks", "emergencies", "quotes-queue", "conv-detail"].includes(screen)) return "today";
  if (TAB_SCREENS.includes(screen as Tab)) return screen as Tab;
  return "today";
}

interface ScreenMeta { title: string; subtitle?: string; withBack: boolean; backTo: Screen }

function screenMeta(screen: Screen, rows: IndexEntry[]): ScreenMeta {
  switch (screen) {
    case "today":        return { title: "Today", subtitle: "Jill's Plumbing", withBack: false, backTo: "today" };
    case "pipeline":     return { title: "Pipeline", subtitle: `${rows.filter(r => r.status !== "closed_done" && r.status !== "closed_no_action").length} active`, withBack: false, backTo: "today" };
    case "calendar":     return { title: "Schedule", subtitle: undefined, withBack: false, backTo: "today" };
    case "messages":     return { title: "Messages", subtitle: undefined, withBack: false, backTo: "today" };
    case "callbacks":    return { title: "Safety Callbacks", subtitle: "L0 — welfare follow-up", withBack: true, backTo: "today" };
    case "emergencies":  return { title: "Emergencies", subtitle: "Dispatch decisions needed", withBack: true, backTo: "today" };
    case "quotes-queue": return { title: "Quotes Queue", subtitle: "Awaiting your approval", withBack: true, backTo: "today" };
    case "conv-detail":  return { title: "Conversation", subtitle: undefined, withBack: true, backTo: "today" };
  }
}

export default function TargetClient({ apiUrl }: { apiUrl: string }) {
  const [screen, setScreen] = useState<Screen>("today");
  const [prevScreen, setPrevScreen] = useState<Screen>("today");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rows, setRows] = useState<IndexEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const index = await getConversations(apiUrl);
        if (!cancelled) setRows(sortForDashboard(index.conversations));
      } catch {
        // silent — UI shows stale data
      }
    }
    void tick();
    const id = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [apiUrl]);

  function navigate(to: Screen, id?: string) {
    if (id) setSelectedId(id);
    setPrevScreen(screen);
    setScreen(to);
  }

  function goBack() {
    setScreen(prevScreen === screen ? "today" : prevScreen);
  }

  function onTabChange(tab: Tab) {
    setPrevScreen(screen);
    setScreen(tab);
  }

  // Badge counts for bottom nav
  const emergencyCount = rows.filter(
    (r) => r.urgency === "emergency" && r.status !== "closed_done" && r.status !== "closed_no_action",
  ).length;
  const quotesCount = rows.filter((r) => r.status === "quoted").length;
  const todayBadge = emergencyCount + quotesCount || undefined;
  const pipelineBadge = rows.filter((r) => r.status !== "closed_done" && r.status !== "closed_no_action").length || undefined;
  const messagesBadge = rows.filter((r) => r.urgency === "emergency" && (r.status === "new" || r.status === "in_progress")).length || undefined;

  const meta = screenMeta(screen, rows);

  const appContent = (
    <MobileLayout
      title={meta.title}
      subtitle={meta.subtitle}
      withBack={meta.withBack}
      onBack={goBack}
      currentTab={activeTab(screen)}
      onTabChange={onTabChange}
      badges={{ today: todayBadge, pipeline: pipelineBadge, messages: messagesBadge }}
    >
      {screen === "today" && (
        <TodayScreen rows={rows} onNavigate={(s, id) => navigate(s as Screen, id)} />
      )}
      {screen === "pipeline" && (
        <PipelineScreen rows={rows} onSelect={(id) => navigate("conv-detail", id)} />
      )}
      {screen === "calendar" && (
        <CalendarScreen rows={rows} onSelect={(id) => navigate("conv-detail", id)} />
      )}
      {screen === "messages" && (
        <MessagesScreen rows={rows} onSelect={(id) => navigate("conv-detail", id)} />
      )}
      {screen === "callbacks" && (
        <CallbacksScreen rows={rows} onSelect={(id) => navigate("conv-detail", id)} />
      )}
      {screen === "emergencies" && (
        <EmergenciesScreen rows={rows} onSelect={(id) => navigate("conv-detail", id)} />
      )}
      {screen === "quotes-queue" && (
        <QuotesQueueScreen rows={rows} onSelect={(id) => navigate("conv-detail", id)} />
      )}
      {screen === "conv-detail" && selectedId && (
        <ConvDetailMobile apiUrl={apiUrl} conversationId={selectedId} />
      )}
    </MobileLayout>
  );

  return (
    /* Workspace — the tan backdrop seen around the phone */
    <div style={{
      width: "100%", height: "100%", overflow: "auto",
      background: "#E8E6DE",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      padding: "24px 16px",
    }}>
      {/* Phone bezel */}
      <div style={{
        width: 390, flexShrink: 0,
        background: "#1a1a1a",
        borderRadius: 44,
        padding: 10,
        boxShadow: "0 20px 60px rgba(0,0,0,0.30), 0 4px 16px rgba(0,0,0,0.18)",
      }}>
        {/* Screen glass */}
        <div style={{
          background: "#F7F6F2",
          borderRadius: 36,
          overflow: "hidden",
          height: 812,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}>
          {/* Dynamic Island notch */}
          <div style={{
            position: "absolute", top: 12, left: "50%",
            transform: "translateX(-50%)",
            width: 120, height: 34,
            background: "#1a1a1a",
            borderRadius: 20,
            zIndex: 10,
          }} />

          {/* Fake status bar */}
          <div style={{
            height: 52, flexShrink: 0,
            display: "flex", justifyContent: "space-between", alignItems: "flex-end",
            padding: "0 26px 6px",
            fontSize: 13, fontWeight: 600, color: "#1A1A1A",
          }}>
            <span>9:41</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <SignalIcon />
              <WifiIcon />
              <BatteryIcon />
            </div>
          </div>

          {/* App content — fills the rest of the screen */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {appContent}
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalIcon() {
  return (
    <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
      <rect x="0"  y="8" width="3" height="4" rx="1" fill="#1A1A1A"/>
      <rect x="4"  y="5" width="3" height="7" rx="1" fill="#1A1A1A"/>
      <rect x="8"  y="2" width="3" height="10" rx="1" fill="#1A1A1A"/>
      <rect x="12" y="0" width="3" height="12" rx="1" fill="#1A1A1A"/>
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <path d="M8 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="#1A1A1A"/>
      <path d="M3.5 6.5a6.5 6.5 0 0 1 9 0" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M1 4a10 10 0 0 1 14 0" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
      <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="#1A1A1A" strokeOpacity="0.35"/>
      <rect x="2" y="2" width="16" height="8" rx="2" fill="#1A1A1A"/>
      <path d="M23 4v4a2 2 0 0 0 0-4z" fill="#1A1A1A" fillOpacity="0.4"/>
    </svg>
  );
}
