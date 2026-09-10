# Homlo Ranking Pipeline

Deterministic, server-side job ranking: candidate pooling (phase 3) → scoring
(phase 4) → MMR diversity (phase 5) → sponsored boost + controlled exploration
(phase 6) → final feed assembly + pagination (phase 7). Every tunable is loaded
from `backend/config/rankingConfig.ts` — never hardcode ranking numbers in
pipeline code.

## Pipeline stages

| Phase | Service | Responsibility |
| ----- | ------- | -------------- |
| 3 | `backend/ranking/candidate-retrieval.ts` | Bounded, eligible, unbiased candidate pool from 5 sources (geo, preferences, general, trending, exploration). Does not rank. |
| 4 | `backend/ranking/scoring-service.ts` | Deterministic component-level scores + `OrganicScore` for every candidate. Consumes phase 3 output. |
| 5 | `backend/ranking/mmr.ts` | MMR re-ranking: soft diversity over `ScoredCandidate[]`. Sponsored boost, exploration injection and final feed assembly happen outside this module. |
| 6 | `backend/ranking/sponsored-exploration.ts` | Sponsored boost (bounded, quality-scaled) + controlled exploration selection over the phase 5 pool. One batched `boosts` query. Emits the final deterministic ordered list for phase 7. |
| 6 | `backend/ranking/sponsored-exploration.ts` | Sponsored boost (bounded, quality-scaled) + controlled exploration selection over the phase 5 pool. One batched `boosts` query. Emits the final deterministic ordered list for phase 7. |
| 7 | `backend/ranking/feed-assembly.ts` + `backend/ranking/recommendation-feed.ts` | Final typed feed contract: 1-based positions, cursor pagination over the bounded phase 6 pool, batched display load, orchestration of phases 3→7. |
| 8 | `backend/ranking/quality-aggregation.ts` + `backend/ranking/quality-aggregation-service.ts` | Scheduled, idempotent recomputation of `employer_quality_stats` / `job_quality_stats` from real job events/applications/reviews/reports/messages/jobs. Read-only for scoring. |

## Final feed assembly + recommendations (phase 7)

`RecommendationFeedService.getFeed` (`backend/ranking/recommendation-feed.ts`)
is the canonical, only entry point for the personalized feed. It runs
`retrieveCandidates → scoreCandidates → rerankWithMMR → applySponsoredAndExploration
→ finalFeedAssembly` in one pass with one explicit `now` threaded through the
whole chain (Phase 3's trending/exploration windows accept `RetrievalInput.now`,
so a single instant drives determinism from pooling to pagination). `now` is
never accepted from the client — the API pins it to the request time.

### Contract

- **Ordering**: the phase 6 order is canonical and final. The assembly NEVER
  re-sorts by creation date, distance, or pay; a page is a contiguous slice of
  the phase 6 list.
- **Positions**: 1-based `feedPosition`, incremented by exactly 1 over the
  final assembled pool, so `feed_position` in a phase 2 event always matches the
  position the client saw.
- **Dedupe**: job ids are deduplicated defensively (first occurrence kept), even
  though phase 6 already collapses duplicates.
- **Page size**: `rankingConfig.feed.pageSizeDefault` (20) / `pageSizeMax` (50);
  the API schema rejects out-of-range requests, and the assembly also sanitizes
  defensively. The pool is the bounded phase 3 result (candidatePoolMin/Max) —
  pagination slices the whole ranked pool; it never retrieves a page-sized
  candidate set.
- **Empty feed**: `{ jobs: [], nextCursor: null, hasMore: false }` with the
  current `rankingVersion`.

### Cursor

- Deterministic, stable `base64url(JSON { v: rankingVersion, s:
  finalRankingScore, j: jobId })`. `finalRankingScore + jobId` is the anchor,
  so equal scores can never resume at the wrong slot; `v` pins the cursor to the
  ranking version that produced it.
- Malformed cursors (bad base64/charset, invalid JSON, wrong shape, non-finite
  `s`) and ranking-version mismatches are rejected as `BAD_REQUEST`. A stale
  cursor — job no longer in the feed, or the same job now carrying a different
  score — is rejected too, so the client deterministically recovers by
  refetching page 1.

