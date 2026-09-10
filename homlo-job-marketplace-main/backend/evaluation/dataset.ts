// =========================================================
// Deterministic evaluation dataset (Phase 10).
//
// A self-contained, in-memory snapshot of everything the ranking pipeline
// consumes: jobs, users/profiles, applications, job events, boosts, quality
// stats and the employer/job evidence needed to simulate the phase 8 quality
// aggregation with the SAME pure math the aggregation service uses.
//
// The snapshot is the unit a temporal evaluation truncates: an eval run for a
// user at time T is always served from a snapshot that has been clipped to
// jobs existing and evidence occurring <= T. That is what makes the evaluation
// leakage-safe (see temporal.ts).
//
// No randomness anywhere: every builder/deduper here is deterministic.
// =========================================================

import {
  computeEmployerQualityStats,
  computeJobQualityStats,
  type EmployerQualityEvidence,
  type JobInteractionCounts,
} from "../ranking/quality-aggregation";

export type EvalPayType = "hourly" | "daily" | "fixed";

export type EvalJob = {
  id: string;
  employerId: string;
  categoryId: string | null;
  title: string;
  description: string;
  payAmount: number;
  payCurrency: string;
  payType: EvalPayType;
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  startDate: string | null;
  startTime: string | null;
  endTime: string | null;
  workersNeeded: number;
  workersHired: number;
  status: "draft" | "open" | "filled" | "closed";
  deleted: boolean;
  createdAt: Date;
};

export type EvalUser = {
  id: string;
  status: "active" | "suspended";
  createdAt: Date;
};

export type EvalProfile = {
  userId: string;
  fullName: string | null;
  latitude: number | null;
  longitude: number | null;
  deleted: boolean;
};

export type EvalEvent = {
  id: string;
  eventType: string;
  userId: string | null;
  jobId: string;
  employerId: string;
  sessionId: string | null;
  feedPosition: number | null;
  occurredAt: Date;
  ipHash: string | null;
  dwellTimeMs: number | null;
  snapshot: string | null;
};

export type EvalApplication = {
  jobId: string;
  workerId: string;
  status: string;
};

export type EvalBoost = {
  jobId: string;
  employerId: string;
  status: "active" | "inactive";
  startAt: Date;
  expiresAt: Date;
  package: string | null;
};

export type EvalReview = {
  employerId: string;
  rating: number;
  deleted: boolean;
};

export type EvalReport = {
  targetType: "job" | "user";
  targetId: string;
  status: string;
};

export type EvalMessage = {
  id: string;
  conversationId: string;
  jobId: string;
  employerId: string;
  senderId: string;
  createdAt: Date;
};

export type EvalJobQualityRow = {
  jobId: string;
  impressions: number;
  clicks: number;
  appliesStarted: number;
  appliesSubmitted: number;
  ctrWilsonLB: number | null;
  applyRateWilsonLB: number | null;
  nEvents: number;
};

export type EvalEmployerQualityRow = {
  employerId: string;
  nJobsPosted: number;
  nCompletions: number;
  nReports: number;
  completionRateWilsonLB: number | null;
  positiveReviewRateWilsonLB: number | null;
  responseRateWilsonLB: number | null;
};

/** The complete, immutable evaluation dataset. */
export type EvalDataset = {
  jobs: EvalJob[];
  users: EvalUser[];
  profiles: EvalProfile[];
  events: EvalEvent[];
  applications: EvalApplication[];
  boosts: EvalBoost[];
  reviews: EvalReview[];
  reports: EvalReport[];
  messages: EvalMessage[];
  jobQuality: Map<string, EvalJobQualityRow>;
  employerQuality: Map<string, EvalEmployerQualityRow>;
};

// ---------------------------------------------------------------------------
// Identity deduping (mirrors the phase 8 service's DISTINCT identity × type)
// ---------------------------------------------------------------------------

function eventIdentityKey(event: EvalEvent): string {
  return event.userId ?? event.sessionId ?? event.ipHash ?? `none:${event.employerId}`;
}

export function distinctEventCount(events: readonly EvalEvent[], jobId: string, eventType: string): number {
  const seen = new Set<string>();
  for (const event of events) {
    if (event.jobId !== jobId || event.eventType !== eventType) continue;
    seen.add(eventIdentityKey(event));
  }
  return seen.size;
}

/** Deduped non-impression signal events for the evidence weight (n_events). */
export function distinctSignalCount(events: readonly EvalEvent[], jobId: string): number {
  const seen = new Set<string>();
  for (const event of events) {
    if (event.jobId !== jobId || event.eventType === "impression") continue;
    seen.add(`${event.eventType}:${eventIdentityKey(event)}`);
  }
  return seen.size;
}

// ---------------------------------------------------------------------------
// Aggregation simulation — the SAME pure math the phase 8 service runs
// ---------------------------------------------------------------------------

export function collectJobCounts(events: readonly EvalEvent[], jobId: string): JobInteractionCounts {
  return {
    jobId,
    employerId: events.find((event) => event.jobId === jobId)?.employerId ?? "",
    impressions: distinctEventCount(events, jobId, "impression"),
    clicks: distinctEventCount(events, jobId, "click"),
    appliesStarted: distinctEventCount(events, jobId, "apply_started"),
    appliesSubmitted: distinctEventCount(events, jobId, "apply_submitted"),
    nEvents: distinctSignalCount(events, jobId),
  };
}

