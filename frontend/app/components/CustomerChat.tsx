"use client";

import { useEffect, useRef, useState } from "react";

import MessageBubble from "./MessageBubble";
import QuoteCard from "./QuoteCard";
import SlotButtons from "./SlotButtons";
import UrgencyChip from "./UrgencyChip";
import WaitingForJill from "./WaitingForJill";
import { getConversation, postChat } from "./api";
import type {
  ChatMessage,
  ConversationState,
  LastTurn,
  SlotOffer,
} from "./types";

const STORAGE_KEY = "pipeline.conversation_id";

export default function CustomerChat({ apiUrl }: { apiUrl: string }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastTurn, setLastTurn] = useState<LastTurn | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Mount: resume from localStorage if present.
  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? window.localStorage.getItem(STORAGE_KEY)
      : null;
    if (!stored) return;
    setConversationId(stored);
    getConversation(apiUrl, stored)
      .then((state) => {
        setMessages(state.messages);
        setLastTurn(state.last_turn);
      })
      .catch(() => {
        // Stale id (server wiped, dev mode, etc.) — start fresh.
        window.localStorage.removeItem(STORAGE_KEY);
        setConversationId(null);
      });
  }, [apiUrl]);

  // ---- Auto-scroll on new content.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, lastTurn?.quote?.quote_status, lastTurn?.booking?.booking_status]);

  // ---- Polling while Jill reviews the quote.
  const isWaiting =
    lastTurn?.quote?.quote_status === "pending_jill_review" &&
    lastTurn?.status !== "closed_no_action" &&
    lastTurn?.status !== "closed_done";

  useEffect(() => {
    if (!conversationId || !isWaiting) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const state = await getConversation(apiUrl, conversationId);
        setMessages(state.messages);
        setLastTurn(state.last_turn);
      } catch {
        // Soft-fail; the next tick will retry.
      }
    }, 2000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [conversationId, isWaiting, apiUrl]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    // Optimistic: append the user message immediately.
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: new Date().toISOString() },
    ]);
    try {
      const resp = await postChat(apiUrl, text, conversationId);
      if (!conversationId) {
        setConversationId(resp.conversation_id);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, resp.conversation_id);
        }
      }
      // Re-fetch full state so messages and last_turn are authoritative.
      const state = await getConversation(apiUrl, resp.conversation_id);
      setMessages(state.messages);
      setLastTurn(state.last_turn);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = input;
      setInput("");
      void sendMessage(text);
    }
  }

  function startOver() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setConversationId(null);
    setMessages([]);
    setLastTurn(null);
    setInput("");
    setError(null);
  }

  // ---- Derived UI state.
  const closed =
    lastTurn?.status === "closed_done" || lastTurn?.status === "closed_no_action";
  const showQuoteCard =
    lastTurn?.quote &&
    (lastTurn.quote.quote_status === "sent_to_customer" ||
      lastTurn.quote.quote_status === "customer_accepted" ||
      lastTurn.quote.quote_status === "customer_declined");
  const showSlots =
    !!lastTurn?.booking?.slots_offered?.length &&
    lastTurn?.booking?.booking_status === "link_sent";
  const inputDisabled = loading || closed || isWaiting;

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "white",
      }}
    >
      <header
        style={{
          padding: "0.9rem 1rem",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Jill's Plumbing</div>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
            Serving the GTA since 2003
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {lastTurn?.urgency && <UrgencyChip level={lastTurn.urgency} />}
          {conversationId && (
            <button
              onClick={startOver}
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.55rem",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "white",
                color: "#374151",
                cursor: "pointer",
              }}
              title="Start a new conversation"
            >
              New chat
            </button>
          )}
        </div>
      </header>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem",
          background: "#fcfcfd",
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "#6b7280", textAlign: "center", marginTop: "3rem" }}>
            Send a message to start.
          </div>
        )}
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          return (
            <MessageBubble key={i} message={m}>
              {/* Render cards after the most recent agent message only. */}
              {isLast && m.role === "agent" && (
                <>
                  {isWaiting && <WaitingForJill />}
                  {showQuoteCard && lastTurn?.quote && (
                    <QuoteCard
                      quote={lastTurn.quote}
                      disabled={
                        loading ||
                        lastTurn.quote.quote_status === "customer_accepted" ||
                        lastTurn.quote.quote_status === "customer_declined" ||
                        closed
                      }
                      onAccept={() =>
                        sendMessage("I accept the quote. Please book me in.")
                      }
                      onDecline={() =>
                        sendMessage("I'd like to decline the quote, thanks.")
                      }
                    />
                  )}
                  {showSlots && lastTurn?.booking?.slots_offered && (
                    <SlotButtons
                      slots={lastTurn.booking.slots_offered}
                      disabled={
                        loading ||
                        lastTurn.booking.booking_status === "booked" ||
                        closed
                      }
                      onPick={(slot: SlotOffer) =>
                        sendMessage(`I'll take ${slot.label} (${slot.slot_id}).`)
                      }
                    />
                  )}
                </>
              )}
            </MessageBubble>
          );
        })}
        {loading && (
          <div style={{ color: "#6b7280", fontSize: "0.85rem", paddingLeft: "0.5rem" }}>
            …
          </div>
        )}
        {error && (
          <div
            style={{
              marginTop: "0.6rem",
              padding: "0.5rem 0.75rem",
              borderRadius: 6,
              background: "#fee2e2",
              color: "#991b1b",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}
      </div>

      <footer
        style={{
          borderTop: "1px solid #e5e7eb",
          padding: "0.7rem 1rem",
          background: "white",
        }}
      >
        {closed ? (
          <div style={{ color: "#6b7280", fontSize: "0.9rem", textAlign: "center" }}>
            Conversation ended. Tap "New chat" to start over.
          </div>
        ) : (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={inputDisabled}
            rows={2}
            placeholder={
              isWaiting
                ? "Waiting for Jill's review…"
                : "Type a message and press Enter…"
            }
            style={{
              width: "100%",
              padding: "0.55rem 0.7rem",
              fontSize: "0.95rem",
              fontFamily: "inherit",
              boxSizing: "border-box",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              resize: "none",
              background: inputDisabled ? "#f3f4f6" : "white",
            }}
          />
        )}
      </footer>
    </div>
  );
}
