import type { ReactNode } from "react";

import type { ChatMessage } from "./types";

export default function MessageBubble({
  message,
  children,
}: {
  message: ChatMessage;
  children?: ReactNode;
}) {
  const isAgent = message.role === "agent";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isAgent ? "flex-start" : "flex-end",
        marginBottom: "0.6rem",
      }}
    >
      <div style={{ maxWidth: "85%" }}>
        <div
          style={{
            padding: "0.55rem 0.85rem",
            borderRadius: 14,
            background: isAgent ? "#f3f4f6" : "#2563eb",
            color: isAgent ? "#111827" : "white",
            whiteSpace: "pre-wrap",
            fontSize: "0.95rem",
            lineHeight: 1.4,
          }}
        >
          {message.content}
        </div>
        {children}
      </div>
    </div>
  );
}
