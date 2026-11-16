import { apiCall } from "./_core/api";
import { isCanonicalJobId, jobDetailDecision } from "./job-detail-decision";

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

export { isCanonicalJobId, jobDetailDecision };

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