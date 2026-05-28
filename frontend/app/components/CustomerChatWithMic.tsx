"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import MessageBubble from "./MessageBubble";
import MicButton, { type MicState } from "./MicButton";
import QuoteCard from "./QuoteCard";
import SlotButtons from "./SlotButtons";
import TypingDots from "./TypingDots";
import UrgencyChip from "./UrgencyChip";
import WaitingForJill from "./WaitingForJill";
import { getConversation } from "./api";
import type { ChatMessage, LastTurn, SlotOffer } from "./types";
import {
  startVoiceSession,
  type VoiceClientHandle,
  type VoiceEvent,
} from "./voiceClient";

export default function CustomerChatWithMic({ apiUrl }: { apiUrl: string }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastTurn, setLastTurn] = useState<LastTurn | null>(null);
  const [micState, setMicState] = useState<MicState>("idle");
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [streamingAgentText, setStreamingAgentText] = useState("");

  const sessionRef = useRef<VoiceClientHandle | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Auto-scroll.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [
    messages.length,
    streamingAgentText,
    lastTurn?.quote?.quote_status,
    lastTurn?.booking?.booking_status,
  ]);

  // ---- Polling while Jill reviews (same logic as text customer view).
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
        const s = await getConversation(apiUrl, conversationId);
        setMessages(s.messages);
        setLastTurn(s.last_turn);
      } catch {
        // soft fail
      }
    }, 2000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [conversationId, isWaiting, apiUrl]);

  // ---- Event sink from the voice session.
  const handleVoiceEvent = useCallback(
    (e: VoiceEvent) => {
      switch (e.type) {
        case "conversation_started":
          setConversationId(e.conversation_id);
          break;

        case "session_ready":
          setMicState("listening");
          break;

        case "user_speaking":
          setMicState("listening");
          break;

        case "user_stopped":
          setMicState("thinking");
          break;

        case "user_transcript_done":
          setMessages((prev) => [
            ...prev,
            { role: "user", content: e.text, timestamp: new Date().toISOString() },
          ]);
          break;

        case "agent_text_delta":
          setMicState("speaking");
          setStreamingAgentText((prev) => prev + e.text);
          break;

        case "agent_text_done":
          // Persist the streamed bubble.
          setMessages((prev) => {
            const text = e.text || streamingAgentTextRef.current;
            if (!text) return prev;
            return [
              ...prev,
              { role: "agent", content: text, timestamp: new Date().toISOString() },
            ];
          });
          setStreamingAgentText("");
          setMicState("listening");
          break;

        case "state_update":
          setLastTurn(e.last_turn);
          break;

        case "error":
          setError(e.message);
          break;
      }
    },
    [],
  );

  // Keep latest streamingAgentText accessible inside the stable callback above
  // (avoids closure staleness on agent_text_done).
  const streamingAgentTextRef = useRef("");
  useEffect(() => {
    streamingAgentTextRef.current = streamingAgentText;
  }, [streamingAgentText]);

  async function startMic() {
    if (sessionRef.current?.isOpen()) return;
    setError(null);
    setMicState("connecting");
    try {
      sessionRef.current = await startVoiceSession(apiUrl, conversationId, {
        onEvent: handleVoiceEvent,
        onClosed: () => {
          sessionRef.current = null;
          setMicState("idle");
          setMicLevel(0);
        },
        onMicLevel: (l) => setMicLevel(l),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMicState("idle");
    }
  }

  async function stopMic() {
    if (sessionRef.current) {
      await sessionRef.current.stop();
      sessionRef.current = null;
    }
    setMicState("idle");
  }

  function startOver() {
    void stopMic();
    setConversationId(null);
    setMessages([]);
    setLastTurn(null);
    setStreamingAgentText("");
    setError(null);
  }

  // ---- Synthetic chat message (for QuoteCard / SlotButtons taps).
  async function sendSyntheticUserMessage(text: string) {
    // Voice flow doesn't have a text input; QuoteCard / SlotButtons taps
    // fall back to /api/chat (same backend, same conversation_id).
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: new Date().toISOString() },
    ]);
    try {
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, message: text }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const state = await getConversation(apiUrl, conversationId!);
      setMessages(state.messages);
      setLastTurn(state.last_turn);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // ---- Derived UI state (same selectors as CustomerChat).
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

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      void sessionRef.current?.stop();
    };
  }, []);

  const showLogo = messages.length === 0 && !streamingAgentText;

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
      {showLogo && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "1.25rem 1rem 0.5rem",
          }}
        >
          <img
            src="/branding/pipe-dreams-by-jill-mark.svg"
            alt="Pipe Dreams by Jill"
            style={{ width: 180, maxWidth: "60%", height: "auto" }}
          />
        </div>
      )}
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
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Pipe Dreams by Jill</div>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
            Serving the GTA since 2003 · Voice mode
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
        {messages.length === 0 && !streamingAgentText && (
          <div
            style={{
              color: "#6b7280",
              textAlign: "center",
              marginTop: "3rem",
              fontSize: "0.9rem",
            }}
          >
            Tap the mic and speak to start.
          </div>
        )}
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1 && !streamingAgentText;
          return (
            <MessageBubble key={i} message={m}>
              {isLast && m.role === "agent" && (
                <>
                  {isWaiting && <WaitingForJill />}
                  {showQuoteCard && lastTurn?.quote && (
                    <QuoteCard
                      quote={lastTurn.quote}
                      disabled={
                        lastTurn.quote.quote_status === "customer_accepted" ||
                        lastTurn.quote.quote_status === "customer_declined" ||
                        closed
                      }
                      onAccept={() =>
                        sendSyntheticUserMessage("I accept the quote. Please book me in.")
                      }
                      onDecline={() =>
                        sendSyntheticUserMessage("I'd like to decline the quote, thanks.")
                      }
                    />
                  )}
                  {showSlots && lastTurn?.booking?.slots_offered && (
                    <SlotButtons
                      slots={lastTurn.booking.slots_offered}
                      disabled={
                        lastTurn.booking.booking_status === "booked" || closed
                      }
                      onPick={(slot: SlotOffer) =>
                        sendSyntheticUserMessage(
                          `I'll take ${slot.label} (${slot.slot_id}).`,
                        )
                      }
                    />
                  )}
                </>
              )}
            </MessageBubble>
          );
        })}

        {micState === "thinking" && !streamingAgentText && <TypingDots />}

        {streamingAgentText && (
          <MessageBubble
            message={{
              role: "agent",
              content: streamingAgentText,
              timestamp: new Date().toISOString(),
            }}
          />
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
          padding: "0.5rem 1rem 0.9rem",
          background: "white",
        }}
      >
        {closed ? (
          <div
            style={{ color: "#6b7280", fontSize: "0.9rem", textAlign: "center" }}
          >
            Conversation ended. Tap "New chat" to start over.
          </div>
        ) : (
          <MicButton
            state={micState}
            level={micLevel}
            onClick={micState === "idle" ? startMic : stopMic}
          />
        )}
      </footer>
    </div>
  );
}