### Typed response

Each item exposes `{ job, feedPosition, rankingMetadata }` where `job` is the
display DTO (title, pay, location, category, employer name/photo) and
`rankingMetadata` mirrors the phase 6 `ranking_score_snapshot` fields
(`rankingVersion`, `baseRelevance`, `combinedQuality`, `organicScore`,
`distanceKm`, `coldStart`, `mmrScore`, `mmrSelectedRank`, `sponsored`,
`sponsoredEligible`, `sponsoredMultiplier`, `exploration`,
`finalRankingScore`). The feed response also returns `nextCursor`, `hasMore`,
`rankingVersion`, `total` (assembled pool size) and `poolSize` (raw phase 6
size).

### Identity, location & event logging

- The tRPC route is `homlo.recommendations.feed` on `supabaseProtectedProcedure`;
  the user id comes from `ctx.homloUser.id` (resolved session), never from the
  request body. An unauthenticated call is `UNAUTHORIZED` before any ranking
  runs.
- Worker location is derived server-side from the `profiles` row (the same
  source `profile.upsert` writes): missing, deleted, non-finite, or out-of-range
  coordinates degrade to `null` (unknown location) and the pipeline runs
  without geo/general sources — it never fabricates coordinates and never trusts
  the client's location.
- The server does NOT auto-log impressions; the client sends phase-2 events with
  the `feedPosition` and `rankingMetadata` this API returns, so `feed_position`
  always equals the final assembled position.

### Efficiency

Constant number of batched queries for any pool size, no N+1: ≤ 5 retrieval
source queries + 4 phase 4 loads (jobs, employer quality, job quality, events) +
1 phase 6 `boosts` query + 1 phase 7 display load over the whole bounded pool.
The assembly itself is pure and DB-free.

## Quality aggregation (phase 8)

`QualityAggregationService` (`backend/ranking/quality-aggregation-service.ts`) is
the ONLY writer of `employer_quality_stats` / `job_quality_stats`. It recomputes
a deterministic, **idempotent** snapshot (derived entirely from the append-only
evidence rows — never from the existing stats rows, so a re-run writes the same
bytes and can never double-count) and applies it atomically:

```
7 batched reads (no N+1) → pure compute (quality-aggregation.ts)
→ single transaction: pg_try_advisory_xact_lock → 2 batched unnest upserts
```

- **Concurrency**: one run holds `pg_try_advisory_xact_lock` inside the write
  transaction; a concurrent run fails fast (`ran: false` in the report) and is
  skipped. The read-only computation may run in parallel.
- **Time window**: CUMULATIVE lifetime evidence (`job_events` is append-only and
  never reset). Recency stays a phase 3 retrieval/trending concern; the
  aggregation never resets to zero.
- **User-level dedupe**: each job-level event reduces in SQL to
  `DISTINCT (identity_key, event_type)` where `identity_key =
  coalesce(user_id::text, session_id::text, ip_hash)` — one user firing the
  same event 20× to the same job counts once (a vote, not a multiplier).
- **Determinism**: an explicit `now` parameter replaces every internal clock
  (it is also `last_computed_at`); only `startedAt`/`finishedAt`/`durationMs`
  use the real clock.

### Job stats (written to `job_quality_stats`)

```
impressions, clicks, applies_started, applies_submitted, n_events
  = DISTINCT (identity_key, event_type) counts from job_events on live jobs
ctr_wilson_lb        = wilsonRate(clicks        / impressions)   ✔ null when impressions = 0
apply_rate_wilson_lb = wilsonRate(applies_submitted / impressions) ✔ null when impressions = 0
n_events             = DISTINCT non-impression signal rows (evidence for phase 4 shrinkage)
last_computed_at     = now
```

`wilsonRate` (`quality-aggregation.ts`) is the Wilson lower bound with success
counts clamped to `[0, trials]` (inconsistent input can never inflate the bound
toward 1.0) and `null` for a zero/negative trial base — missing ≠ bad. There is
NO `observed_quality` column: the two LB columns are the persisted job-quality
signal, and phase 4 recombines them with `rankingConfig.quality.jobComponents`
(ctr 0.5 / applyRate 0.5).

