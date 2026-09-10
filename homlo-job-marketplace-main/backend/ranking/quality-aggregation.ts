// =========================================================
// Quality aggregation — pure math (phase 8).
//
// This module turns raw interaction/outcome counts into the Wilson lower-bound
// + counter values persisted by the scheduled aggregation job
// (quality-aggregation-service.ts) into employer_quality_stats and
// job_quality_stats. It performs NO database access and NO ranking math:
// EmployerQuality / JobObservedQuality / JobQualityEffective / CombinedQuality
// / QualityMultiplier all stay in phase 4 (scoring-service.ts), which reads
// exactly these persisted columns. This modules exists so every aggregation
// formula is unit-testable without a database.
//
// Compatibility contract:
//   - job_quality_stats: job_id, impressions, clicks, applies_started,
//     applies_submitted, ctr_wilson_lb, apply_rate_wilson_lb, n_events,
//     last_computed_at. There is NO observed_quality column — JobObservedQuality
//     is derived in the aggregation layer ONLY through the persisted wilson
//     columns (computed below with backend/ranking/wilson.ts), and phase 4
//     recombines them with rankingConfig.quality.jobComponents.
//   - employer_quality_stats: employer_id, n_jobs_posted, n_completions,
//     n_reports, completion_rate_wilson_lb, positive_review_rate_wilson_lb,
//     response_rate_wilson_lb, verification_status, last_computed_at.
//     verification_status is NOT derived here — no verification flow exists in
//     the schema, so it is always left untouched (default 'unverified' for new
//     rows); it is never overwritten with a quality value.
//
// Missing-data rule (phase-8 directed): a component whose trial base is empty
// yields a NULL lower bound, not a punitive zero. Null components are
// renormalized away by phase 4's combineQualityColumns, so thin evidence leans
// on the neutral prior rather than being punished as bad.
// =========================================================

import { wilsonLowerBound } from "./wilson";

// ---------------------------------------------------------------------------
// Raw row counts (counts arrive as bigint/number/string from the driver)
// ---------------------------------------------------------------------------

export type RawCount = number | string | null | undefined;

// ---------------------------------------------------------------------------
// Wilson rate (counts to lower bound)
// ---------------------------------------------------------------------------

/**
 * Wilson lower bound of successes/trials, or null when there is no evidence
 * (trials <= 0). Successes are floored, clamped to [0, trials] and never allowed
 * to exceed trials: inconsistent input (e.g. a logged apply beyond the impression
 * count) must not inflate the bound toward 1.0 — conservative by construction.
 */
export function wilsonRate(successes: number, trials: number): number | null {
  if (!Number.isFinite(trials) || trials <= 0) return null;
  const flatn = Math.floor(trials);
  const flats = Math.max(0, Number.isFinite(successes) ? Math.floor(successes) : 0);
  return wilsonLowerBound(Math.min(flats, flatn), flatn);
}

// ---------------------------------------------------------------------------
// Job-level aggregation
// ---------------------------------------------------------------------------

export type JobInteractionCounts = {
  jobId: string;
  employerId: string;
  /** deduped impressions (exposure evidence; denominator/context, never a penalty) */
  impressions: RawCount;
  /** deduped clicks */
  clicks: RawCount;
  /** deduped apply_started */
  appliesStarted: RawCount;
  /** deduped apply_submitted (strongest persisted outcome) */
  appliesSubmitted: RawCount;
  /** deduped non-impression signal events (evidence weight for phase 4 shrinkage) */
  nEvents: RawCount;
};

export type JobQualityStats = {
  jobId: string;
  impressions: number;
  clicks: number;
  appliesStarted: number;
  appliesSubmitted: number;
  nEvents: number;
  ctrWilsonLB: number | null;
  applyRateWilsonLB: number | null;
};

