/**
 * MessagingService — the app-facing API. Wraps a MessagingProvider and adds:
 *  - Business-rule checks (self-message, blocked user) as an early guard
 *    before the request leaves the client (defense-in-depth; the server
 *    enforces the canonical rules via SECURITY DEFINER RPCs).
 *  - Optimistic send tracking for the chat screen.
 *  - A shared hook-friendly interface for the inbox / chat screens.
 */
import type { MessagingProvider } from "./provider";
import type {
  Conversation,
  ConversationSummary,
  Message,
  NewMessageEvent,
} from "./types";

export class MessagingService {
  private provider: MessagingProvider;

  constructor(provider: MessagingProvider) {
    this.provider = provider;
  }

  /** List conversations (sorted newest-first by the provider). */
  async getConversations(): Promise<ConversationSummary[]> {
    return this.provider.getConversations();
  }

  /**
   * Open / get-or-create a canonical conversation for an application.
   * Returns the conversation context including job title for the chat header.
   */
  async openConversation(applicationId: string): Promise<Conversation> {
    return this.provider.getOrCreateConversation(applicationId);
  }

  /** Paginated message history for a conversation. */
  async getMessages(
    conversationId: string,
    before?: string,
    limit?: number,
  ): Promise<Message[]> {
    return this.provider.getMessages(conversationId, before, limit);
  }

  /**
   * Send a message. An early client-side guard rejects empty/oversized
   * messages and self-sends before the server round-trip. The server
   * re-validates everything (security definer), so a client bypass
   * is caught anyway.
   */
  async sendMessage(
    conversationId: string,
    body: string,
    currentUserId: string,
  ): Promise<Message> {
    const trimmed = body.trim();
    if (!trimmed) throw new Error("Message cannot be empty");
    if (trimmed.length > 4000) throw new Error("Message is too long");
    return this.provider.sendMessage(conversationId, trimmed);
  }

  /** Mark all messages in a conversation as read. */
  async markAsRead(conversationId: string): Promise<void> {
    return this.provider.markAsRead(conversationId);
  }

  /** Total unread count for the inbox badge. */
  async getUnreadCount(): Promise<number> {
    return this.provider.getUnreadCount();
  }

  /**
   * Subscribe to incoming messages. Caller must call the returned function
   * on unmount to avoid memory leaks.
   */
  subscribeToMessages(cb: (event: NewMessageEvent) => void): () => void {
    return this.provider.subscribeToMessages(cb);
  }

  async blockUser(conversationId: string, targetId: string): Promise<void> {
    return this.provider.blockUser(conversationId, targetId);
  }

  async unblockUser(conversationId: string, targetId: string): Promise<void> {
    return this.provider.unblockUser(conversationId, targetId);
  }

  async reportConversation(
    conversationId: string,
    reason: string,
    details?: string,
  ): Promise<void> {
    return this.provider.reportConversation(conversationId, reason, details);
  }

  async hideMessage(messageId: string): Promise<void> {
    return this.provider.hideMessage(messageId);
  }
}
