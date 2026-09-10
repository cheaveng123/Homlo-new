import type { Notification, UUID } from "../domain/models";
import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { PostgresNotificationRepository } from "../repositories/EngagementRepository";

export const notificationTypes = ["new_application", "message", "job_status_change", "application_status_change"] as const;
export type NotificationType = (typeof notificationTypes)[number];

export class NotificationService {
  constructor(private readonly database: DatabaseAdapter) {}
  async notify(userId: UUID, type: NotificationType, title: string, body: string | null): Promise<Notification> {
    return new PostgresNotificationRepository(this.database).create(userId, type, title, body);
  }
}
