import type { ReactNode } from "react";

import TopNav from "./components/TopNav";

export const metadata = {
  title: "Jill's Plumbing",
  description: "AI intake assistant",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.47.0/tabler-icons.min.css"
        />
      </head>
      <body
        style={{
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          margin: 0,
          background: "#f3f4f6",
          color: "#111827",
          display: "flex",
          flexDirection: "column",
          height: "100dvh",
        }}
      >
        <TopNav />
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{children}</div>
      </body>
    </html>
  );
}
