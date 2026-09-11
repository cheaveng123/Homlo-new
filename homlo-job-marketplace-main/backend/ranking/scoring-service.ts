// =========================================================
// RankingScoringService — deterministic V1 scoring (phase 4).
//
// Consumes the PHASE 3 candidate pool (unscored, hard-eligible) and produces,
// for every candidate, the component-level deterministic score. Phase 5
// consumes the output directly: MMR diversity, sponsored boost, exploration
// injection and final feed assembly are NOT performed here.
//
// Formula (all constants from backend/config/rankingConfig.ts):
//
//   BaseRelevance =
//       wLoc × Location + wPay × Pay + wSch × Schedule
//     + wCat × CategoryPreference + wJobType × JobType
//     + wBeh × BehavioralAffinity
//
//   w_job                   = n / (n + shrinkageK)        (continuous shrinkage)
//   JobQualityEffective     = w_job × JobObservedQuality
//                             + (1 − w_job) × EmployerQuality
//   CombinedQuality         = 0.75 × EmployerQuality + 0.25 × JobQualityEffective
//   QualityMultiplier       = floor + scale × CombinedQuality   (penalty-only, ≤ 1)
//   FreshnessDecay          = exp(−max(0, hoursSincePosted) / tau)
//   UrgencyBoost            = 1 + max(0, (windowHours − hoursUntilStart) / windowHours)
//                                 × (maxBoost − 1), capped at maxBoost
//   OrganicScore            = BaseRelevance × QualityMultiplier × FreshnessDecay × UrgencyBoost
//
// Missing-data rules:
//   - Missing quality row → quality.neutralPrior (trust-safe, never zero).
//   - Missing behavioral history / too thin ⇒ cold-start redistribution: the
//     behavioral weight is redistributed proportionally across the other five
//     weights so the effective BaseRelevance stays normalized to 1.0.
//   - Missing distance / pay sample → config missingData.* neutral values.
//   - Reports are never treated as behavioral preferences (trust only).
//
// Efficiency: exactly 4 batched queries regardless of pool size (jobs,
// employer_quality_stats, job_quality_stats, user events) — no N+1, no
// full-database pass. Pay percentiles are computed over the bounded pool's own
// category subset.
// =========================================================

import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { rankingConfig } from "../config/rankingConfig";
import { clamp01 } from "./wilson";
import { haversineKm } from "./distance";
import type { RetrievalCandidate, RetrievalPreferences } from "./candidate-retrieval";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ScoringPreferences = RetrievalPreferences & {
  /** Preferred job types (client vocabulary: Part-time, Full-time, Internship, Temporary, Weekend, Remote). */
  jobTypes?: string[];
  /** Preferred work days (client vocabulary: Mon..Sun). */
  availabilityDays?: string[];
  /** Preferred time of day (client vocabulary: Morning, Afternoon, Evening, Night). */
  availabilityTime?: string;
};

export type ScoreCandidatesInput = {
  userId?: string | null;
  userLocation?: { latitude: number; longitude: number } | null;
  candidates: RetrievalCandidate[];
  preferences?: ScoringPreferences | null;
  now?: Date;
};

export type RelevanceComponents = {
  location: number;
  pay: number;
  schedule: number;
  categoryPreference: number;
  jobType: number;
  behavioralAffinity: number;
};

export type QualityScores = {
  employerQuality: number;
  jobObservedQuality: number;
  jobQualityEffective: number;
  combinedQuality: number;
  qualityMultiplier: number;
  jobEventCount: number;
};

/** Exact payload Phase 5 attaches to a served event's ranking_score_snapshot. */
export type RankingSnapshot = {
  rankingVersion: string;
  baseRelevance: number;
  locationScore: number;
  payScore: number;
  scheduleScore: number;
  categoryPreferenceScore: number;
  jobTypeScore: number;
  behavioralAffinity: number;
  employerQuality: number;
  jobObservedQuality: number;
  jobQualityEffective: number;
  combinedQuality: number;
  qualityMultiplier: number;
  freshnessDecay: number;
  urgencyBoost: number;
  organicScore: number;
  distanceKm: number | null;
  sponsored: boolean;
  exploration: boolean;
  coldStart: boolean;
  mmr?: RankingMMRInfo;

  // Phase 6 sponsored-boost metadata. Populated after the sponsored +
  // exploration layer runs; absent on raw phase 4 snapshots.
  sponsoredMultiplier?: number;
  sponsoredEligible?: boolean;
  finalPreAssemblyScore?: number;
};