### Employer stats (written to `employer_quality_stats`)

```
n_jobs_posted     = non-deleted jobs
n_completions     = applications with status 'hired'   (the only completion the schema has)
n_reports         = non-dismissed reports (open/reviewed/actioned) on the employer's jobs or user
completion_rate_lb      = wilsonRate(n_completions          / n_applications)             ✔ null when no applications
positive_review_rate_lb = wilsonRate(rating>=4 reviews      / non-deleted reviews)        ✔ null when no reviews
response_rate_lb        = wilsonRate(employer responded     / worker-initiated j-convos)  ✔ null when no initiations
last_computed_at        = now
```

`verification_status` is **never written** (no verification flow exists in the
schema — documented limitation; new rows keep the column default `'unverified'`).
Phase 4 renormalizes the three configured components (completion 0.5 /
positiveReview 0.3 / response 0.2) over the columns that actually exist, so thin
evidence always leans on the neutral prior rather than being punished as zero.
`n_reports` is persisted for trust/moderation observability; it has no phase-4
component in V1. Negative/withdrawn job events (hide, not_interested,
apply_withdrawn, report) contribute evidence weight via `n_events` only — there
is no persisted negative-sentiment job column, so they do not directionally
alter the two LB columns.

### Running the aggregation

The service is NOT exposed over tRPC (admin procedures cannot authorize in this
server) — it runs as an internal command:

```
pnpm agg:quality              # scripts/run-quality-aggregation.ts (tsx)
```

requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` (already
loaded from `.env`). It exits non-zero if the run was skipped or failed.
**Scheduling on the Node host** (pg_cron runs SQL, not Node — the repo contains
no in-process cron): a host cron (e.g. Render background worker / GitHub Actions
schedule) invoking `pnpm agg:quality` on an interval (e.g. hourly). The advisory
lock makes overlapping runs safe. A production backfill = one manual run — the
snapshot is recomputed from full lifetime evidence, so prior gaps cost nothing.

### Report and observability

The run returns `QualityAggregationRunReport`: `ok`, `ran` (false on advisory
lock skip), `aggregationVersion` (from `rankingConfig.qualityAggregation`,
pinned to the pipeline version — needed if formulas change in a future phase),
`now`, `startedAt`, `finishedAt`, `durationMs`, `jobsProcessed`,
`employersProcessed`, `eventsConsidered` (deduped rows consumed),
`eventsExcluded` (raw minus deduped: duplicate identities + tombstoned rows),
`jobRowsWritten`, `employerRowsWritten`. The logger never prints IPs or event
payloads.

## Sponsored boost + controlled exploration (phase 6)

`applySponsoredAndExploration(candidates, activeBoosts, { now? })` consumes a
phase 5 pool and returns a NEW deterministic ordered list. It never mutates its
input; duplicated job ids collapse to the first occurrence; the input array and
its candidate objects are untouched. The `SponsoredExplorationService` variant
loads sponsorship from the real `boosts` table in exactly ONE batched query
(`where job_id = any($1::uuid[]) and status = 'active'` in the window
`start_at <= now < expires_at`) — no N+1, and an empty pool issues no query.

### Paid sponsorship

- A candidate is **sponsored** when its job has an active `boosts` row AND its
  `CombinedQuality` is at or above `quality.sponsoredQualityFloor`
  (non-finite/missing quality fails the floor; a boost below the floor is
  *registered* but grants no lift).
- Sponsorship can never resurrect an ineligible job: boosts are fetched only
  for job ids already inside the pool, and season/publish/score safeguards from
  phase 3 still gate the whole pool.
- The multiplier is a **bounded, quality-scaled lift** straight from config
  (`sponsored.minMultiplier`/`maxMultiplier` — no hardcoded 1.5/2.0):

```
floor      = quality.sponsoredQualityFloor
multiplier = min + (max − min) · clamp01((CombinedQuality − floor) / (1 − floor))
             when CombinedQuality >= floor, else 1
