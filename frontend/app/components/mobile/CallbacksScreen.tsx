"use client";

import type { IndexEntry } from "../dashboardApi";
import { ContextBanner, DrillRow, EmptyState } from "./QuotesQueueScreen";

interface Props {
  rows: IndexEntry[];
  onSelect: (id: string) => void;
}

export default function CallbacksScreen({ rows, onSelect }: Props) {
  // L0 safety callbacks: priority conversations closed without direct action
  const callbacks = rows.filter(
    (r) => r.urgency === "priority" && r.status === "closed_no_action",
  );

  return (
    <div style={{ paddingTop: 14 }}>
      <ContextBanner
        icon="ti-alert-triangle"
        message="Safety escalations where the customer was referred elsewhere. Follow up to confirm their welfare."
        variant="l0"
      />
      {callbacks.length === 0 ? (
        <EmptyState icon="ti-circle-check" message="No safety callbacks pending." />
      ) : (
        callbacks.map((r) => (
          <DrillRow key={r.conversation_id} row={r} variant="l0" onSelect={onSelect} />
        ))
      )}
    </div>
  );
}
