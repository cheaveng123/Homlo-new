/**
 * Formatting helpers for the THREE application-notification kinds shown in
 * the existing Alerts "Applications" tab. This file does not render anything
 * itself — it maps a notification row (as read from the real notifications
 * read model, migration 036) to the icon/title/body/tone the list knows how
 * to render, and to the existing application-detail / job-detail routes.
 *
 * Wire it into the list-item renderer, e.g.:
 *
 *   const view = formatApplicationNotification(row);
 *   <AlertRow
 *     icon={view.icon}
 *     tone={view.tone}
 *     title={view.title}
 *     body={view.body}
 *     timestamp={row.created_at}
 *     unread={!row.read}
 *     onPress={() => navigateToNotificationTarget(row)}
 *   />
 */

export type ApplicationNotificationType =
  | "application_accepted"
  | "application_declined"
  | "job_filled";

/**
 * Shape of a row returned by the gateway `notifications.list` action
 * (public.homlo_list_user_notifications — notifications + jobs join).
 */
export interface ApplicationNotificationRow {
  id: string;
  type: ApplicationNotificationType;
  title: string | null;
  body: string | null;
  read: boolean;
  created_at: string;
  job_id: string | null;
  application_id: string | null;
  job_title: string | null;
}

export type NotificationTone = "success" | "neutral" | "info";

export interface ApplicationNotificationView {
  tone: NotificationTone;
  /** Icon name for the existing icon set (line-style icons, no emoji). */
  icon: "check" | "info-circle" | "clock";
  title: string;
  body: string;
}

function isApplicationNotificationType(value: unknown): value is ApplicationNotificationType {
  return value === "application_accepted" || value === "application_declined" || value === "job_filled";
}

/** Coerces an unknown gateway row into the three known notification types. */
export function toApplicationNotificationRow(row: {
  type?: unknown;
  [key: string]: unknown;
}): ApplicationNotificationRow | null {
  if (!row || !isApplicationNotificationType(row.type) || typeof row.id !== "string") return null;
  return {
    id: row.id,
    type: row.type,
    title: typeof row.title === "string" ? row.title : null,
    body: typeof row.body === "string" ? row.body : null,
    read: row.read === true,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    job_id: typeof row.job_id === "string" ? row.job_id : null,
    application_id: typeof row.application_id === "string" ? row.application_id : null,
    job_title: typeof row.job_title === "string" ? row.job_title : null,
  };
}

export function formatApplicationNotification(row: ApplicationNotificationRow): ApplicationNotificationView {
  const jobTitle = row.job_title?.trim() || "this job";
  switch (row.type) {
    case "application_accepted":
      return {
        tone: "success",
        icon: "check",
        title: row.title?.trim() || "Application accepted",
        body: row.body?.trim() || `Your application for "${jobTitle}" was accepted.`,
      };
    case "application_declined":
      return {
        tone: "neutral",
        icon: "info-circle",
        title: row.title?.trim() || "Application update",
        body: row.body?.trim() || `Your application for "${jobTitle}" was not selected.`,
      };
    case "job_filled":
      return {
        tone: "info",
        icon: "clock",
        title: row.title?.trim() || "Job filled",
        body: row.body?.trim() || `The "${jobTitle}" position has been filled and the job is now closed.`,
      };
  }
}

/**
 * Where tapping a notification should navigate. Reuses the existing
 * application-detail / job-detail routes — no new notification-detail screen.
 */
export function getNotificationTarget(row: ApplicationNotificationRow): {
  route: "application-detail" | "job-detail";
  id: string;
} {
  if (row.type === "job_filled") {
    return { route: "job-detail", id: row.job_id ?? "" };
  }
  return { route: "application-detail", id: row.application_id ?? row.job_id ?? "" };
}