```

  CombinedQuality = floor ⇒ exactly `minMultiplier`; CombinedQuality = 1 ⇒
  exactly `maxMultiplier`. Never below `minMultiplier` when sponsorship is
  active, never above `maxMultiplier`.

```
postMMRScore       = rankingSnapshot.mmr.score, else OrganicScore (always finite)
finalRankingScore  = postMMRScore × multiplier   (= finalPreAssemblyScore)
```

  `OrganicScore` / `snapshot.organicScore` are NEVER overwritten.

### Controlled exploration

- Exploration candidates are phase 3 `metadata.sources` members carrying the
  `"exploration"` source whose post-MMR score is >= `exploration.relevanceFloor`
  (default 0 — exploratory exposure never surfaces below-neutral relevance, and
  phase 4's quality multiplier is already embedded in that score, so it cannot
  bypass quality safeguards).
- Soft target: `ceil(poolSize × exploration.targetShare)`; the count is
  `min(target, eligible)` — none are ever fabricated.
- Deterministic selection (no randomness): non-sponsored first when available
  (so a paid slot is not double-counted as an exploration pick), then highest
  post-MMR score, then MMR relevance, then organic, then original index, then
  job id.
- Exploration is selection/exposure ONLY — no synthetic score, no ranking
  matrix; `finalRankingScore` is unchanged for a flagged candidate.

### Snapshot representation

The phase 6 pass attaches to the served `ranking_score_snapshot`:

- `sponsored: boolean`, `exploration: boolean` (widened from the phase 4
  literal `false`),
- `sponsoredEligible: boolean` — an active boost exists (before the quality
  gate),
- `sponsoredMultiplier: number` (1 when not boosted),
- `finalPreAssemblyScore: number`.

The phase 6 candidate carries `sponsored`, `sponsoredMultiplier`,
`exploration` and `finalRankingScore`; the `mmr` block and every phase 4/5
field are preserved. Phase 2 event logging already accepts these snapshot
fields, so a served feed item logs them without per-candidate DB writes.

The layer returns the FINAL ordered list for phase 7 assembly: `finalRankingScore`
desc → post-MMR desc → MMR relevance (organic if absent) desc → organic desc →
original index asc → job id asc. Because the pre-boost key is the phase 5 MMR
selection score (non-increasing across the selection), the phase 5 order is
preserved exactly for non-sponsored candidates, and sponsorship only lifts an
eligible job within its bounded range.

## MMR diversity (phase 5)

`rerankWithMMR(candidates, { limit? })` re-orders a phase 4 pool greedily so
consecutive slots diversify without discarding relevance:

```
score(candidate) = λ·relevance − (1−λ)·redundancy
redundancy(candidate) = max similarity to the already-selected candidates
relevance(candidate)  = OrganicScore / pool max   (pool max ⇒ 1)
similarity            = weighted category / job-type / employer / location blend
```

- **Relevance normalization** is pool-max (not min/max): the top candidate is
  always 1 and relative order is preserved, while min/max would push the lowest
  candidate to 0 and defeat the λ trade-off. Non-finite/negative organic scores
  sanitize to 0 relevance; an all-zero or all-equal pool maps every relevance
  to 1 (those candidates then differ only by tie-breaks). Never NaN.
- **Similarity dimensions** all come from data already on `ScoredCandidate`
  (no DB access, no N+1): category (1/0), inferred job type (Jaccard over the
  phase-4 signals; an empty side is *unknown*, never a mismatch), employer
  (1/0 — strong but *soft*: similar candidates are de-prioritized, never
  hard-blocked), and geographic band `1/(1+(Δkm/d0)²)` with the same
  `location.referenceDistanceKm` as scoring. Weights are renormalized per pair
  over the evaluable dimensions. Pay/schedule are deliberately excluded: their
  neutral fallbacks are indistinguishable from real mid/perfect values and
  would fabricate redundancy.
- **Deterministic tie-breaks**: higher MMR score → higher relevance → higher
  raw organic score (non-finite ⇒ −∞) → lower original index → jobId ascending.
- **Hard edges**: `limit` is floored and clamped to `[0, length]`
  (0 ⇒ `[]`, missing/NaN ⇒ full pool); the selection is incremental, so a
  smaller limit equals the head of the full run.
- **No mutation**: input array and candidate objects are untouched; each
  selected candidate is copied with `mmr: { relevance, redundancy, score,
  selectedRank }` appended to its snapshot. `rankingVersion` is not bumped
  (the score itself is unchanged; MMR is post-processing).
- **Efficiency**: O(N²·K) with each unordered pair's similarity computed
  exactly once (a redundancy-vector update on every selection), fine for the
  200–300-pool.
- **Tuning**: `diversity.mmrLambda` (default 0.8) and
  `diversity.similarityWeights` (category 0.35 / jobType 0.2 / employer 0.25 /
  location 0.2) in `rankingConfig.ts`. The legacy `maxConsecutiveSameEmployer`
  / `maxCategoryShare` quota fields are NOT used here — MMR is soft by design.
- The phase-4 scorer emits the additive `features` field (categoryId +
  inferred jobTypes) that MMR reads; it does not change BaseRelevance or the
  phase-4 snapshot.

## Scoring (phase 4)

For every candidate:

```
BaseRelevance =
    wLoc·Location + wPay·Pay + wSch·Schedule
  + wCat·CategoryPreference + wJobType·JobType + wBeh·BehavioralAffinity