/**
 * Persisted job-level deltas. Both rates share the impression denominator
 * (exposure = the opportunity), so `ctr_wilson_lb` is a Wilson lower bound and
 * `apply_rate_wilson_lb` a conservative funnel step (applies_submitted /
 * impressions). Counts are floor-clamped to non-negative integers; successes
 * never exceed trials (see wilsonRate). JobObservedQuality itself is NOT
 * computed here — phase 4 blends these two columns with
 * rankingConfig.quality.jobComponents.
 */
export function computeJobQualityStats(counts: JobInteractionCounts): JobQualityStats {
  const impressions = nonNegInt(counts.impressions);
  const clicks = nonNegInt(counts.clicks);
  const appliesStarted = nonNegInt(counts.appliesStarted);
  const appliesSubmitted = nonNegInt(counts.appliesSubmitted);
  const nEvents = nonNegInt(counts.nEvents);

  return {
    jobId: counts.jobId,
    impressions,
    clicks,
    appliesStarted,
    appliesSubmitted,
    nEvents,
    ctrWilsonLB: wilsonRate(clicks, impressions),
    applyRateWilsonLB: wilsonRate(appliesSubmitted, impressions),
  };
}

// ---------------------------------------------------------------------------
// Employer-level aggregation
// ---------------------------------------------------------------------------

export type EmployerQualityEvidence = {
  employerId: string;
  /** non-deleted jobs posted by this employer */
  nJobsPosted: RawCount;
  /** applications across the employer's non-deleted jobs (completion trial base) */
  nApplications: RawCount;
  /** applications that reached status 'hired' (the only completion outcome in the schema) */
  nCompletions: RawCount;
  /** non-dismissed reports targeting the employer's jobs or the employer user */
  nReports: RawCount;
  /** non-deleted reviews where the employer is the reviewee */
  nReviews: RawCount;
  /** reviews with rating >= 4 */
  nPositiveReviews: RawCount;
  /** worker-initiated job conversations the employer is a member of (response trial base) */
  nWorkerInitiated: RawCount;
  /** worker-initiated conversations in which the employer sent >= 1 message */
  nResponded: RawCount;
};

export type EmployerQualityStats = {
  employerId: string;
  nJobsPosted: number;
  nCompletions: number;
  nReports: number;
  completionRateWilsonLB: number | null;
  positiveReviewRateWilsonLB: number | null;
  responseRateWilsonLB: number | null;
};

/**
 * Persisted employer-level deltas. A rate column is NULL unless its trial base
 * is positive (no applications / no reviews / no worker-initiated conversations
 * ⇒ unknown, not zero). Phase 4 renormalizes the three configured components
 * (completion 0.5 / positiveReview 0.3 / response 0.2) over the columns that
 * actually exist — thin evidence always stays conservative. n_reports is the
 * only report column the schema exposes; it is persisted for trust/moderation
 * observability and has no phase-4 component in V1.
 */
export function computeEmployerQualityStats(evidence: EmployerQualityEvidence): EmployerQualityStats {
  const nApplications = nonNegInt(evidence.nApplications);
  const nCompletions = nonNegInt(evidence.nCompletions);
  const nReviews = nonNegInt(evidence.nReviews);
  const nPositiveReviews = nonNegInt(evidence.nPositiveReviews);
  const nWorkerInitiated = nonNegInt(evidence.nWorkerInitiated);
  const nResponded = nonNegInt(evidence.nResponded);

  return {
    employerId: evidence.employerId,
    nJobsPosted: nonNegInt(evidence.nJobsPosted),
    nCompletions,
    nReports: nonNegInt(evidence.nReports),
    completionRateWilsonLB: wilsonRate(nCompletions, nApplications),
    positiveReviewRateWilsonLB: wilsonRate(nPositiveReviews, nReviews),
    responseRateWilsonLB: wilsonRate(nResponded, nWorkerInitiated),
  };
}

// ---------------------------------------------------------------------------
// Count sanitization
// ---------------------------------------------------------------------------

/** Floor any finite number/string to a non-negative integer (malformed ⇒ 0). */
function nonNegInt(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}