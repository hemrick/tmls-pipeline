import type { ChatResponse, ConversationState } from "./types";

export async function postChat(
  apiUrl: string,
  message: string,
  conversationId: string | null,
): Promise<ChatResponse> {
  const res = await fetch(`${apiUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversation_id: conversationId,
      message,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as ChatResponse;
}

export async function getConversation(
  apiUrl: string,
  conversationId: string,
): Promise<ConversationState> {
  const res = await fetch(`${apiUrl}/api/conversations/${conversationId}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as ConversationState;
}
