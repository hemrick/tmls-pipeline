import type { ConversationStatus, UrgencyLevel } from "./types";

export interface IndexEntry {
  conversation_id: string;
  customer_name?: string | null;
  display_label?: string | null;
  summary: string;
  urgency?: UrgencyLevel | null;
  status: ConversationStatus;
  sub_reason?: string | null;
  updated_at: string;
}

export interface Index {
  updated_at: string;
  conversations: IndexEntry[];
}

export async function getConversations(apiUrl: string): Promise<Index> {
  const res = await fetch(`${apiUrl}/api/conversations`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Index;
}

const URGENCY_RANK: Record<string, number> = {
  emergency: 0,
  priority: 1,
  scheduled: 2,
};

export function sortForDashboard(rows: IndexEntry[]): IndexEntry[] {
  return [...rows].sort((a, b) => {
    const ra = URGENCY_RANK[a.urgency ?? "scheduled"] ?? 3;
    const rb = URGENCY_RANK[b.urgency ?? "scheduled"] ?? 3;
    if (ra !== rb) return ra - rb;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}
