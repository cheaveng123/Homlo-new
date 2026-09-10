/**
 * Normalized Homlo message and conversation models. These are the canonical
 * client-side types that the UI depends on — provider implementations
 * (Supabase, Stream, etc.) map their wire format into these shapes.
 */

export interface ConversationParticipant {
  userId: string;
  name: string;
  role: "worker" | "employer" | "both";
}

export interface ConversationSummary {
  id: string;
  applicationId: string | null;
  jobId: string | null;
  jobTitle: string;
  otherParticipant: ConversationParticipant;
  lastMessageAt: string | null;
  lastMessage: string | null;
  lastMessageAuthorId: string | null;
  unreadCount: number;
  /** Application status backing this conversation (hired = confirmed connection). */
  applicationStatus: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  messageType: "text" | "application" | "status_change";
  createdAt: string;
  updatedAt: string | null;
  readAt: string | null;
  deletedAt: string | null;
}

export interface Conversation {
  id: string;
  applicationId: string | null;
  jobId: string | null;
  jobTitle: string;
  participants: ConversationParticipant[];
  lastMessageAt: string | null;
  blocked: boolean;
}

export interface NewMessageEvent {
  conversationId: string;
  message: Message;
}

export type MessagingProviderError = {
  code:
    | "NOT_AUTHORIZED"
    | "CONVERSATION_NOT_FOUND"
    | "USER_NOT_MEMBER"
    | "USER_BLOCKED"
    | "MESSAGE_EMPTY"
    | "MESSAGE_TOO_LONG"
    | "SELF_MESSAGE"
    | "NETWORK_ERROR"
    | "UNKNOWN";
  message: string;
};