export type ScoredCandidate = {
  jobId: string;
  employerId: string;
  components: RelevanceComponents;
  baseRelevance: number;
  quality: QualityScores;
  freshnessDecay: number;
  urgencyBoost: number;
  organicScore: number;
  rankingVersion: string;
  distanceKm: number | null;
  rankingSnapshot: RankingSnapshot;
  features: CandidateFeatures;
  metadata?: Record<string, unknown>;
};

/** Inferred per-candidate features Phase 5 similarity reads. Additive to scoring: the scorer emits them, but BaseRelevance and the snapshot are unchanged by their presence. */
export type CandidateFeatures = {
  categoryId: string | null;
  /** Inferred job-type signals (remote / part-time / full-time / weekend). Empty means unknown — absence is never treated as a mismatch. */
  jobTypes: string[];
};

/** Phase 5 MMR metadata attached to the ranking snapshot of a re-ranked candidate. */
export type RankingMMRInfo = {
  relevance: number;
  redundancy: number;
  score: number;
  selectedRank: number;
};

export type BaseRelevanceWeights = {
  location: number;
  pay: number;
  schedule: number;
  categoryPreference: number;
  jobType: number;
  behavioralAffinity: number;
};

// ---------------------------------------------------------------------------
// Config validation (fail fast on an invalid central configuration)
// ---------------------------------------------------------------------------

export function validateRankingConfig(): void {
  const weights = rankingConfig.baseRelevanceWeights;
  assertNormalized("baseRelevanceWeights", summary(weights));
  assertNormalized("quality.employerWeight+jobWeight", rankingConfig.quality.employerWeight + rankingConfig.quality.jobWeight);
  assertNormalized("behavioral.featureWeights", rankingConfig.behavioral.featureWeights.category + rankingConfig.behavioral.featureWeights.employer);

  const floor = rankingConfig.quality.qualityMultiplierFloor;
  const scale = rankingConfig.quality.qualityMultiplierScale;
  if (!Number.isFinite(floor) || floor < 0 || !Number.isFinite(scale) || scale < 0 || floor + scale > 1 + 1e-9) {
    throw new Error("rankingConfig: quality multiplier floor/scale must be non-negative and floor + scale <= 1 (penalty-only multiplier)");
  }
  if (!(rankingConfig.quality.shrinkageK > 0)) {
    throw new Error("rankingConfig: quality.shrinkageK must be positive");
  }
}

function summary(weights: BaseRelevanceWeights): number {
  return weights.location + weights.pay + weights.schedule + weights.categoryPreference + weights.jobType + weights.behavioralAffinity;
}

function assertNormalized(label: string, sum: number): void {
  if (!Number.isFinite(sum) || Math.abs(sum - 1) > 1e-6) {
    throw new Error(`rankingConfig: ${label} must sum to 1 for a normalized weighted score (got ${sum})`);
  }
}

validateRankingConfig();

// ---------------------------------------------------------------------------
// Pure deterministic scoring math (exported for unit testing)
// ---------------------------------------------------------------------------

/** 1 / (1 + (distanceKm / d0)^2) — nonlinear decay, bounded; null distance ⇒ neutral. */
export function locationScore(distanceKm: number | null, d0Km: number, neutral: number): number {
  if (distanceKm == null) return clamp01(neutral);
  if (!(d0Km > 0)) return clamp01(neutral);
  const d = Math.max(0, distanceKm);
  return clamp01(1 / (1 + (d / d0Km) ** 2));
}

/** Normalize pay to an hourly equivalent, or null when it cannot be derived. */
export function hourlyEquivalent(
  payAmount: number | null | undefined,
  payType: string | null | undefined,
  opts: { hoursPerDay: number; shiftHours: number | null },
): number | null {
  const amount = typeof payAmount === "number" && Number.isFinite(payAmount) ? payAmount : payAmount != null ? Number(payAmount) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  switch (payType) {
    case "hourly":
      return amount;
    case "daily":
      return opts.hoursPerDay > 0 ? amount / opts.hoursPerDay : null;
    case "fixed":
      return opts.shiftHours != null && opts.shiftHours > 0 ? amount / opts.shiftHours : null;
    default:
      return null;
  }
}

