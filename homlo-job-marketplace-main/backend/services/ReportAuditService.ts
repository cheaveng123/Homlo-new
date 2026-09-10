import type { AuditLog, Report, ReportTargetType, UUID } from "../domain/models";
import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { PostgresAuditLogRepository, PostgresReportRepository } from "../repositories/PaymentsRepository";

export class AuditLogService {
  constructor(private readonly database: DatabaseAdapter) {}
  record(actorUserId: UUID | null, action: string, entityType: string, entityId: UUID | null, metadata: Record<string, unknown> | null): Promise<AuditLog> { return new PostgresAuditLogRepository(this.database).record(actorUserId, action, entityType, entityId, metadata); }
}

export class ReportService {
  constructor(private readonly database: DatabaseAdapter) {}
  async submitReport(reporterId: UUID, targetType: ReportTargetType, targetId: UUID, reason: string, details: string | null): Promise<Report> {
    const report = await new PostgresReportRepository(this.database).create(reporterId, targetType, targetId, reason, details);
    await new AuditLogService(this.database).record(reporterId, "report.submitted", "report", report.id, { targetType, targetId });
    return report;
  }
}
