"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const TABS = [
  { href: "/customer-mic", label: "Call Jill" },
  { href: "/chat", label: "Chat with Jill" },
  { href: "/dashboard", label: "Jill dashboard (desktop)" },
  { href: "/target", label: "Jill dashboard (mobile)" },
  { href: "/project-documentation", label: "Documentation" },
] as const;

export default function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <style>{`
        .pipeline-nav-desktop-tabs { display: flex; gap: 0.25rem; height: 100%; }
        .pipeline-nav-burger { display: none; }
        @media (max-width: 900px) {
          .pipeline-nav-desktop-tabs { display: none; }
          .pipeline-nav-burger {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-left: auto;
            width: 36px;
            height: 36px;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
            background: white;
            color: #374151;
            font-size: 1.25rem;
            cursor: pointer;
          }
        }
      `}</style>

      <nav
        style={{
          height: 48,
          flex: "0 0 auto",
          background: "white",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          padding: "0 1rem",
          gap: "1.5rem",
          position: "relative",
        }}
      >
        <Link
          href="/"
          style={{
            fontWeight: 700,
            color: "#111827",
            letterSpacing: "0.01em",
            textDecoration: "none",
          }}
        >
          Pipe Dreams
        </Link>

        <div className="pipeline-nav-desktop-tabs">
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0 0.9rem",
                  height: "100%",
                  color: active ? "#1d4ed8" : "#6b7280",
                  fontWeight: active ? 600 : 500,
                  textDecoration: "none",
                  borderBottom: active ? "2px solid #1d4ed8" : "2px solid transparent",
                  fontSize: "0.9rem",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          className="pipeline-nav-burger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <i className={open ? "ti ti-x" : "ti ti-menu-2"} />
        </button>
      </nav>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: "48px 0 0 0",
              background: "transparent",
              zIndex: 20,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 48,
              left: 0,
              right: 0,
              background: "white",
              borderBottom: "1px solid #e5e7eb",
              boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
              zIndex: 30,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {TABS.map((tab) => {
              const active = isActive(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setOpen(false)}
                  style={{
                    padding: "0.85rem 1rem",
                    color: active ? "#1d4ed8" : "#374151",
                    fontWeight: active ? 600 : 500,
                    textDecoration: "none",
                    fontSize: "0.95rem",
                    borderBottom: "1px solid #f3f4f6",
                    background: active ? "#eff6ff" : "white",
                  }}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