/**
 * Percentile of `target` among `values` in [0, 1] (fraction of strictly lower
 * comparable jobs). Deterministic tie handling by sorting on (value, valueIndex).
 */
export function payPercentile(values: readonly number[], target: number): number | null {
  if (values.length < 2) return null;
  let lower = 0;
  for (const value of values) if (value <= target) lower += 1;
  // value <= target counts the target itself; the highest possible value ties count
  const frac = Math.max(0, lower - 1) / (values.length - 1);
  return clamp01(frac);
}

/** Exponential half-life behavioral decay: 0.5^(ageDays / halfLifeDays). */
export function decayFactor(ageMs: number, halfLifeDays: number): number {
  if (!Number.isFinite(ageMs) || ageMs < 0) return 1;
  if (!(halfLifeDays > 0)) return 1;
  const ageDays = ageMs / 86_400_000;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/** FreshnessDecay = exp(−max(0, hoursSincePosted) / tau); unknown posting time ⇒ neutral 1. */
export function freshnessDecay(hoursSincePosted: number | null, tauHours: number): number {
  if (hoursSincePosted == null) return 1;
  if (!(tauHours > 0)) return 1;
  return clamp01(Math.exp(-Math.max(0, hoursSincePosted) / tauHours));
}

/** UrgencyBoost = 1 + max(0, (windowHours − hoursUntilStart) / windowHours) × (maxBoost − 1), capped. */
export function urgencyBoost(hoursUntilStart: number | null, windowHours: number, maxBoost: number): number {
  if (hoursUntilStart == null) return 1;
  if (!(windowHours > 0) || maxBoost < 1) return 1;
  if (hoursUntilStart <= 0) return 1;
  const t = Math.min(hoursUntilStart, windowHours);
  return Math.min(maxBoost, 1 + ((windowHours - t) / windowHours) * (maxBoost - 1));
}

/** Continuous scope: w = n / (n + k); JobQualityEffective = w×observed + (1−w)×employer. */
export function jobQualityEffective(
  n: number,
  observedQuality: number,
  employerQuality: number,
  shrinkageK: number,
): number {
  const count = Number.isFinite(n) && n > 0 ? n : 0;
  const w = shrinkageK > 0 ? count / (count + shrinkageK) : 1;
  const observed = clamp01(observedQuality);
  const employer = clamp01(employerQuality);
  return clamp01(w * observed + (1 - w) * employer);
}

export function combinedQuality(employerQuality: number, jobQualityEffective: number, employerWeight: number, jobWeight: number): number {
  return clamp01(employerWeight * employerQuality + jobWeight * jobQualityEffective);
}

/** Penalty-only: floor + scale × CombinedQuality, never above 1. */
export function qualityMultiplier(combined: number, floor: number, scale: number): number {
  return Math.min(1, Math.max(0, floor + scale * clamped01(combined)));
}

function clamped01(value: number): number {
  return clamp01(value);
}

/**
 * Cold-start weight redistribution. When behavioral affinity is unavailable,
 * its configured weight is redistributed proportionally across the other five
 * components so BaseRelevance remains normalized to 1.0.
 */
export function effectiveBaseWeights(
  behavioralAvailable: boolean,
  weights: BaseRelevanceWeights = rankingConfig.baseRelevanceWeights,
): BaseRelevanceWeights {
  if (behavioralAvailable || weights.behavioralAffinity <= 0) return { ...weights };
  const denominator = 1 - weights.behavioralAffinity;
  if (!(denominator > 0)) return { ...weights };
  return {
    location: weights.location / denominator,
    pay: weights.pay / denominator,
    schedule: weights.schedule / denominator,
    categoryPreference: weights.categoryPreference / denominator,
    jobType: weights.jobType / denominator,
    behavioralAffinity: 0,
  };
}

export function baseRelevance(components: RelevanceComponents, weights: BaseRelevanceWeights): number {
  const raw =
    weights.location * components.location +
    weights.pay * components.pay +
    weights.schedule * components.schedule +
    weights.categoryPreference * components.categoryPreference +
    weights.jobType * components.jobType +
    weights.behavioralAffinity * components.behavioralAffinity;
  return clamped01(raw);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type ScoreJob = {
  jobId: string;
  employerId: string;
  categoryId: string | null;
  payAmount: number;
  payCurrency: string;
  payType: "hourly" | "daily" | "fixed";
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  startDate: string | null;
  startTime: string | null;
  endTime: string | null;
  createdAtMs: number | null;
};

type JobRow = {
  id: string;
  employer_id: string;
  category_id: string | null;
  pay_amount: number | string;
  pay_currency: string;
  pay_type: "hourly" | "daily" | "fixed";
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string | Date | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string | Date | null;
};

type EmployerQualityRow = {
  employer_id: string;
  completion_rate_wilson_lb: number | string | null;
  positive_review_rate_wilson_lb: number | string | null;
  response_rate_wilson_lb: number | string | null;
};

type JobQualityRow = {
  job_id: string;
  ctr_wilson_lb: number | string | null;
  apply_rate_wilson_lb: number | string | null;
  n_events: number | string | null;
};

/** The postgres driver deserializes `date` columns into Date (UTC midnight); map back to "YYYY-MM-DD" for the text parser. */
function toDateOnlyString(value: string | Date | null): string | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()]
      .map((part) => String(part).padStart(2, "0"))
      .join("-");
  }
  return typeof value === "string" ? value : null;
}

