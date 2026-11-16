const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Canonical (live, DB-backed) jobs are those with a real UUID id. */
export function isCanonicalJobId(jobId: string): boolean {
  return UUID_PATTERN.test(jobId);
}

/** Pure fallback decision for a job detail page once loading has finished. */
export type JobDetailDecision = "detail" | "unavailable" | "error";

export function jobDetailDecision(liveJob: { id: string } | undefined, id: string, error: unknown): JobDetailDecision {
  if (liveJob) return "detail";
  if (isCanonicalJobId(id)) return error ? "error" : "unavailable";
  return "detail";
}
