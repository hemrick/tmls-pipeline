"use client";

import type { IndexEntry } from "../dashboardApi";
import { ContextBanner, DrillRow, EmptyState } from "./QuotesQueueScreen";

interface Props {
  rows: IndexEntry[];
  onSelect: (id: string) => void;
}

export default function EmergenciesScreen({ rows, onSelect }: Props) {
  const emergencies = rows.filter(
    (r) =>
      r.urgency === "emergency" &&
      r.status !== "closed_done" &&
      r.status !== "closed_no_action",
  );

  return (
    <div style={{ paddingTop: 14 }}>
      <ContextBanner
        icon="ti-flame"
        message="Active emergency conversations requiring an immediate dispatch decision."
        variant="l1"
      />
      {emergencies.length === 0 ? (
        <EmptyState icon="ti-circle-check" message="No active emergencies." />
      ) : (
        emergencies.map((r) => (
          <DrillRow key={r.conversation_id} row={r} variant="l1" onSelect={onSelect} />
        ))
      )}
    </div>
  );
}
