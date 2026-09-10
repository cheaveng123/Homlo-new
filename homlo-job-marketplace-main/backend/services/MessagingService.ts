import type { Message, UUID } from "../domain/models";
import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { PostgresConversationRepository, PostgresMessageRepository } from "../repositories/MessagingRepository";

export class MessagingService {
  constructor(private readonly database: DatabaseAdapter) {}
  async sendMessage(conversationId: UUID, senderId: UUID, text: string): Promise<Message> {
    const message = text.trim(); if (!message) throw new Error("A message cannot be empty");
    return this.database.transaction(async (transaction) => {
      const conversations = new PostgresConversationRepository(transaction);
      if (!(await conversations.isMember(conversationId, senderId))) throw new Error("Only conversation members can send messages");
      const created = await new PostgresMessageRepository(transaction).send(conversationId, senderId, message);
      await conversations.touchLastMessage(conversationId, created.createdAt);
      return created;
    });
  }
}
