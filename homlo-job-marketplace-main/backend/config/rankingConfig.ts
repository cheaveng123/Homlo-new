// =========================================================
// Ranking configuration — V1 starting values.
//
// These are V1 starting values, NOT derived or permanent constants.
// They are meant to be tuned and versioned over time. Every future
// ranking service MUST read from this file rather than hardcoding any
// of these numbers — do not scatter these values as literals in
// ranking/scoring/retrieval/diversity code.
// =========================================================

export const rankingConfig = {
  version: "v1.0.0",

  baseRelevanceWeights: {
    location: 0.3,
    pay: 0.2,
    schedule: 0.15,
    categoryPreference: 0.15,
    jobType: 0.1,
    behavioralAffinity: 0.1,
  },

  quality: {
    employerWeight: 0.75, // in CombinedQuality
    jobWeight: 0.25, // in CombinedQuality
    shrinkageK: 50, // w_job = n / (n + k)
    qualityMultiplierFloor: 0.5, // QualityMultiplier = 0.5 + 0.5 * CombinedQuality
    qualityMultiplierScale: 0.5,
    sponsoredQualityFloor: 0.5, // Q_min — CombinedQuality domain, not QualityMultiplier

    // Missing-quality neutral/trust-safe prior. New/missing employers and jobs
    // must NOT be treated as zero-quality, so absent rows score this prior
    // (mid-point uncertainty). Used by the scorer AND as the n=0 prior of the
    // Wilson utility.
    neutralPrior: 0.5,

    // How the single EmployerQuality value is formed from the wilson-lower-bound
    // columns of employer_quality_stats. Weights are renormalized to the columns
    // actually present on a row (Phase 6 has not populated these yet).
    employerComponents: {
      completion: 0.5,
      positiveReview: 0.3,
      response: 0.2,
    },

    // How JobObservedQuality is formed from job_quality_stats wilson columns.
    jobComponents: {
      ctr: 0.5,
      applyRate: 0.5,
    },

    wilsonZ: 1.96, // standard 95% confidence for the Wilson lower bound
  },

  // Phase 8 scheduled quality aggregation (backend/ranking/quality-aggregation*).
  // Constants for the AGGREGATION JOB only. Every quality FORMULA stays in
  // phase 4 (jobQualityEffective / combinedQuality / qualityMultiplier) — this
  // job only precomputes the Wilson lower-bound + counter columns the scorer
  // consumes, so the aggregation never re-implements ranking math. Evolution of
  // the aggregation (not of the ranking version) is tracked by its own version.
  qualityAggregation: {
    version: "v1.0.0",
    // pg_try_advisory_xact_lock key so concurrent scheduled runs collapse to a
    // single writer (the simplest safe concurrency guard; a second concurrent
    // run is skipped). No distributed locks, no long transactions.
    advisoryLockKey: 794001,
    // Reviews with rating >= this threshold count as "positive" for the
    // employer positive-review component. Previously hardcoded (rating >= 4);
    // extracted to config so the aggregation SQL is fully parameterized.
    positiveReviewMinRating: 4,
  },

  freshness: {
    decayTauHours: 60, // FreshnessDecay = exp(-hours_since_posted / tau)
  },

  urgency: {
    windowHours: 48,
    maxBoost: 1.5, // UrgencyBoost cap
  },

  location: {
    referenceDistanceKm: 3.0, // d0 — starting value, will vary by density later
    hardMaxCommuteKm: 25, // hard eligibility cutoff, separate from scoring
  },

  sponsored: {
    minMultiplier: 1.0,
    maxMultiplier: 1.15,
  },

  diversity: {
    maxConsecutiveSameEmployer: 3,
    maxCategoryShare: 0.4, // per page

    // Phase 5 MMR (backend/ranking/mmr.ts). Soft diversity, not hard blocking:
    //   score = λ·relevance − (1−λ)·redundancy
    // where redundancy is the max similarity to the already-selected candidates.
    mmrLambda: 0.8,

    // MMR similarity dimensions, sourced from data already on ScoredCandidate.
    // Weights are renormalized per candidate pair over the dimensions actually
    // evaluable (e.g. missing category or an empty inferred job-type list on
    // either side makes that dimension unknown, not a mismatch). Sum = 1 as
    // written; pay/schedule are deliberately absent — their neutral fallbacks
    // are indistinguishable from real mid/perfect values and would fabricate
    // redundancy.
    similarityWeights: {
      category: 0.35,
      jobType: 0.2,
      employer: 0.25,
      location: 0.2,
    },
  },

  exploration: {
    targetShare: 0.125, // ~10-15%, midpoint as default

    // Phase 6 gate: a candidate is only surfaced with the exploration flag when
    // its post-MMR score (mmr.score, or organic score when MMR is absent) is at
    // or above this floor. Exploration must stay conservative — exploratory
    // exposure must not pull in candidates that rank below neutral relevance,
    // and it must never bypass the phase 4 quality safeguards (the phase 4
    // quality multiplier is already embedded in organicScore, which feeds the
    // post-MMR score here).
    relevanceFloor: 0,
  },

  behavioralDecay: {
    halfLifeDays: 30,
  },

  // Behavioral affinity for the BehavioralAffinity BaseRelevance component.
  // Behavior is user × feature (category, employer), never user × individual
  // job. Decay half-life is behavioralDecay.halfLifeDays above.
  behavioral: {
    // Reliability gate: the cold-start redistribution applies until the user's
    // interaction history has at least this many *engagement* events inside the
    // lookback window (impressions and reports are excluded: impressions are
    // near-neutral exposure, reports are a trust/moderation signal). Below this
    // evidence the normalized affinity signal is dominated by a few random
    // events, so the behavioral weight is redistributed instead of used.
    minEvidenceEvents: 5,
    lookbackDays: 365,

    // Dwell time that promotes a 'view' event to a "meaningful detail
    // engagement" (medium positive) instead of a near-neutral short view.
    viewMeaningfulDwellMs: 30_000,

    // Event strength hierarchy (section 12). report = 0 deliberately: reports
    // belong to trust/moderation and must not become an ordinary negative.
    eventWeights: {
      impression: 0.1, // near-neutral
      click: 0.75, // weak positive
      share: 0.75, // weak positive — explicitly not a large weight
      save: 3.0, // strong positive
      unsave: -0.75, // weak negative — retracts a save
      view: 2.0, // medium positive (only when dwell >= viewMeaningfulDwellMs)
      shortView: 0.5, // near-neutral short view
      apply_started: 2.0, // medium positive
      apply_submitted: 3.0, // strong positive
      apply_withdrawn: -0.5, // weak negative — retracts an application
      hide: -2.0, // strong negative
      not_interested: -2.0, // strong negative
      report: 0, // NOT a behavioral preference
    },

    // How the candidate's per-feature affinity scores combine (sum = 1.0).
    featureWeights: {
      category: 0.6,
      employer: 0.4,
    },
  },

  // Phase 7 final feed (backend/ranking/feed-assembly.ts + recommendation-feed.ts).
  // Cursor-based pagination operating over the bounded phase 6 pool; page size
  // is centralized here and NOT scattered as literals in server/router code.
  feed: {
    pageSizeDefault: 20, // what a client gets when it does not ask for a page size
    pageSizeMax: 50, // hard ceiling; larger requests are rejected by the API schema
  },

  // Pay component: normalize to an hourly-equivalent and compare within the
  // candidate pool's own category subset (bounded pool ≈ 200–300, no full-DB
  // pass). V1 approximation — geography influence on pay is not modeled; the
  // location component carries that signal.
  pay: {
    assumedHoursPerDay: 8, // daily → hourly when the job exposes no shift hours
    minComparisonSamples: 3, // fewer comparable jobs in a category ⇒ neutral pay
  },

  // JobType component: the jobs schema has no employment-type/arrangement
  // column, so the job's type is inferred from available deterministic fields.
  jobType: {
    partTimeMaxShiftHours: 5, // shift < this ⇒ "Part-time" signal
    fullTimeMinShiftHours: 8, // shift >= this ⇒ "Full-time" signal
  },

  // CategoryPreference component behavior.
  categoryPreference: {
    explicitMismatch: 0.2, // explicitly excluded category but no counter-evidence
    neutral: 0.5, // no stated preference and no behavioral affinity
    behavioralBlend: 0.5, // weight of category affinity when blending with explicit prefs
  },

  // Neutral/missing-data fallbacks for individual relevance components. These
  // represent uncertainty, not certainty: unknown ≠ zero and ≠ perfect.
  missingData: {
    locationScore: 0.5, // distance unmeasurable (no user location or no job coords)
    payScore: 0.5, // pay or comparable sample unavailable
    scheduleScore: 1.0, // schedule unverifiable ⇒ nothing is known to conflict
    jobTypeScore: 1.0, // job type not determinable or no preference stated
    categoryScore: 0.5, // no category preference and no behavioral affinity
  },

  retrieval: {
    candidatePoolMax: 300,
    candidatePoolMin: 200,

    // ---- Candidate retrieval (phase 3) --------------------------------------
    // Per-source tuning. Eligibility (status/deadline/fullness/fraud/blocking/
    // distance) is enforced separately by the shared eligibility filter and is
    // NOT duplicated here.

    // Source 1 — primary geo radius. Sources never exceed the hard commute cap
    // (location.hardMaxCommuteKm), which the eligibility filter always applies.
    geoRadiusKm: 12,
    // Source 3 — safety-net radius; effective radius = min(this, hardMaxCommuteKm).
    generalRadiusKm: 50,

    // Source 4 — trending proxy: recent engagement in the last N hours per job,
    // normalized by that job's lifetime engagement. Requires a minimum number of
    // recent events so noise doesn't dominate. Replaced when the scheduled
    // job_quality_stats aggregation exists.
    trendingWindowHours: 24,
    trendingMinRecentEvents: 3,

    // Source 5 — controlled exploration: jobs posted more recently than this,
    // or from employers with fewer than explorationMinEmployerJobs active
    // listings. Ordered newest-first, then newest-employer-first.
    explorationRecencyHours: 72,
    explorationMinEmployerJobs: 3,

    // How many candidates each source may contribute before the proportional
    // per-source cap (candidatePoolMax / active sources) is applied at merge time.
    sourceCaps: {
      geo: 150,
      preferences: 120,
      general: 120,
      trending: 60,
      exploration: 60,
    },
  },
} as const;

export type RankingConfig = typeof rankingConfig;