type EventRow = {
  event_type: string;
  occurred_at: string | Date;
  dwell_time_ms: number | string | null;
  employer_id: string;
  category_id: string | null;
};

type BehavioralAffinity = {
  available: boolean;
  category: Map<string, number>;
  employer: Map<string, number>;
};

type EmployerQualityMap = Map<string, number>;
type JobQualityMap = Map<string, { observed: number; nEvents: number }>;

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function parseHoursMin(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m) && m !== undefined) return null;
  const minute = Number.isFinite(m) ? m : 0;
  if (h < 0 || h > 23 || minute < 0 || minute > 59) return null;
  return h * 3600 + minute * 60;
}

function shiftHours(job: ScoreJob): number | null {
  const start = parseHoursMin(job.startTime);
  const end = parseHoursMin(job.endTime);
  if (start == null || end == null) return null;
  const hours = (end - start) / 3600;
  return hours > 0 && hours <= 24 ? hours : null;
}

function parseLocalDateMs(date: string | null | undefined): number | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  if (![y, m, d].every(Number.isFinite)) return null;
  return Date.UTC(y, m - 1, d);
}

function startDateTimeMs(job: ScoreJob): number | null {
  const date = parseLocalDateMs(job.startDate);
  if (date == null) return null;
  const seconds = parseHoursMin(job.startTime);
  return date + (seconds ?? 0) * 1000;
}

const timeBuckets: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

function timeBucket(seconds: number | null): string | null {
  if (seconds == null) return null;
  const hour = seconds / 3600;
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Night";
}

const INFERABLE_JOB_TYPES = ["remote", "part-time", "full-time", "weekend"] as const;

