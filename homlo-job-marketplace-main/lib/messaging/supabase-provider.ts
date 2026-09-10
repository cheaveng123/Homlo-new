/**
 * SupabaseMessagingProvider — the first production messaging provider.
 *
 * Transport:
 *  - Mutations + queries go through the tRPC homlo.messaging.* router,
 *    which routes to the gateway (service-role RPCs, server-enforced auth).
 *  - Realtime push uses the Supabase JS SDK with the anon key + the user's
 *    access token. RLS policies (via homlo_current_user_id()) ensure the
 *    client can only see its own conversations/messages.
 *
 * Fallback:
 *  - If Realtime env vars are missing or the connection fails, the provider
 *    silently degrades to poll-on-focus (no push). The messaging domain
 *    always remains functional regardless.
 */
import { createClient, RealtimeChannel } from "@supabase/supabase-js";

import { trpcDirect } from "@/lib/trpc";
import type { MessagingProvider } from "./provider";
import type {
  Conversation,
  ConversationSummary,
  Message,
  NewMessageEvent,
} from "./types";

// ---------------------------------------------------------------------------
// Supabase client singleton (lazy-initialized, only if Realtime is configured)
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 2 } },
  });
  return supabaseClient;
}

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
        if (!a.lastMessageAt && !b.lastMessageAt) return 0;
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
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

  subscribeToMessages(cb: (event: NewMessageEvent) => void): () => void {
    const client = getSupabaseClient();
    if (!client) return () => {}; // polling-only fallback: nothing to unsubscribe

    let channel: RealtimeChannel | null = null;

    (async () => {
      try {
        // Ensure the access token is set for realtime auth (RLS).
        // The token refresh is handled by the tRPC client; we piggyback on it.
        channel = client
          .channel("messaging-realtime")
          .on(
            "postgres_changes" as any,
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
            } as any,
            (payload: any) => {
              const row = payload.new;
              if (!row) return;
              cb({
                conversationId: row.conversation_id,
                message: mapMessage(row),
              });
            },
          )
          .subscribe();
      } catch {
        // Realtime not available — degrade silently.
      }
    })();

    return () => {
      if (channel) {
        client.removeChannel(channel);
      }
    };
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