export function collectEmployerEvidence(dataset: Pick<EvalDataset, "jobs" | "applications" | "reviews" | "reports" | "messages">, employerId: string): EmployerQualityEvidence {
  const jobs = dataset.jobs.filter((job) => job.employerId === employerId && !job.deleted);
  const jobIds = new Set(jobs.map((job) => job.id));
  const applications = dataset.applications.filter((app) => jobIds.has(app.jobId));
  const reviews = dataset.reviews.filter((review) => review.employerId === employerId && !review.deleted);
  const reports = dataset.reports
    .filter((report) => report.status !== "dismissed")
    .filter((report) =>
      report.targetType === "user"
        ? report.targetId === employerId
        : report.targetType === "job" && jobIds.has(report.targetId),
    );

  // Response-rate evidence: conversations tied to this employer's jobs. A
  // conversation is worker-initiated when the first message sender is NOT the
  // employer; it counts as responded when the employer sent >= 1 message.
  const conversationByJobEmployer = new Map<string, string>();
  for (const message of dataset.messages) if (jobIds.has(message.jobId)) conversationByJobEmployer.set(message.conversationId, message.employerId);
  let nWorkerInitiated = 0;
  let nResponded = 0;
  for (const [conversationId, employer] of conversationByJobEmployer) {
    const messages = dataset.messages.filter((m) => m.conversationId === conversationId);
    if (messages.length === 0) continue;
    const first = messages.map((m) => [m.createdAt.getTime(), m.senderId] as const).sort((a, b) => a[0] - b[0])[0][1];
    if (first === employer) continue;
    nWorkerInitiated += 1;
    if (messages.some((m) => m.senderId === employer)) nResponded += 1;
  }

  return {
    employerId,
    nJobsPosted: jobs.length,
    nApplications: applications.length,
    nCompletions: applications.filter((app) => app.status === "hired").length,
    nReports: reports.length,
    nReviews: reviews.length,
    nPositiveReviews: reviews.filter((review) => review.rating >= 4).length,
    nWorkerInitiated,
    nResponded,
  };
}

/** Recompute a job-quality stats row from evidence with the phase 8 math. */
export function aggregateJobQuality(events: readonly EvalEvent[], jobId: string): EvalJobQualityRow {
  const stats = computeJobQualityStats(collectJobCounts(events, jobId));
  return {
    jobId,
    impressions: stats.impressions,
    clicks: stats.clicks,
    appliesStarted: stats.appliesStarted,
    appliesSubmitted: stats.appliesSubmitted,
    ctrWilsonLB: stats.ctrWilsonLB,
    applyRateWilsonLB: stats.applyRateWilsonLB,
    nEvents: stats.nEvents,
  };
}

/** Recompute an employer-quality stats row from evidence with the phase 8 math. */
export function aggregateEmployerQuality(dataset: EvalDataset, employerId: string): EvalEmployerQualityRow {
  const stats = computeEmployerQualityStats(collectEmployerEvidence(dataset, employerId));
  return {
    employerId,
    nJobsPosted: stats.nJobsPosted,
    nCompletions: stats.nCompletions,
    nReports: stats.nReports,
    completionRateWilsonLB: stats.completionRateWilsonLB,
    positiveReviewRateWilsonLB: stats.positiveReviewRateWilsonLB,
    responseRateWilsonLB: stats.responseRateWilsonLB,
  };
}

/**
 * Simulate a phase 8 aggregation run over the whole dataset: recompute every
 * job/employer stats row from raw evidence using the exact pure math the
 * service uses. Returns a NEW dataset with the stats maps replaced — never
 * mutates the input.
 */
export function simulateAggregation(dataset: EvalDataset): EvalDataset {
  const jobQuality = new Map<string, EvalJobQualityRow>();
  for (const job of dataset.jobs) {
    if (job.deleted || job.status !== "open") continue;
    jobQuality.set(job.id, aggregateJobQuality(dataset.events, job.id));
  }
  const employerQuality = new Map<string, EvalEmployerQualityRow>();
  const employerIds = new Set(dataset.jobs.filter((job) => !job.deleted).map((job) => job.employerId));
  for (const employerId of employerIds) {
    employerQuality.set(employerId, aggregateEmployerQuality(dataset, employerId));
  }
  return { ...dataset, jobQuality, employerQuality };
}

// ---------------------------------------------------------------------------
// Temporal truncation — the leakage shield
// ---------------------------------------------------------------------------

/**
 * Return a deep-copied snapshot clipped so the pipeline at time `nowMs` can
 * only see jobs that existed and evidence that occurred by then. Deleted jobs
 * are dropped; events after nowMs are dropped; stats rows are preserved only
 * when they correspond to a live job/employer (their computation instant is a
 * separate concern left to the caller).
 */
export function truncateDataset(dataset: EvalDataset, nowMs: number): EvalDataset {
  const at = (date: Date): boolean => date.getTime() <= nowMs;
  const jobs = dataset.jobs.filter((job) => !job.deleted && at(job.createdAt));
  return {
    jobs,
    users: dataset.users.filter((user) => at(user.createdAt)),
    profiles: dataset.profiles.filter((profile) => !profile.deleted),
    events: dataset.events.filter((event) => at(event.occurredAt)),
    applications: dataset.applications.slice(),
    boosts: dataset.boosts.filter((boost) => at(boost.startAt)),
    reviews: dataset.reviews.slice(),
    reports: dataset.reports.slice(),
    messages: dataset.messages.filter((message) => at(message.createdAt)),
    jobQuality: subsetMap(dataset.jobQuality, jobs.map((job) => job.id)),
    employerQuality: subsetMap(dataset.employerQuality, [...new Set(jobs.map((job) => job.employerId))]),
  };
}

function subsetMap<K, V>(map: ReadonlyMap<K, V>, keys: readonly K[]): Map<K, V> {
  const result = new Map<K, V>();
  const wanted = new Set(keys);
  for (const [key, value] of map) if (wanted.has(key)) result.set(key, value);
  return result;
}