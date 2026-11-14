/**
 * SupabaseMessagingProvider — the production messaging provider.
 *
 * Transport:
 *  - Mutations + queries go through the tRPC homlo.messaging.* router,
 *    which routes to the gateway (service-role RPCs, server-enforced auth).
 *  - Realtime push is disabled. `subscribeToMessages` is a no-op; the unread
 *    badge polls every 15s and the chat screen loads on mount. This avoids an
 *    unauthenticated, unfiltered Realtime channel.
 */
import { trpcDirect } from "@/lib/trpc";
import type { MessagingProvider } from "./provider";
import type {
  Conversation,
  ConversationSummary,
  Message,
  NewMessageEvent,
} from "./types";

// ---------------------------------------------------------------------------
// Wire-format → domain model mapping
// ---------------------------------------------------------------------------

interface WireConversation {
  conversation_id: string;
  application_id: string | null;
  application_status: string | null;
  job_id: string | null;
  job_title: string;
  other_user_id: string;
  other_user_name: string;
  other_user_photo: string | null;
  last_message_at: string | null;
  last_message: string | null;
  last_message_author: string | null;
  unread_count: string;
}

interface WireMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  message_type: string;
  read_at: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  application_id?: string | null;
  job_id?: string | null;
  job_title?: string | null;
}

interface WireConversationDetail {
  id: string;
  application_id: string | null;
  job_id: string | null;
}

function mapConversationSummary(row: WireConversation): ConversationSummary {
  return {
    id: row.conversation_id,
    applicationId: row.application_id,
    jobId: row.job_id,
    jobTitle: row.job_title || "Untitled job",
    otherParticipant: {
      userId: row.other_user_id,
      name: row.other_user_name || "Homlo user",
      role: "employer",
      photo: row.other_user_photo ?? null,
    },
    lastMessageAt: row.last_message_at,
    lastMessage: row.last_message,
    lastMessageAuthorId: row.last_message_author,
    unreadCount: Number(row.unread_count ?? 0),
    applicationStatus: row.application_status ?? null,
  };
}

function mapMessage(row: WireMessage): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.message,
    messageType: (row.message_type as Message["messageType"]) ?? "text",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readAt: row.read_at,
    deletedAt: row.deleted_at,
    applicationId: row.application_id ?? null,
    jobId: row.job_id ?? null,
    jobTitle: row.job_title || null,
  };
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

class _SupabaseMessagingProvider implements MessagingProvider {
  // -- queries & mutations via gateway (tRPC) ----------------------------

  async getConversations(): Promise<ConversationSummary[]> {
    const result = await trpcDirect.homlo.messaging.conversations.query();
    const data = (result as any)?.conversations ?? result;
    if (!Array.isArray(data)) return [];
    return data
      .filter((r: WireConversation) => r.conversation_id && r.other_user_id)
      .map(mapConversationSummary)
      .sort((a, b) => {
        const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bt - at;
      });
  }

  async getOrCreateConversation(applicationId: string): Promise<Conversation> {
    const result = await trpcDirect.homlo.messaging.conversation.query({ applicationId });
    const c = (result as any)?.conversation ?? result;
    return {
      id: c.id,
      applicationId: c.application_id,
      jobId: c.job_id,
      jobTitle: "",
      participants: [],
      lastMessageAt: c.last_message_at ?? c.updated_at,
      blocked: false,
    };
  }

  async getMessages(conversationId: string, before?: string, limit?: number): Promise<Message[]> {
    const result = await trpcDirect.homlo.messaging.messages.query({
      conversationId,
      before: before ?? undefined,
      limit: limit ?? undefined,
    });
    const data = (result as any)?.messages ?? result;
    if (!Array.isArray(data)) return [];
    return data.map(mapMessage);
  }

  async sendMessage(conversationId: string, body: string): Promise<Message> {
    const result = await trpcDirect.homlo.messaging.send.mutate({ conversationId, message: body });
    const m = (result as any)?.message ?? result;
    return mapMessage(m);
  }

  async markAsRead(conversationId: string): Promise<void> {
    await trpcDirect.homlo.messaging.markRead.mutate({ conversationId });
  }

  async getUnreadCount(): Promise<number> {
    const result = await trpcDirect.homlo.messaging.unreadCount.query();
    const c = (result as any)?.count ?? (result as any)?.unreadCount;
    return Number(c ?? 0);
  }

  // -- Realtime ----------------------------------------------------------

  subscribeToMessages(_cb: (event: NewMessageEvent) => void): () => void {
    return () => {};
  }

  // -- blocks / reports --------------------------------------------------

  async blockUser(conversationId: string, targetId: string): Promise<void> {
    await trpcDirect.homlo.messaging.block.mutate({ conversationId, targetId });
  }

  async unblockUser(conversationId: string, targetId: string): Promise<void> {
    await trpcDirect.homlo.messaging.unblock.mutate({ conversationId, targetId });
  }

  async reportConversation(
    conversationId: string,
    reason: string,
    details?: string,
  ): Promise<void> {
    await trpcDirect.homlo.messaging.report.mutate({
      conversationId,
      reason,
      details: details ?? undefined,
    });
  }

  async hideMessage(messageId: string): Promise<void> {
    await trpcDirect.homlo.messaging.hide.mutate({ messageId });
  }
}

export const SupabaseMessagingProvider: MessagingProvider =
  new _SupabaseMessagingProvider();