w_job              = n / (n + shrinkageK)                 (continuous shrinkage)
JobQualityEffective= w_job·JobObservedQuality + (1−w_job)·EmployerQuality
CombinedQuality    = 0.75·EmployerQuality + 0.25·JobQualityEffective
QualityMultiplier  = floor + scale·CombinedQuality        (penalty-only, ≤ 1)
FreshnessDecay     = exp(−max(0, hoursSincePosted) / tau)
UrgencyBoost       = 1 + (windowHours−hoursUntilStart)/windowHours·(maxBoost−1)
OrganicScore       = BaseRelevance · QualityMultiplier · FreshnessDecay · UrgencyBoost
```

Deterministic: scores use an injected `now`, UTC date parsing, and
value+jobId tie-breaks; no `Math.random()` from retrieval to scoring.

## Component definitions (phase 4)

- **Location** — `1 / (1 + (d/d0)²)`; `d0 = location.referenceDistanceKm`;
  distance via the backend-local `haversineKm` (mirrors `lib/job-geography`).
  Unknown distance ⇒ `missingData.locationScore`.
- **Pay** — hourly-equivalent (hourly / daily÷assumedHoursPerDay /
  fixed÷known shift hours), percentile **within the pool's own category
  subset** (`pay.minComparisonSamples` guard ⇒ neutral below that). Geography's
  effect on pay is intentionally not modeled (location carries it).
- **Schedule** — average of evaluable day-match + time-bucket match
  (Morning/Afternoon/Evening/Night). Nothing evaluable ⇒ neutral.
- **CategoryPreference** — explicit match = 1; explicit mismatch = 0.2, blended
  toward behavioral affinity for the job's own category; otherwise affinity or
  `missingData.categoryScore`.
- **JobType** — inferred deterministically from schema fields (Remote from
  location_text; Part-time/Full-time from shift hours; Weekend from start_date
  weekday). Internship/Temporary have no observable signal and are NEVER treated
  as a mismatch (absence ≠ conflict).
- **BehavioralAffinity** — user × feature (category 0.6 / employer 0.4),
  `save(3.0) > view(2.0) > click≃share(0.75) > shortView(0.5) > impression(0.1)`;
  `unsave(−0.75)`/`apply_withdrawn(−0.5)` retract, `hide`/`not_interested` (−2.0)
  are strong negatives, `report` is 0 (trust/moderation, not a preference).
  Each event decays `0.5^(ageDays/halfLifeDays)`.

### Cold start

The behavioral component is only used once the user has ≥
`behavioral.minEvidenceEvents` engagement events inside the lookback window
(impressions and reports are excluded from the count because they are
near-neutral/trust signals). Below that evidence, the behavioral weight is
redistributed proportionally across the other five components
(`effectiveBaseWeights`), keeping BaseRelevance normalized to 1.0.

### Quality fallbacks (Phase 8 aggregation populates the stats tables)

- Missing `employer_quality_stats` / `job_quality_stats` rows ⇒
  `quality.neutralPrior` (0.5) — trust-safe, never zero.
- Wilson lower-bound columns (`completion_rate_wilson_lb`, `ctr_wilson_lb`, …)
  are precomputed by the Phase 8 aggregation service using
  `backend/ranking/quality-aggregation.ts` → `backend/ranking/wilson.ts`
  (no trials ⇒ null ⇒ renormalized away in the scorer, never a punitive zero).
  The scorer only renormalizes present columns by their configured weights.
- A job's observed quality is blended toward its employer's quality via
  continuous shrinkage `n/(n+shrinkageK)`; with n=0 the employer dominates.

## Reusable utilities

- `backend/ranking/wilson.ts` — `wilsonLowerBound(successes, trials, options?)`.
  Single source of truth for the Wilson math; do not duplicate elsewhere.
- `backend/ranking/distance.ts` — `haversineKm(a, b)`; backend-local mirror of
  the client haversine (the server bundle does not use the `@/` alias).
- `backend/ranking/mmr.ts` — `rerankWithMMR` plus exported `mmrScore`,
  `normalizedRelevance`, `similarityBetween` for unit testing. Location
  similarity intentionally reuses the same `1/(1+(x/d0)²)` shape as scoring so
  a "same area" signal stays consistent with the location component.
- `backend/ranking/sponsored-exploration.ts` — `SponsoredExplorationService`
  (one batched `boosts` query) plus the pure `applySponsoredAndExploration`,
  `sponsoredMultiplierFor`, `postMMRScore` and `relevanceKey` for unit testing.
- `backend/ranking/feed-assembly.ts` — pure `finalFeedAssembly`, `sanitizePageSize`,
  cursor `encode`/`parse`/`validateFeedCursor` (`InvalidFeedCursorError`), and
  `toFeedMetadata` for unit testing.
- `backend/ranking/recommendation-feed.ts` — `RecommendationFeedService` running
  the canonical phase 3 → phase 7 pipeline plus the single batched display-row
  load.
- `backend/ranking/quality-aggregation.ts` — pure math only: `wilsonRate`,
  `computeJobQualityStats`, `computeEmployerQualityStats` (every aggregation
  formula is unit-testable without a database).
- `backend/ranking/quality-aggregation-service.ts` — `QualityAggregationService`
  (7 batched reads → advisory-lock transaction → 2 unnest upserts) and the
  `QualityAggregationRunReport` observability type.

## Passing data to the next phases / event logging

`RankingScoringService.scoreCandidates` returns `ScoredCandidate[]`; each
carries `rankingSnapshot` and `features` (categoryId + inferred job types).
`rerankWithMMR` consumes the array directly and appends an `mmr` block to each
selected candidate's snapshot. `SponsoredExplorationService.process` (or the
pure `applySponsoredAndExploration`) consumes that phase 5 array and returns
the final ordered `Phase6Candidate[]`. The snapshot is the exact payload the
phases attach to a served event's `ranking_score_snapshot` (`rankingVersion`,
all six components, quality split, multiplier, freshness, urgency, organic
score, optional `mmr`, `sponsored` (boolean), `exploration` (boolean),
`coldStart`, plus `sponsoredMultiplier`/`sponsoredEligible`/
`finalPreAssemblyScore` after phase 6). Phase 2 event logging already accepts
the `rankingScoreSnapshot`, so a served feed item logs the snapshot without any
per-candidate DB writes.

## Efficiency

Exactly 4 batched SQL queries per scoring pass regardless of pool size: jobs
(`where id = any($1::uuid[])`), employer quality, job quality, and the user's
event history. Pay percentiles are computed over the bounded pool only — no
full-database pass. Phase 6 adds exactly ONE batched `boosts` query for the
whole pool (zero when the pool is empty); phase 7 adds ONE batched display-row
load over the whole bounded pool (zero when the pool is empty); all downstream
math is pure and DB-free.

## Tests

- `tests/wilson.test.ts` — Wilson bounds, clamping, n=0 prior, monotonicity.
- `tests/scoring-service.test.ts` — pure scoring math plus in-memory
  `DatabaseAdapter` integration: cold start, quality shrinkage, pay subset
  percentiles, job-type inference, schedule, category blending, behavioral
  hierarchy/decay/evidence gate, determinism, snapshot contract, vanished-job
  handling, and the constant query-count guarantee.
- `tests/mmr.test.ts` — similarity math (category/job-type Jaccard/employer/
  location, unknown-dimension renormalization), pool-max relevance
  normalization, the [A, C, B] redundancy trade-off, soft same-employer
  penalty (never a block), limits, degenerate scores, determinism, no-mutation,
  snapshot preservation, stable ties, and a phase 4 → phase 5 handoff through
  the real scoring service.
- `tests/sponsored-exploration.test.ts` — `sponsoredMultiplierFor` bounds and
  interpolation vs the quality floor, sponsored pass/deny/expired/phantom/
  malformed boost rows, one-batched-query guarantee, exploration target-share
  selection (never more than exist, relevance-floor gate, deterministic and
  non-sponsored-first), sponsored × exploration interaction (both flags, no
  double count, no synthetic boost for exploration), ordering (phase 5 order
  preserved, bounded sponsored climb), dedupe, no-mutation, degenerate-score
  finite outputs, and a full phase 4 → phase 5 → phase 6 handoff.
- `tests/feed-assembly.test.ts` — page-size sanitization, cursor
  encode/decode round-trips, malformed/version-mismatch/stale/score-changed
  cursor rejection, empty-feed shape, dedupe, position 1..N enforcement, page
  slicing + `hasMore` + `nextCursor`, no re-ordering, determinism, no-mutation,
  and the display-missing skip.
- `tests/recommendation-feed.test.ts` — the full phase 3 → phase 7 integration
  through an in-memory `DatabaseAdapter`: empty feed, sponsored/exploration
  propagation, position+pagination continuity across pages (cursor resume, no
  cross-page duplicates, `hasMore` on the exact boundary), determinism with a
  fixed `now`, missing-location degradation, constant query counts (no N+1),
  and auth-wiring checks (the tRPC route is behind `supabaseProtectedProcedure`
  and the user id is session-derived).
- `tests/quality-aggregation.test.ts` — pure formulas (wilsonRate null/clamp/
  bounds, job LBs, employer LBs, no punitive zeros), shrinkage/combined/
  multiplier consumers, and service integration through an in-memory
  `DatabaseAdapter`: deterministic + idempotent snapshot, constant bounded query
  count, advisory-lock skip, empty-evidence no-write, no NaN from malformed
  counters, `verification_status` never written, and a Phase 4 compatibility
  pass (aggregation output → persisted columns → real `RankingScoringService`
  reproduces the exact `quality`/`rankingSnapshot` figures).

## Known gaps / deferred

- Client-side consumption of `homlo.recommendations.feed` (replacing the mock
  home-feed). Phase 8 has delivered the quality-aggregation service, CLI trigger
  (`pnpm agg:quality`) and host-cron scheduling instructions; ML/nonlinear
  ranking, calibration and an A/B framework remain deferred.
- Stats tables are empty until the phase 8 aggregation runs — the neutral priors
  carry scoring until then. Run `pnpm agg:quality` once to backfill from full
  lifetime evidence.
- `verification_status` is never derived (no verification flow in the schema);
  `n_reports` and negative job events carry no phase-4 score component in V1
  (trust/moderation observability only).
- `homlo_eligible_candidates` assumes job type Inferable as above; there is no
  employment-type column in the jobs schema.
- Boosts are consumed read-only (`status = 'active'` in-window rows); the
  `payments`/`payment_webhook_events` lifecycle that creates active boosts is
  unchanged and untested by the ranking suite.