/**
 * applicationNotifications.ts
 *
 * Formatting helpers for the THREE new notification kinds that will show
 * up in the existing Alerts screen, inside its existing "Applications" tab.
 * This file does not render anything itself — it maps a notification row
 * (as read from the existing notifications table/hook) to the icon/title/
 * body the existing Alerts list already knows how to render.
 *
 * Wire it into whatever the existing list-item renderer is, e.g.:
 *
 *   const view = formatApplicationNotification(row);
 *   <AlertRow
 *     icon={view.icon}
 *     tone={view.tone}
 *     title={view.title}
 *     body={view.body}
 *     timestamp={row.createdAt}
 *     unread={!row.readAt}
 *     onPress={() => navigateToNotificationTarget(row)}
 *   />
 *
 * Adjust the input type below to match the real notifications row shape —
 * this assumes `type`, `job_title`, `job_id`, `application_id`, `read_at`,
 * `created_at` columns; rename fields to match the actual schema.
 */

export type ApplicationNotificationType =
  | 'application_accepted'
  | 'application_declined'
  | 'job_filled';

export interface ApplicationNotificationRow {
  id: string;
  type: ApplicationNotificationType;
  jobTitle: string;
  jobId: string;
  applicationId: string | null;
  readAt: string | null;
  createdAt: string;
}

export type NotificationTone = 'success' | 'neutral' | 'info';

export interface ApplicationNotificationView {
  tone: NotificationTone;
  /** Icon name for the existing icon set (line-style icons, no emoji). */
  icon: 'check' | 'info-circle' | 'clock';
  title: string;
  body: string;
}

export function formatApplicationNotification(
  row: ApplicationNotificationRow
): ApplicationNotificationView {
  switch (row.type) {
    case 'application_accepted':
      return {
        tone: 'success',
        icon: 'check',
        title: 'Application accepted',
        body: `Your application for "${row.jobTitle}" was accepted.`,
      };
    case 'application_declined':
      return {
        tone: 'neutral',
        icon: 'info-circle',
        title: 'Application update',
        body: `Your application for "${row.jobTitle}" was not selected.`,
      };
    case 'job_filled':
      return {
        tone: 'info',
        icon: 'clock',
        title: 'Job filled',
        body: `The "${row.jobTitle}" position has been filled and the job is now closed.`,
      };
  }
}

/**
 * Where tapping a notification should navigate. Reuses whatever the
 * existing application-detail / job-detail routes already are — do not
 * introduce a new notification-detail screen.
 */
export function getNotificationTarget(row: ApplicationNotificationRow): {
  route: 'application-detail' | 'job-detail';
  id: string;
} {
  if (row.type === 'job_filled') {
    return { route: 'job-detail', id: row.jobId };
  }
  // application_accepted / application_declined
  return { route: 'application-detail', id: row.applicationId ?? row.jobId };
}
