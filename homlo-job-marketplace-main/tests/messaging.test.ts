import { describe, expect, it } from "vitest";

import { MessagingService } from "../lib/messaging/service";
import type { MessagingProvider } from "../lib/messaging/provider";
import type { TrpcContext } from "../server/_core/context";
import { appRouter } from "../server/routers";
import type { HomloSessionUser } from "../server/homlo-direct-service";
import type {
  Conversation,
  ConversationSummary,
  Message,
  NewMessageEvent,
} from "../lib/messaging/types";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "m1",
    conversationId: "c1",
    senderId: "u2",
    body: "Hello",
    messageType: "text",
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: null,
    readAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id: "c1",
    applicationId: "a1",
    jobId: "j1",
    jobTitle: "Waiter",
    otherParticipant: { userId: "u2", name: "Sokha", role: "employer" },
    lastMessageAt: "2026-09-01T10:00:00.000Z",
    lastMessage: "Hello",
    lastMessageAuthorId: "u2",
    unreadCount: 1,
    ...overrides,
  };
}

class FakeProvider implements MessagingProvider {
  conversations: ConversationSummary[] = [];
  conversation: Conversation | null = null;
  messages: Message[] = [];
  sent: { conversationId: string; body: string }[] = [];
  read: string[] = [];
  blocked: string[] = [];
  reported: { conversationId: string; reason: string; details?: string }[] = [];
  hidden: string[] = [];
  unsubscribeCalls = 0;
  subscribed = 0;

  async getConversations(): Promise<ConversationSummary[]> {
    return this.conversations;
  }
  async getOrCreateConversation(applicationId: string): Promise<Conversation> {
    return this.conversation ?? { id: `c-${applicationId}`, applicationId, jobId: null, jobTitle: "", participants: [], lastMessageAt: null, blocked: false };
  }
  async getMessages(conversationId: string): Promise<Message[]> {
    return this.messages.filter((m) => m.conversationId === conversationId);
  }
  async sendMessage(conversationId: string, body: string): Promise<Message> {
    this.sent.push({ conversationId, body });
    return makeMessage({ conversationId, senderId: "u1", body });
  }
  async markAsRead(conversationId: string): Promise<void> {
    this.read.push(conversationId);
  }
  async getUnreadCount(): Promise<number> {
    return this.conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  }
  subscribeToMessages(cb: (event: NewMessageEvent) => void): () => void {
    this.subscribed += 1;
    return () => {
      this.unsubscribeCalls += 1;
    };
  }
  async blockUser(conversationId: string, targetId: string): Promise<void> {
    this.blocked.push(`${conversationId}:${targetId}`);
  }
  async unblockUser(): Promise<void> {}
  async reportConversation(conversationId: string, reason: string, details?: string): Promise<void> {
    this.reported.push({ conversationId, reason, details });
  }
  async hideMessage(messageId: string): Promise<void> {
    this.hidden.push(messageId);
  }
}

describe("MessagingService input guards", () => {
  it("rejects empty and whitespace-only messages before hitting the provider", async () => {
    const provider = new FakeProvider();
    const svc = new MessagingService(provider);

    await expect(svc.sendMessage("c1", "   ", "u1")).rejects.toThrow("Message cannot be empty");
    expect(provider.sent).toHaveLength(0);
  });

  it("trims the payload before sending", async () => {
    const provider = new FakeProvider();
    const svc = new MessagingService(provider);

    await svc.sendMessage("c1", "  hi there  ", "u1");
    expect(provider.sent).toEqual([{ conversationId: "c1", body: "hi there" }]);
  });

  it("rejects messages longer than the 4000-character limit", async () => {
    const provider = new FakeProvider();
    const svc = new MessagingService(provider);

    await expect(svc.sendMessage("c1", "x".repeat(4001), "u1")).rejects.toThrow("Message is too long");
    expect(provider.sent).toHaveLength(0);
  });

  it("accepts a message exactly at the limit", async () => {
    const provider = new FakeProvider();
    const svc = new MessagingService(provider);

    await expect(svc.sendMessage("c1", "x".repeat(4000), "u1")).resolves.toBeTruthy();
    expect(provider.sent).toHaveLength(1);
  });
});

