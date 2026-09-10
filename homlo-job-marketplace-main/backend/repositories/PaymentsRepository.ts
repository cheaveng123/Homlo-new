import type { AuditLog, Boost, BoostStatus, Payment, PaymentStatus, PaymentWebhookEvent, Report, ReportStatus, ReportTargetType, UUID } from "../domain/models";
import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { Repository } from "./Repository";

export interface PaymentRepository { create(userId: UUID, amount: number, currency: string, provider: string, jobId?: UUID): Promise<Payment>; attachProviderTransaction(id: UUID, providerTransactionId: string): Promise<Payment>; markCompleted(providerTransactionId: string): Promise<Payment | null>; markFailed(providerTransactionId: string): Promise<Payment | null>; findByProviderTransactionId(id: string): Promise<Payment | null>; }
export interface PaymentWebhookEventRepository { recordIfNew(provider: string, providerEventId: string, eventType: string, payload: Record<string, unknown>): Promise<PaymentWebhookEvent | null>; markProcessed(id: UUID): Promise<void>; }
export interface BoostRepository { create(jobId: UUID, employerId: UUID, packageName: string, startAt: Date, expiresAt: Date): Promise<Boost>; activate(id: UUID): Promise<Boost | null>; expire(id: UUID): Promise<Boost | null>; }
export interface ReportRepository { create(reporterId: UUID, targetType: ReportTargetType, targetId: UUID, reason: string, details: string | null): Promise<Report>; updateStatus(id: UUID, status: ReportStatus): Promise<Report | null>; listByStatus(status: ReportStatus): Promise<Report[]>; listForTarget(type: ReportTargetType, id: UUID): Promise<Report[]>; }
export interface AuditLogRepository { record(actorUserId: UUID | null, action: string, entityType: string, entityId: UUID | null, metadata: Record<string, unknown> | null): Promise<AuditLog>; }

export class PostgresPaymentRepository extends Repository<Payment> implements PaymentRepository {
  readonly modelName = "payments";
  constructor(database: DatabaseAdapter) { super(database); }
  async create(userId: UUID, amount: number, currency: string, provider: string, jobId?: UUID): Promise<Payment> { const { rows } = await this.database.query<PaymentRow>(`insert into payments (user_id, job_id, amount, currency, provider) values ($1, $2, $3, $4, $5) returning *`, [userId, jobId ?? null, amount, currency, provider]); return toPayment(requiredRow(rows, "create payment")); }
  async attachProviderTransaction(id: UUID, providerTransactionId: string): Promise<Payment> { const { rows } = await this.database.query<PaymentRow>(`update payments set provider_transaction_id = $2 where id = $1 returning *`, [id, providerTransactionId]); return toPayment(requiredRow(rows, "attach provider transaction")); }
  async markCompleted(providerTransactionId: string): Promise<Payment | null> { const { rows } = await this.database.query<PaymentRow>(`update payments set status = 'completed' where provider_transaction_id = $1 and status = 'pending' returning *`, [providerTransactionId]); return rows[0] ? toPayment(rows[0]) : null; }
  async markFailed(providerTransactionId: string): Promise<Payment | null> { const { rows } = await this.database.query<PaymentRow>(`update payments set status = 'failed' where provider_transaction_id = $1 and status = 'pending' returning *`, [providerTransactionId]); return rows[0] ? toPayment(rows[0]) : null; }
  async findByProviderTransactionId(id: string): Promise<Payment | null> { const { rows } = await this.database.query<PaymentRow>(`select * from payments where provider_transaction_id = $1 limit 1`, [id]); return rows[0] ? toPayment(rows[0]) : null; }
}

export class PostgresPaymentWebhookEventRepository extends Repository<PaymentWebhookEvent> implements PaymentWebhookEventRepository {
  readonly modelName = "payment_webhook_events";
  constructor(database: DatabaseAdapter) { super(database); }
  async recordIfNew(provider: string, providerEventId: string, eventType: string, payload: Record<string, unknown>): Promise<PaymentWebhookEvent | null> { const { rows } = await this.database.query<WebhookRow>(`insert into payment_webhook_events (provider, provider_event_id, event_type, payload) values ($1, $2, $3, $4::jsonb) on conflict (provider, provider_event_id) do nothing returning *`, [provider, providerEventId, eventType, JSON.stringify(payload)]); return rows[0] ? toWebhook(rows[0]) : null; }
  async markProcessed(id: UUID): Promise<void> { await this.database.query(`update payment_webhook_events set processed_at = now() where id = $1`, [id]); }
}

