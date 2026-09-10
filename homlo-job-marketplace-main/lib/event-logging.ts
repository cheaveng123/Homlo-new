import { apiCall } from "./_core/api";

export type ClientEventType =
  | "impression"
  | "click"
  | "view"
  | "save"
  | "unsave"
  | "share"
  | "apply_started"
  | "apply_submitted"
  | "apply_withdrawn"
  | "hide"
  | "not_interested"
  | "report";

export type LogEventFields = {
  jobId: string;
  eventType: ClientEventType;
  feedPosition?: number;
  feedContext?: string;
  dwellTimeMs?: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Canonical (live, DB-backed) jobs are those with a real UUID id. Curated
 * placeholder jobs (e.g. "restaurant-server") are not in `jobs` and must not be
 * sent to the server, which would reject them as unknown.
 */
export function isCanonicalJobId(jobId: string): boolean {
  return UUID_PATTERN.test(jobId);
}

/**
 * Fire-and-forget backend call. Never affects the caller's UX: any failure /
 * rejection is swallowed and logged locally only.
 */
export function logJobEvent(fields: LogEventFields): void {
  if (!isCanonicalJobId(fields.jobId)) return;
  const { jobId, eventType, ...rest } = fields;
  apiCall(`/api/events/log`, {
    method: "POST",
    body: JSON.stringify({ eventType, jobId, ...rest }),
  }).catch((error) => {
    console.warn(`[events] failed to send ${eventType} for ${jobId}:`, error instanceof Error ? error.message : error);
  });
}