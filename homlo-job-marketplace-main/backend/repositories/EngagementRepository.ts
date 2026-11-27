import type { Notification, Review, UUID } from "../domain/models";
import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { Repository } from "./Repository";

export interface SavedJobRepository { save(userId: UUID, jobId: UUID): Promise<void>; unsave(userId: UUID, jobId: UUID): Promise<void>; listForUser(userId: UUID): Promise<UUID[]>; }
export interface NotificationRepository { create(userId: UUID, type: string, title: string, body: string | null): Promise<Notification>; listForUser(userId: UUID, options?: { unreadOnly?: boolean }): Promise<Notification[]>; markRead(id: UUID): Promise<void>; markAllRead(userId: UUID): Promise<void>; }
export interface ReviewRepository { create(jobId: UUID, reviewerId: UUID, revieweeId: UUID, rating: number, comment: string | null): Promise<Review>; softDelete(id: UUID): Promise<void>; listForReviewee(userId: UUID): Promise<Review[]>; getAverageRating(userId: UUID): Promise<number | null>; }

export class PostgresSavedJobRepository extends Repository<UUID> implements SavedJobRepository {
  readonly modelName = "saved_jobs";
  constructor(database: DatabaseAdapter) { super(database); }
  async save(userId: UUID, jobId: UUID): Promise<void> { await this.database.query(`insert into saved_jobs (user_id, job_id) values ($1, $2) on conflict (user_id, job_id) do nothing`, [userId, jobId]); }
  async unsave(userId: UUID, jobId: UUID): Promise<void> { await this.database.query(`delete from saved_jobs where user_id = $1 and job_id = $2`, [userId, jobId]); }
  async listForUser(userId: UUID): Promise<UUID[]> { const { rows } = await this.database.query<{ job_id: string }>(`select job_id from saved_jobs where user_id = $1 order by created_at desc`, [userId]); return rows.map((row) => row.job_id); }
}

export class PostgresNotificationRepository extends Repository<Notification> implements NotificationRepository {
  readonly modelName = "notifications";
  constructor(database: DatabaseAdapter) { super(database); }
  async create(userId: UUID, type: string, title: string, body: string | null): Promise<Notification> { const { rows } = await this.database.query<NotificationRow>(`insert into notifications (user_id, type, title, body) values ($1, $2, $3, $4) returning *`, [userId, type, title, body]); return toNotification(requiredRow(rows, "create notification")); }
  async listForUser(userId: UUID, options: { unreadOnly?: boolean } = {}): Promise<Notification[]> { const unread = options.unreadOnly ? " and read = false" : ""; const { rows } = await this.database.query<NotificationRow>(`select * from notifications where user_id = $1${unread} order by created_at desc`, [userId]); return rows.map(toNotification); }
  async markRead(id: UUID): Promise<void> { await this.database.query(`update notifications set read = true where id = $1`, [id]); }
  async markAllRead(userId: UUID): Promise<void> { await this.database.query(`update notifications set read = true where user_id = $1 and read = false`, [userId]); }
}

export class PostgresReviewRepository extends Repository<Review> implements ReviewRepository {
  readonly modelName = "reviews";
  constructor(database: DatabaseAdapter) { super(database); }
  async create(jobId: UUID, reviewerId: UUID, revieweeId: UUID, rating: number, comment: string | null): Promise<Review> { const { rows } = await this.database.query<ReviewRow>(`insert into reviews (job_id, reviewer_id, reviewee_id, rating, comment) values ($1, $2, $3, $4, $5) returning *`, [jobId, reviewerId, revieweeId, rating, comment]); return toReview(requiredRow(rows, "create review")); }
  async softDelete(id: UUID): Promise<void> { await this.database.query(`update reviews set deleted_at = now() where id = $1 and deleted_at is null`, [id]); }
  async listForReviewee(userId: UUID): Promise<Review[]> { const { rows } = await this.database.query<ReviewRow>(`select * from reviews where reviewee_id = $1 and deleted_at is null order by created_at desc`, [userId]); return rows.map(toReview); }
  async getAverageRating(userId: UUID): Promise<number | null> { const { rows } = await this.database.query<{ average: number | string | null }>(`select avg(rating) as average from reviews where reviewee_id = $1 and deleted_at is null`, [userId]); return rows[0]?.average == null ? null : Number(rows[0].average); }
}

type NotificationRow = { id: string; user_id: string; type: string; title: string; body: string | null; read: boolean; created_at: Date };
type ReviewRow = { id: string; job_id: string; reviewer_id: string; reviewee_id: string; rating: number; comment: string | null; created_at: Date; updated_at: Date; deleted_at: Date | null };
const requiredRow = <T>(rows: T[], action: string): T => { if (!rows[0]) throw new Error(`Database failed to ${action}`); return rows[0]; };
const toNotification = (row: NotificationRow): Notification => ({ id: row.id, userId: row.user_id, type: row.type, title: row.title, body: row.body, read: row.read, createdAt: row.created_at });
const toReview = (row: ReviewRow): Review => ({ id: row.id, jobId: row.job_id, reviewerId: row.reviewer_id, revieweeId: row.reviewee_id, rating: row.rating, comment: row.comment, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at });