export class PostgresBoostRepository extends Repository<Boost> implements BoostRepository {
  readonly modelName = "boosts";
  constructor(database: DatabaseAdapter) { super(database); }
  async create(jobId: UUID, employerId: UUID, packageName: string, startAt: Date, expiresAt: Date): Promise<Boost> { const { rows } = await this.database.query<BoostRow>(`insert into boosts (job_id, employer_id, package, start_at, expires_at) values ($1, $2, $3, $4, $5) returning *`, [jobId, employerId, packageName, startAt, expiresAt]); return toBoost(requiredRow(rows, "create boost")); }
  async activate(id: UUID): Promise<Boost | null> { const { rows } = await this.database.query<BoostRow>(`update boosts set status = 'active' where id = $1 returning *`, [id]); return rows[0] ? toBoost(rows[0]) : null; }
  async expire(id: UUID): Promise<Boost | null> { const { rows } = await this.database.query<BoostRow>(`update boosts set status = 'expired' where id = $1 and status = 'active' returning *`, [id]); return rows[0] ? toBoost(rows[0]) : null; }
}

export class PostgresReportRepository extends Repository<Report> implements ReportRepository {
  readonly modelName = "reports";
  constructor(database: DatabaseAdapter) { super(database); }
  async create(reporterId: UUID, targetType: ReportTargetType, targetId: UUID, reason: string, details: string | null): Promise<Report> { const { rows } = await this.database.query<ReportRow>(`insert into reports (reporter_id, target_type, target_id, reason, details) values ($1, $2, $3, $4, $5) returning *`, [reporterId, targetType, targetId, reason, details]); return toReport(requiredRow(rows, "create report")); }
  async updateStatus(id: UUID, status: ReportStatus): Promise<Report | null> { const { rows } = await this.database.query<ReportRow>(`update reports set status = $2 where id = $1 returning *`, [id, status]); return rows[0] ? toReport(rows[0]) : null; }
  async listByStatus(status: ReportStatus): Promise<Report[]> { const { rows } = await this.database.query<ReportRow>(`select * from reports where status = $1 order by created_at desc`, [status]); return rows.map(toReport); }
  async listForTarget(type: ReportTargetType, id: UUID): Promise<Report[]> { const { rows } = await this.database.query<ReportRow>(`select * from reports where target_type = $1 and target_id = $2 order by created_at desc`, [type, id]); return rows.map(toReport); }
}

export class PostgresAuditLogRepository extends Repository<AuditLog> implements AuditLogRepository {
  readonly modelName = "audit_logs";
  constructor(database: DatabaseAdapter) { super(database); }
  async record(actorUserId: UUID | null, action: string, entityType: string, entityId: UUID | null, metadata: Record<string, unknown> | null): Promise<AuditLog> { const { rows } = await this.database.query<AuditRow>(`insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values ($1, $2, $3, $4, $5::jsonb) returning *`, [actorUserId, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null]); return toAudit(requiredRow(rows, "record audit log")); }
}

type PaymentRow = { id: string; user_id: string; job_id: string | null; boost_id: string | null; amount: number | string; currency: string; provider: string; provider_transaction_id: string | null; status: PaymentStatus; created_at: Date; updated_at: Date };
type WebhookRow = { id: string; provider: string; provider_event_id: string; event_type: string; payload: Record<string, unknown>; received_at: Date; processed_at: Date | null };
type BoostRow = { id: string; job_id: string; employer_id: string; package: string; start_at: Date; expires_at: Date; status: BoostStatus; created_at: Date; updated_at: Date };
type ReportRow = { id: string; reporter_id: string; target_type: ReportTargetType; target_id: string; reason: string; details: string | null; status: ReportStatus; created_at: Date; updated_at: Date };
type AuditRow = { id: string; actor_user_id: string | null; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, unknown> | null; created_at: Date };
const requiredRow = <T>(rows: T[], action: string): T => { if (!rows[0]) throw new Error(`Database failed to ${action}`); return rows[0]; };
const toPayment = (row: PaymentRow): Payment => ({ id: row.id, userId: row.user_id, jobId: row.job_id, boostId: row.boost_id, amount: Number(row.amount), currency: row.currency, provider: row.provider, providerTransactionId: row.provider_transaction_id, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at });
const toWebhook = (row: WebhookRow): PaymentWebhookEvent => ({ id: row.id, provider: row.provider, providerEventId: row.provider_event_id, eventType: row.event_type, payload: row.payload, receivedAt: row.received_at, processedAt: row.processed_at });
const toBoost = (row: BoostRow): Boost => ({ id: row.id, jobId: row.job_id, employerId: row.employer_id, package: row.package, startAt: row.start_at, expiresAt: row.expires_at, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at });
const toReport = (row: ReportRow): Report => ({ id: row.id, reporterId: row.reporter_id, targetType: row.target_type, targetId: row.target_id, reason: row.reason, details: row.details, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at });
const toAudit = (row: AuditRow): AuditLog => ({ id: row.id, actorUserId: row.actor_user_id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, metadata: row.metadata, createdAt: row.created_at });