function jobTypeSignals(job: ScoreJob, partTimeMaxHours: number, fullTimeMinHours: number): Set<string> {
  const signals = new Set<string>();
  if ((job.locationText ?? "").toLowerCase().includes("remote")) signals.add("remote");
  const shift = shiftHours(job);
  if (shift != null) {
    if (shift < partTimeMaxHours) signals.add("part-time");
    if (shift >= fullTimeMinHours) signals.add("full-time");
  }
  const date = parseLocalDateMs(job.startDate);
  if (date != null) {
    const weekday = WEEKDAYS[new Date(date).getUTCDay()];
    if (weekday === "Sat" || weekday === "Sun") signals.add("weekend");
  }
  return signals;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class RankingScoringService {
  constructor(private readonly database: DatabaseAdapter) {}

  async scoreCandidates(input: ScoreCandidatesInput): Promise<ScoredCandidate[]> {
    validateRankingConfig();
    const now = input.now ?? new Date();
    const nowMs = now.getTime();

    if (!input.candidates.length) return [];

    // ---- Batched loads (constant number of queries vs pool size) ------------
    const jobIds = unique(input.candidates.map((candidate) => candidate.jobId));
    const jobs = await this.loadJobs(jobIds);

    // Candidates whose job row vanished between retrieval and scoring are
    // dropped deterministically rather than scored on stale data.
    const resolved = input.candidates.filter((candidate) => jobs.has(candidate.jobId));
    if (!resolved.length) return [];

    const employerIds = unique(resolved.map((candidate) => jobs.get(candidate.jobId)!.employerId));
    const [employerQuality, jobQuality, affinity] = await Promise.all([
      this.loadEmployerQuality(employerIds),
      this.loadJobQuality(jobIds),
      input.userId ? this.loadBehavioralAffinity(input.userId, nowMs, resolved, jobs) : Promise.resolve(null),
    ]);

    const behavioralAvailable = affinity !== null && affinity.available;
    const weights = effectiveBaseWeights(behavioralAvailable);
    const payPercentiles = this.payPercentilesForPool(resolved, jobs);

    const scored: ScoredCandidate[] = [];
    for (const candidate of resolved) {
      const job = jobs.get(candidate.jobId)!;
      scored.push(this.scoreOne(candidate, job, {
        nowMs,
        userLocation: input.userLocation ?? null,
        preferences: input.preferences ?? null,
        employerQuality: employerQuality.get(candidate.employerId) ?? null,
        jobQuality: jobQuality.get(candidate.jobId) ?? null,
        behavioralAvailable,
        weights,
        payPercentile: payPercentiles.get(candidate.jobId) ?? null,
        affinity,
      }));
    }
    return scored;
  }

  // ---- Batch database loads (no N+1) ----------------------------------------

  private async loadJobs(jobIds: readonly string[]): Promise<Map<string, ScoreJob>> {
    if (!jobIds.length) return new Map();
    const { rows } = await this.database.query<JobRow>(
      `select id, employer_id, category_id, pay_amount, pay_currency, pay_type,
              location_text, latitude, longitude, start_date, start_time, end_time, created_at
         from jobs
        where id = any($1::uuid[])`,
      [toArrayParam(jobIds)],
    );
    const map = new Map<string, ScoreJob>();
    for (const row of rows) {
      const createdAt = row.created_at instanceof Date ? row.created_at.getTime() : row.created_at != null ? Date.parse(row.created_at) : NaN;
      map.set(row.id, {
        jobId: row.id,
        employerId: row.employer_id,
        categoryId: row.category_id,
        payAmount: toNumber(row.pay_amount) ?? 0,
        payCurrency: row.pay_currency,
        payType: row.pay_type,
        locationText: row.location_text,
        latitude: toNumber(row.latitude),
        longitude: toNumber(row.longitude),
        startDate: toDateOnlyString(row.start_date),
        startTime: row.start_time,
        endTime: row.end_time,
        createdAtMs: Number.isFinite(createdAt) ? createdAt : null,
      });
    }
    return map;
  }

  private async loadEmployerQuality(employerIds: readonly string[]): Promise<EmployerQualityMap> {
    if (!employerIds.length) return new Map();
    const { rows } = await this.database.query<EmployerQualityRow>(
      `select employer_id, completion_rate_wilson_lb, positive_review_rate_wilson_lb, response_rate_wilson_lb
         from employer_quality_stats
        where employer_id = any($1::uuid[])`,
      [toArrayParam(employerIds)],
    );
    const config = rankingConfig.quality;
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.employer_id, combineQualityColumns(
        [
          { name: "completion", value: toNumber(row.completion_rate_wilson_lb), weight: config.employerComponents.completion },
          { name: "positiveReview", value: toNumber(row.positive_review_rate_wilson_lb), weight: config.employerComponents.positiveReview },
          { name: "response", value: toNumber(row.response_rate_wilson_lb), weight: config.employerComponents.response },
        ],
        config.neutralPrior,
      ));
    }
    return map;
  }

  private async loadJobQuality(jobIds: readonly string[]): Promise<JobQualityMap> {
    if (!jobIds.length) return new Map();
    const { rows } = await this.database.query<JobQualityRow>(
      `select job_id, ctr_wilson_lb, apply_rate_wilson_lb, n_events
         from job_quality_stats
        where job_id = any($1::uuid[])`,
      [toArrayParam(jobIds)],
    );
    const config = rankingConfig.quality;
    const map = new Map<string, { observed: number; nEvents: number }>();
    for (const row of rows) {
      map.set(row.job_id, {
        observed: combineQualityColumns(
          [
            { name: "ctr", value: toNumber(row.ctr_wilson_lb), weight: config.jobComponents.ctr },
            { name: "applyRate", value: toNumber(row.apply_rate_wilson_lb), weight: config.jobComponents.applyRate },
          ],
          config.neutralPrior,
        ),
        nEvents: Math.max(0, toNumber(row.n_events) ?? 0),
      });
    }
    return map;
  }

  private async loadBehavioralAffinity(
    userId: string,
    nowMs: number,
    resolved: RetrievalCandidate[],
    jobs: Map<string, ScoreJob>,
  ): Promise<BehavioralAffinity | null> {
    const config = rankingConfig.behavioral;
    const cutoffMs = nowMs - config.lookbackDays * 86_400_000;
    const { rows } = await this.database.query<EventRow>(
      `select je.event_type, je.occurred_at, je.dwell_time_ms, je.employer_id, j.category_id
         from job_events je
         left join jobs j on j.id = je.job_id
        where je.user_id = $1
          and je.occurred_at >= $2`,
      [userId, new Date(cutoffMs)],
    );

    const halfLifeDays = rankingConfig.behavioralDecay.halfLifeDays;
    const category = new Map<string, number>();
    const employer = new Map<string, number>();
    let engagementEvents = 0;

    for (const row of rows) {
      if (row.event_type === "report") continue; // reports are trust/moderation, never preference
      let weight = toNumber(config.eventWeights[row.event_type as keyof typeof config.eventWeights]) ?? 0;
      if (row.event_type === "view") {
        const dwell = toNumber(row.dwell_time_ms) ?? 0;
        weight = dwell >= config.viewMeaningfulDwellMs
          ? Number(config.eventWeights.view)
          : Number(config.eventWeights.shortView);
      }
      if (weight === 0 || !Number.isFinite(weight)) continue;
      if (row.event_type !== "impression") engagementEvents += 1;

      const occurred = row.occurred_at instanceof Date ? row.occurred_at.getTime() : Date.parse(row.occurred_at);
      const ageMs = Number.isFinite(occurred) ? Math.max(0, nowMs - occurred) : 0;
      const strength = weight * decayFactor(ageMs, halfLifeDays);
      if (row.category_id) accumulate(category, row.category_id, strength);
      accumulate(employer, row.employer_id, strength);
    }

    const available = engagementEvents >= config.minEvidenceEvents;
    return { available, category: normalizeMap(category), employer: normalizeMap(employer) };
  }

  // ---- Pay percentiles over the bounded pool --------------------------------

  private payPercentilesForPool(resolved: RetrievalCandidate[], jobs: Map<string, ScoreJob>): Map<string, number> {
    const config = rankingConfig;
    const buckets = new Map<string, { jobId: string; hourly: number }[]>();
    for (const candidate of resolved) {
      const job = jobs.get(candidate.jobId);
      if (!job || !job.categoryId) continue;
      const shift = shiftHours(job);
      const hourly = hourlyEquivalent(job.payAmount, job.payType, {
        hoursPerDay: config.pay.assumedHoursPerDay,
        shiftHours: shift,
      });
      if (hourly == null) continue;
      const bucket = buckets.get(job.categoryId) ?? [];
      bucket.push({ jobId: job.jobId, hourly });
      buckets.set(job.categoryId, bucket);
    }

    const result = new Map<string, number>();
    for (const entries of buckets.values()) {
      if (entries.length < config.pay.minComparisonSamples) continue;
      const sorted = [...entries].sort((a, b) => (a.hourly - b.hourly) || (a.jobId < b.jobId ? -1 : a.jobId > b.jobId ? 1 : 0));
      sorted.forEach((entry, index) => {
        result.set(entry.jobId, index / (sorted.length - 1));
      });
    }
    return result;
  }

  // ---- Per-candidate scoring -------------------------------------------------

  private scoreOne(
    candidate: RetrievalCandidate,
    job: ScoreJob,
    ctx: {
      nowMs: number;
      userLocation: { latitude: number; longitude: number } | null;
      preferences: ScoringPreferences | null;
      employerQuality: number | null;
      jobQuality: { observed: number; nEvents: number } | null;
      behavioralAvailable: boolean;
      weights: BaseRelevanceWeights;
      payPercentile: number | null;
      affinity: BehavioralAffinity | null;
    },
  ): ScoredCandidate {
    const config = rankingConfig;

    // Location
    const distanceKm = ctx.userLocation && job.latitude != null && job.longitude != null
      ? haversineKm(ctx.userLocation, { latitude: job.latitude, longitude: job.longitude })
      : null;
    const location = locationScore(distanceKm, config.location.referenceDistanceKm, config.missingData.locationScore);

    // Pay (hourly-equivalent percentile within the pool's category subset)
    const pay = ctx.payPercentile != null ? ctx.payPercentile : config.missingData.payScore;

    // Schedule (day + time compatibility)
    const schedule = this.scheduleScore(job, ctx.preferences);

    // Category preference
    const categoryPreference = categoryScore(job, ctx.preferences, ctx.affinity, config);

    // Job type — signals are computed once and reused for the Phase 5 features
    const jobTypeSignalsSet = jobTypeSignals(job, config.jobType.partTimeMaxShiftHours, config.jobType.fullTimeMinShiftHours);
    const jobType = jobTypeScore(job, ctx.preferences, config, jobTypeSignalsSet);

    // Behavioral affinity (user × feature)
    let behavioralAffinity = 0;
    if (ctx.behavioralAvailable && ctx.affinity) {
      const catAffinity = job.categoryId ? (ctx.affinity.category.get(job.categoryId) ?? 0) : 0;
      const employerAffinity = ctx.affinity.employer.get(candidate.employerId) ?? 0;
      behavioralAffinity = clamp01(
        config.behavioral.featureWeights.category * catAffinity + config.behavioral.featureWeights.employer * employerAffinity,
      );
    }

    const components: RelevanceComponents = { location, pay, schedule, categoryPreference, jobType, behavioralAffinity };
    const relevance = baseRelevance(components, ctx.weights);

    // Quality
    const employerQ = ctx.employerQuality ?? config.quality.neutralPrior;
    const observed = ctx.jobQuality ? ctx.jobQuality.observed : config.quality.neutralPrior;
    const nEvents = ctx.jobQuality ? ctx.jobQuality.nEvents : 0;
    const effective = jobQualityEffective(nEvents, observed, employerQ, config.quality.shrinkageK);
    const combined = combinedQuality(employerQ, effective, config.quality.employerWeight, config.quality.jobWeight);
    const multiplier = qualityMultiplier(combined, config.quality.qualityMultiplierFloor, config.quality.qualityMultiplierScale);

    // Freshness + urgency
    const hoursSincePosted = job.createdAtMs != null ? (ctx.nowMs - job.createdAtMs) / 3_600_000 : null;
    const freshness = freshnessDecay(hoursSincePosted, config.freshness.decayTauHours);
    const urgency = urgencyBoost(startDateTimeHoursUntilStart(job, ctx.nowMs), config.urgency.windowHours, config.urgency.maxBoost);

    const organicScore = relevance * multiplier * freshness * urgency;

    const snapshot: RankingSnapshot = {
      rankingVersion: config.version,
      baseRelevance: relevance,
      locationScore: location,
      payScore: pay,
      scheduleScore: schedule,
      categoryPreferenceScore: categoryPreference,
      jobTypeScore: jobType,
      behavioralAffinity,
      employerQuality: employerQ,
      jobObservedQuality: observed,
      jobQualityEffective: effective,
      combinedQuality: combined,
      qualityMultiplier: multiplier,
      freshnessDecay: freshness,
      urgencyBoost: urgency,
      organicScore,
      distanceKm: distanceKm != null ? Math.max(0, distanceKm) : null,
      sponsored: false,
      exploration: false,
      coldStart: !ctx.behavioralAvailable,
    };

    return {
      jobId: candidate.jobId,
      employerId: candidate.employerId,
      components,
      baseRelevance: relevance,
      quality: { employerQuality: employerQ, jobObservedQuality: observed, jobQualityEffective: effective, combinedQuality: combined, qualityMultiplier: multiplier, jobEventCount: nEvents },
      freshnessDecay: freshness,
      urgencyBoost: urgency,
      organicScore,
      rankingVersion: config.version,
      distanceKm: snapshot.distanceKm,
      rankingSnapshot: snapshot,
      features: {
        categoryId: job.categoryId ?? null,
        jobTypes: [...jobTypeSignalsSet].sort(),
      },
      metadata: {
        coldStart: !ctx.behavioralAvailable,
        sources: candidate.sources,
        trendingVelocity: candidate.trendingVelocity,
      },
    };
  }

  private scheduleScore(job: ScoreJob, preferences: ScoringPreferences | null): number {
    const neutral = rankingConfig.missingData.scheduleScore;
    const days = preferences?.availabilityDays?.length ? preferences.availabilityDays : null;
    const time = preferences?.availabilityTime?.trim() ? preferences.availabilityTime : null;
    if (!days && !time) return neutral;

    const dayPart = days ? scoreDay(job, days) : null;
    const timePart = time && time !== "Flexible" ? scoreTimeOfDay(job, time) : null;
    const parts = [dayPart, timePart].filter((part): part is number => part != null);
    if (!parts.length) return neutral;
    return parts.reduce((sum, part) => sum + part, 0) / parts.length;
  }
}

