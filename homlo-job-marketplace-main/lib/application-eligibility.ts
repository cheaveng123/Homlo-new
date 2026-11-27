export type WorkerApplicationSummary = { status?: string | null } | null | undefined;

const REAPPLY_STATUSES = new Set(["withdrawn", "declined"]);

/**
 * Returns true while a worker still has an application that should block a
 * second submission. Withdrawn and declined applications may be reapplied to,
 * matching homlo_submit_application in migration 036.
 */
export function isActiveApplication(application: WorkerApplicationSummary): boolean {
  const status = application?.status?.trim().toLowerCase();
  if (!status) return false;
  return !REAPPLY_STATUSES.has(status);
}

export type ApplyActionState = { disabled: boolean; label?: string };

export function applyActionState(
  application: WorkerApplicationSummary,
  jobFilled: boolean,
): ApplyActionState {
  if (jobFilled) return { disabled: true, label: "Job filled" };
  if (isActiveApplication(application)) return { disabled: true, label: "Applied" };
  return { disabled: false };
}
