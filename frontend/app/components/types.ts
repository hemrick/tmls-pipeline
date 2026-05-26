// Mirrors the V1 backend payload shapes from
// backend/app/conversation_store.py + system_prompts.build_state_context_message.
// Kept loose — only the fields the UI reads are typed strictly.

export type UrgencyLevel = "emergency" | "priority" | "scheduled";

export type ConversationStatus =
  | "new"
  | "in_progress"
  | "quoted"
  | "booked"
  | "closed_no_action"
  | "closed_done";

export type QuoteStatus =
  | "draft"
  | "pending_jill_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "sent_to_customer"
  | "customer_accepted"
  | "customer_declined";

export type BookingStatus =
  | "not_started"
  | "link_sent"
  | "booked"
  | "cancelled"
  | "manual_follow_up";

export interface SlotOffer {
  slot_id: string;
  label: string;
  iso_datetime: string;
}

export interface Quote {
  quote_status: QuoteStatus;
  job_summary: string;
  scope: string[];
  estimated_price_range: string;
  disclaimer: string;
  version: number;
}

export interface Booking {
  booking_status: BookingStatus;
  booking_method?: string | null;
  slots_offered?: SlotOffer[];
  selected_slot?: SlotOffer | null;
  ui_log?: string[];
}

export interface Customer {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface Triage {
  urgency_level?: UrgencyLevel;
  reason?: string;
  needs_clarification?: boolean;
}

export interface LastTurn {
  turn_number?: number;
  status: ConversationStatus;
  urgency?: UrgencyLevel | null;
  customer?: Customer;
  triage?: Triage | null;
  quote?: Quote | null;
  booking?: Booking;
  sub_reason?: string | null;
  notifications?: Array<{ type: string; reason: string; at: string }>;
}

export interface ChatMessage {
  role: "user" | "agent";
  content: string;
  timestamp: string;
}

export interface ConversationState {
  conversation_id: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
  last_turn: LastTurn;
  turn_history: LastTurn[];
  display_label?: string | null;
}

export interface ChatResponse {
  conversation_id: string;
  reply: string;
  last_turn: LastTurn;
}
