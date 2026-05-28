"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Customer View" },
  { href: "/customer-mic", label: "Customer View with Mic" },
  { href: "/dashboard", label: "Jill Dashboard" },
  { href: "/target", label: "Jill Mobile" },
] as const;

export default function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on navigation
  useEffect(() => { setOpen(false); }, [pathname]);

  const activeTab = TABS.find((t) =>
    t.href === "/" ? pathname === "/" : pathname === t.href || pathname.startsWith(t.href + "/")
  );

  return (
    <nav
      style={{
        height: 48,
        flex: "0 0 auto",
        background: "white",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        padding: "0 1rem",
        gap: "0.75rem",
        position: "relative",
        zIndex: 100,
      }}
    >
      {/* Brand */}
      <div style={{ fontWeight: 700, color: "#111827", letterSpacing: "0.01em", flex: 1 }}>
        Pipeline
      </div>

      {/* Active page label */}
      {activeTab && (
        <div style={{ fontSize: "0.85rem", color: "#6b7280", fontWeight: 500 }}>
          {activeTab.label}
        </div>
      )}

      {/* Burger button + dropdown wrapper */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Open menu"
          aria-expanded={open}
          style={{
            width: 36, height: 36,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: open ? "#f3f4f6" : "transparent",
            border: "1px solid",
            borderColor: open ? "#d1d5db" : "transparent",
            borderRadius: 8,
            cursor: "pointer",
            color: "#374151",
            fontSize: 20,
            transition: "background 0.15s, border-color 0.15s",
          }}
        >
          <i className={open ? "ti ti-x" : "ti ti-menu-2"} />
        </button>

        {/* Dropdown */}
        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
              minWidth: 220,
              overflow: "hidden",
              animation: "topnav-drop 0.15s ease",
            }}
          >
            <style>{`
              @keyframes topnav-drop {
                from { opacity: 0; transform: translateY(-6px); }
                to   { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            {TABS.map((tab, i) => {
              const active =
                tab.href === "/"
                  ? pathname === "/"
                  : pathname === tab.href || pathname.startsWith(tab.href + "/");
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    padding: "0.65rem 1rem",
                    fontSize: "0.9rem",
                    fontWeight: active ? 600 : 400,
                    color: active ? "#1d4ed8" : "#111827",
                    background: active ? "#eff6ff" : "transparent",
                    textDecoration: "none",
                    borderTop: i > 0 ? "1px solid #f3f4f6" : "none",
                    transition: "background 0.1s",
                  }}
                >
                  {active && (
                    <span style={{
                      width: 4, height: 16, borderRadius: 2,
                      background: "#1d4ed8", flexShrink: 0,
                    }} />
                  )}
                  {tab.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
