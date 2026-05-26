import type { ReactNode } from "react";
import type { Viewport } from "next";

export const metadata = {
  title: "Pipeline",
  description: "Hello world frontend ↔ backend connectivity check",
};

// Mobile-friendly viewport. Critical for the /dashboard route to render
// at correct pixel density on real phones.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F6F2",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Tabler icons — used by the /dashboard route. Pinned to the
            same version as the original mockup. CDN keeps the npm
            dependency surface small; swap to @tabler/icons-webfont if
            you need offline builds. */}
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
        }}
      >
        {children}
      </body>
    </html>
  );
}