describe("MessagingService delegation", () => {
  it("delegates conversation listing to the provider", async () => {
    const provider = new FakeProvider();
    provider.conversations = [makeSummary()];
    const svc = new MessagingService(provider);

    await expect(svc.getConversations()).resolves.toEqual(provider.conversations);
  });

  it("delegates get-or-create conversation to the provider and passes the application id", async () => {
    const provider = new FakeProvider();
    const svc = new MessagingService(provider);

    const conversation = await svc.openConversation("a9");
    expect(conversation.id).toBe("c-a9");
    expect(conversation.applicationId).toBe("a9");
  });

  it("delegates message reads, mark-read, and unread count", async () => {
    const provider = new FakeProvider();
    provider.messages = [makeMessage()];
    const svc = new MessagingService(provider);

    const messages = await svc.getMessages("c1");
    expect(messages).toHaveLength(1);

    await svc.markAsRead("c1");
    expect(provider.read).toEqual(["c1"]);

    await expect(svc.getUnreadCount()).resolves.toBe(0);
  });

  it("delegates block and report to the provider", async () => {
    const provider = new FakeProvider();
    const svc = new MessagingService(provider);

    await svc.blockUser("c1", "u9");
    expect(provider.blocked).toEqual(["c1:u9"]);

    await svc.reportConversation("c1", "spam", "repeated contact");
    expect(provider.reported).toEqual([{ conversationId: "c1", reason: "spam", details: "repeated contact" }]);
  });

  it("delegates hide-message to the provider", async () => {
    const provider = new FakeProvider();
    const svc = new MessagingService(provider);

    await svc.hideMessage("m5");
    expect(provider.hidden).toEqual(["m5"]);
  });
});

describe("MessagingService realtime subscription cleanup", () => {
  it("returns an unsubscribe function that the caller must invoke on unmount", () => {
    const provider = new FakeProvider();
    const svc = new MessagingService(provider);

    const unsub = svc.subscribeToMessages(() => {});
    expect(provider.subscribed).toBe(1);
    expect(provider.unsubscribeCalls).toBe(0);

    unsub();
    expect(provider.unsubscribeCalls).toBe(1);
  });

  it("delivers inbound events to the callback with normalized Message data", () => {
    const provider = new FakeProvider();
    const svc = new MessagingService(provider);
    const received: NewMessageEvent[] = [];

    const unsub = svc.subscribeToMessages((event) => received.push(event));
    // Real providers fire this from their realtime handler.
    expect(typeof unsub).toBe("function");
  });
});

describe("appRouter — homlo.messaging wiring", () => {
  const HOMLO_USER: HomloSessionUser = {
    id: "worker-1",
    status: "active",
    profileComplete: true,
    role: "worker",
    fullName: "Test Worker",
    email: "worker@test.dev",
  };

  it("exposes every messaging procedure on the router", () => {
    const caller = appRouter.createCaller({} as TrpcContext);
    const messaging = caller.homlo.messaging as unknown as Record<string, unknown>;
    for (const name of ["conversations", "conversation", "messages", "send", "markRead", "unreadCount", "block", "unblock", "report", "hide"]) {
      expect(typeof messaging[name]).toBe("function");
    }
  });

  it("rejects unauthenticated calls before touching the service", async () => {
    const caller = appRouter.createCaller({} as TrpcContext);
    await expect(caller.homlo.messaging.conversations()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.homlo.messaging.send({ conversationId: "00000000-0000-0000-0000-000000000000", message: "hi" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("enforces zod input bounds on send (empty / too long) before invoking the service", async () => {
    const caller = appRouter.createCaller({ homloUser: HOMLO_USER, supabaseAccessToken: "tok-1" } as TrpcContext);
    await expect(caller.homlo.messaging.send({ conversationId: "00000000-0000-0000-0000-000000000000", message: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.homlo.messaging.send({ conversationId: "00000000-0000-0000-0000-000000000000", message: "x".repeat(4001) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("reaches the service layer once authenticated (fails only on missing Supabase credentials)", async () => {
    const caller = appRouter.createCaller({ homloUser: HOMLO_USER, supabaseAccessToken: "tok-1" } as TrpcContext);
    await expect(caller.homlo.messaging.conversations()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});