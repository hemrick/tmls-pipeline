"use client";

import type { CSSProperties, ReactNode } from "react";
import { C } from "./tokens";

export type Tab = "today" | "pipeline" | "calendar" | "messages";

interface Badges { today?: number; pipeline?: number; messages?: number }

interface Props {
  title: string;
  subtitle?: string;
  withBack?: boolean;
  onBack?: () => void;
  currentTab: Tab;
  onTabChange: (t: Tab) => void;
  badges?: Badges;
  children: ReactNode;
}

const NAV_TABS: { id: Tab; icon: string; label: string; badgeKey?: keyof Badges }[] = [
  { id: "today",    icon: "ti-home",         label: "Today",    badgeKey: "today" },
  { id: "pipeline", icon: "ti-list-details",  label: "Pipeline", badgeKey: "pipeline" },
  { id: "calendar", icon: "ti-calendar",      label: "Calendar" },
  { id: "messages", icon: "ti-message",       label: "Messages", badgeKey: "messages" },
];

export default function MobileLayout({
  title, subtitle, withBack, onBack, currentTab, onTabChange, badges = {}, children,
}: Props) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: C.bgPage, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: withBack ? "8px 16px 12px" : "12px 16px 14px",
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        position: "relative",
        background: C.bgPage, borderBottom: `0.5px solid ${C.borderLight}`,
      }}>
        {withBack ? (
          <button
            onClick={onBack}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              width: 32, height: 32, borderRadius: "50%", display: "flex",
              alignItems: "center", justifyContent: "center",
              color: C.textPrimary, fontSize: 20, marginLeft: -4, flexShrink: 0,
            }}
            aria-label="Back"
          >
            <i className="ti ti-chevron-left" />
          </button>
        ) : (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 500, color: C.textPrimary, lineHeight: 1.2 }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
        )}

        {/* Logo — centered absolutely so it doesn't shift the left/right flex items */}
        <img
          src="/branding/pipe-dreams-by-jill-mark.svg"
          alt="Pipe Dreams by Jill"
          style={{
            position: "absolute", left: "50%", top: "50%",
            transform: "translate(-50%, -50%)",
            height: 30, width: 30, objectFit: "contain", pointerEvents: "none",
          }}
        />

        {withBack ? (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 500, color: C.textPrimary, lineHeight: 1.2 }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 0 }}>
            <button style={iconBtnStyle} aria-label="Notifications"><i className="ti ti-bell" /></button>
            <button style={iconBtnStyle} aria-label="Settings"><i className="ti ti-settings" /></button>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div style={{
        flex: "1 1 auto", overflowY: "auto", overflowX: "hidden",
        padding: "0 14px 90px", minHeight: 0, WebkitOverflowScrolling: "touch" as const,
      }}>
        {children}
      </div>

      {/* Bottom nav */}
      <div style={{
        flexShrink: 0, background: C.bgSurface,
        borderTop: `0.5px solid ${C.borderLight}`,
        padding: "6px 8px 18px",
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4,
      }}>
        {NAV_TABS.map((t) => {
          const badge = t.badgeKey ? badges[t.badgeKey] : undefined;
          const active = t.id === currentTab;
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              style={{
                background: "transparent", border: "none", padding: "8px 4px",
                borderRadius: 6, cursor: "pointer", display: "flex",
                flexDirection: "column", alignItems: "center", gap: 2,
                color: active ? C.navy : C.textSecondary,
                fontFamily: "inherit", fontSize: 10, fontWeight: 500, position: "relative",
              }}
            >
              <i className={`ti ${t.icon}`} style={{ fontSize: 22 }} />
              <span>{t.label}</span>
              {badge != null && badge > 0 && (
                <span style={{
                  position: "absolute", top: 4, right: "28%",
                  background: C.l1Stroke, color: "white",
                  fontSize: 8, fontWeight: 500, minWidth: 14, height: 14,
                  borderRadius: 100, padding: "0 4px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const iconBtnStyle: CSSProperties = {
  background: "transparent", border: "none", width: 36, height: 36,
  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", color: C.textSecondary, fontSize: 20,
};