// ---------------------------------------------------------------------------
// Module-scoped helpers
// ---------------------------------------------------------------------------

function toArrayParam(ids: readonly string[]): string {
  return `{${ids.join(",")}}`;
}

function accumulate(map: Map<string, number>, key: string, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

function normalizeMap(raw: Map<string, number>): Map<string, number> {
  let max = 0;
  for (const value of raw.values()) if (value > max) max = value;
  if (max <= 0) return new Map();
  const normalized = new Map<string, number>();
  for (const [key, value] of raw) normalized.set(key, value / max);
  return normalized;
}

function combineQualityColumns(
  columns: { name: string; value: number | null; weight: number }[],
  neutralPrior: number,
): number {
  const present = columns.filter((column) => column.value != null && Number.isFinite(column.weight) && column.weight >= 0);
  if (!present.length) return clamp01(neutralPrior);
  const totalWeight = present.reduce((sum, column) => sum + column.weight, 0);
  if (!(totalWeight > 0)) return clamp01(neutralPrior);
  const combined = present.reduce((sum, column) => sum + column.weight * (column.value as number), 0) / totalWeight;
  return clamp01(combined);
}

function categoryScore(job: ScoreJob, preferences: ScoringPreferences | null, affinity: BehavioralAffinity | null, config: typeof rankingConfig): number {
  const explicit = preferences?.categoryIds?.length ? preferences.categoryIds : null;
  const catAffinity = job.categoryId ? (affinity?.category.get(job.categoryId) ?? null) : null;

  if (explicit) {
    if (job.categoryId != null && explicit.includes(job.categoryId)) return 1;
    if (catAffinity != null) {
      const blend = config.categoryPreference.behavioralBlend;
      return clamp01((1 - blend) * config.categoryPreference.explicitMismatch + blend * catAffinity);
    }
    return config.categoryPreference.explicitMismatch;
  }
  if (catAffinity != null) return clamp01(catAffinity);
  return config.missingData.categoryScore;
}

function jobTypeScore(job: ScoreJob, preferences: ScoringPreferences | null, config: typeof rankingConfig, signals?: ReadonlySet<string>): number {
  const preferred = preferences?.jobTypes?.length ? preferences.jobTypes.map((value) => value.toLowerCase()) : null;
  if (!preferred) return config.missingData.jobTypeScore;

  const jobSignals = signals ?? jobTypeSignals(job, config.jobType.partTimeMaxShiftHours, config.jobType.fullTimeMinShiftHours);
  const evaluable = preferred.filter((type) => (INFERABLE_JOB_TYPES as readonly string[]).includes(type));
  // 'Internship' and 'Temporary' have no observable schema signal; their absence
  // is unknown (not a mismatch), so they never count against a job.
  if (!evaluable.length) return config.missingData.jobTypeScore;

  const matched = evaluable.filter((type) => jobSignals.has(type)).length;
  return clamp01(matched / evaluable.length);
}

function scoreDay(job: ScoreJob, days: readonly string[]): number | null {
  const date = parseLocalDateMs(job.startDate);
  if (date == null) return null;
  const weekday = WEEKDAYS[new Date(date).getUTCDay()];
  return days.includes(weekday) ? 1 : 0;
}

function scoreTimeOfDay(job: ScoreJob, time: string): number | null {
  const bucket = timeBucket(parseHoursMin(job.startTime));
  if (bucket == null) return null;
  return timeBuckets[bucket.toLowerCase()] === time ? 1 : 0;
}

function startDateTimeHoursUntilStart(job: ScoreJob, nowMs: number): number | null {
  const start = startDateTimeMs(job);
  if (start == null) return null;
  return (start - nowMs) / 3_600_000;
}