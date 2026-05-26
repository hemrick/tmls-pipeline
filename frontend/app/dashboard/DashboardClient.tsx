"use client";

import { useState } from "react";

import DashboardDetail from "../components/DashboardDetail";
import DashboardList from "../components/DashboardList";

export default function DashboardClient({ apiUrl }: { apiUrl: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", height: "100%", background: "#f3f4f6" }}>
      <DashboardList
        apiUrl={apiUrl}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <main style={{ flex: 1, overflowY: "auto", padding: "1.5rem", background: "#fcfcfd" }}>
        {selectedId ? (
          <DashboardDetail apiUrl={apiUrl} conversationId={selectedId} />
        ) : (
          <div style={{ color: "#6b7280", marginTop: "3rem", textAlign: "center" }}>
            Select a conversation on the left.
          </div>
        )}
      </main>
    </div>
  );
}
