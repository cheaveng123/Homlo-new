import type { Conversation, Message, UUID } from "../domain/models";
import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { Repository } from "./Repository";

export interface ConversationRepository { findOrCreateForJob(jobId: UUID, memberUserIds: UUID[]): Promise<Conversation>; listForUser(userId: UUID): Promise<Conversation[]>; touchLastMessage(conversationId: UUID, timestamp: Date): Promise<void>; isMember(conversationId: UUID, userId: UUID): Promise<boolean>; }
export interface MessageRepository { send(conversationId: UUID, senderId: UUID, message: string): Promise<Message>; listForConversation(conversationId: UUID, viewerId: UUID): Promise<Message[]>; markRead(messageId: UUID, readerId: UUID): Promise<void>; hideForUser(messageId: UUID, userId: UUID): Promise<void>; }

export class PostgresConversationRepository extends Repository<Conversation> implements ConversationRepository {
  readonly modelName = "conversations";
  constructor(database: DatabaseAdapter) { super(database); }
  async findOrCreateForJob(jobId: UUID, memberUserIds: UUID[]): Promise<Conversation> {
    const members = [...new Set(memberUserIds)].sort();
    return this.database.transaction(async (transaction) => {
      const { rows: existing } = await transaction.query<ConversationRow>(`select c.* from conversations c where c.job_id = $1 and c.deleted_at is null and (select count(*) from conversation_members cm where cm.conversation_id = c.id) = $2 and not exists (select 1 from conversation_members cm where cm.conversation_id = c.id and cm.user_id <> all($3::uuid[])) limit 1`, [jobId, members.length, `{${members.join(",")}}`]);
      if (existing[0]) return toConversation(existing[0]);
      const { rows } = await transaction.query<ConversationRow>(`insert into conversations (job_id) values ($1) returning *`, [jobId]);
      const conversation = toConversation(requiredRow(rows, "create conversation"));
      for (const userId of members) await transaction.query(`insert into conversation_members (conversation_id, user_id) values ($1, $2)`, [conversation.id, userId]);
      return conversation;
    });
  }
  async listForUser(userId: UUID): Promise<Conversation[]> { const { rows } = await this.database.query<ConversationRow>(`select c.* from conversations c join conversation_members cm on cm.conversation_id = c.id where cm.user_id = $1 and c.deleted_at is null order by c.last_message_at desc nulls last`, [userId]); return rows.map(toConversation); }
  async touchLastMessage(conversationId: UUID, timestamp: Date): Promise<void> { await this.database.query(`update conversations set last_message_at = $2 where id = $1 and deleted_at is null`, [conversationId, timestamp]); }
  async isMember(conversationId: UUID, userId: UUID): Promise<boolean> { const { rows } = await this.database.query<{ found: boolean }>(`select exists(select 1 from conversation_members where conversation_id = $1 and user_id = $2) as found`, [conversationId, userId]); return Boolean(rows[0]?.found); }
}

export class PostgresMessageRepository extends Repository<Message> implements MessageRepository {
  readonly modelName = "messages";
  constructor(database: DatabaseAdapter) { super(database); }
  async send(conversationId: UUID, senderId: UUID, message: string): Promise<Message> { const { rows } = await this.database.query<MessageRow>(`insert into messages (conversation_id, sender_id, message) values ($1, $2, $3) returning *`, [conversationId, senderId, message]); return toMessage(requiredRow(rows, "send message")); }
  async listForConversation(conversationId: UUID, viewerId: UUID): Promise<Message[]> { const { rows } = await this.database.query<MessageRow>(`select m.* from messages m where m.conversation_id = $1 and not exists (select 1 from message_hidden_for h where h.message_id = m.id and h.user_id = $2) order by m.created_at asc`, [conversationId, viewerId]); return rows.map(toMessage); }
  async markRead(messageId: UUID, readerId: UUID): Promise<void> { await this.database.query(`update messages set read_at = now() where id = $1 and sender_id <> $2`, [messageId, readerId]); }
  async hideForUser(messageId: UUID, userId: UUID): Promise<void> { await this.database.query(`insert into message_hidden_for (message_id, user_id) values ($1, $2) on conflict do nothing`, [messageId, userId]); }
}

type ConversationRow = { id: string; job_id: string | null; last_message_at: Date | null; created_at: Date; updated_at: Date; deleted_at: Date | null };
type MessageRow = { id: string; conversation_id: string; sender_id: string; message: string; read_at: Date | null; created_at: Date };
const requiredRow = <T>(rows: T[], action: string): T => { if (!rows[0]) throw new Error(`Database failed to ${action}`); return rows[0]; };
const toConversation = (row: ConversationRow): Conversation => ({ id: row.id, jobId: row.job_id, lastMessageAt: row.last_message_at, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at });
const toMessage = (row: MessageRow): Message => ({ id: row.id, conversationId: row.conversation_id, senderId: row.sender_id, message: row.message, readAt: row.read_at, createdAt: row.created_at });
