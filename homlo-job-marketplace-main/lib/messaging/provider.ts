/**
 * MessagingProvider is the transport abstraction for messaging.
 * The UI calls MessagingService (in service.ts), which delegates to this
 * interface. Swap this to migrate from Supabase Realtime to Stream/Sendbird.
 */
import type {
  Conversation,
  ConversationSummary,
  Message,
  NewMessageEvent,
} from "./types";

export interface MessagingProvider {
  /** List conversations for the current user. */
  getConversations(): Promise<ConversationSummary[]>;

  /** Get or create a canonical conversation for an application. */
  getOrCreateConversation(
    applicationId: string,
  ): Promise<Conversation>;

  /** Paginated messages in a conversation (newest last, optionally before cursor). */
  getMessages(
    conversationId: string,
    before?: string,
    limit?: number,
  ): Promise<Message[]>;

  /** Send a message. Returns the created message. */
  sendMessage(
    conversationId: string,
    body: string,
  ): Promise<Message>;

  /** Mark all messages in a conversation as read. */
  markAsRead(conversationId: string): Promise<void>;

  /** Total unread count across all conversations. */
  getUnreadCount(): Promise<number>;

  /**
   * Subscribe to new messages arriving in realtime. Returns an unsubscribe
   * function. The subscription is scoped to the authenticated user.
   * Implementations must clean up on unsubscribe.
   */
  subscribeToMessages(
    cb: (event: NewMessageEvent) => void,
  ): () => void;

  /** Block a user in a conversation. */
  blockUser(conversationId: string, targetId: string): Promise<void>;

  /** Unblock a user in a conversation. */
  unblockUser(conversationId: string, targetId: string): Promise<void>;

  /** Report a conversation for abuse. */
  reportConversation(
    conversationId: string,
    reason: string,
    details?: string,
  ): Promise<void>;

  /** Hide (delete for me) a single message. */
  hideMessage(messageId: string): Promise<void>;
}
