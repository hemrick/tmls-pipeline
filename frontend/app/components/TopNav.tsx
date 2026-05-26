"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Customer View" },
  { href: "/customer-mic", label: "Customer View with Mic" },
  { href: "/dashboard", label: "Jill Dashboard" },
  { href: "/target", label: "Dashboard Jill Cible" },
] as const;

export default function TopNav() {
  const pathname = usePathname();

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
        gap: "1.5rem",
      }}
    >
      <div style={{ fontWeight: 700, color: "#111827", letterSpacing: "0.01em" }}>
        Pipeline
      </div>
      <div style={{ display: "flex", gap: "0.25rem", height: "100%" }}>
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname === tab.href || pathname.startsWith(tab.href + "/");
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
    </nav>
  );
}
