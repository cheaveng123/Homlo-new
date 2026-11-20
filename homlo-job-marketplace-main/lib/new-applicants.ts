/**
 * Pipeline statuses the employer has already acted on. `hired` is what the
 * Accept button writes, `interview` is shown to the worker as "Accepted" too,
 * and `declined` / `withdrawn` are closed out.
 */
const DECIDED_STATUSES: ReadonlySet<string> = new Set(["hired", "interview", "declined", "withdrawn"]);

/**
 * Whether an application belongs in "New applicants": still unread AND not yet
 * decided. Accepting from the list does not set the read receipt (`viewed_at`),
 * so `isNew` alone would keep an accepted applicant in the list and in every
 * count and badge.
 */
export function isNewApplicant(application: { isNew: boolean; status: string }): boolean {
  return application.isNew && !DECIDED_STATUSES.has(application.status);
}
