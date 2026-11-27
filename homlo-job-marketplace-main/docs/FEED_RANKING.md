# Feed ranking: Recommended and Popular

How Homlo orders the **Recommended** and **Popular** feeds (`GET /feed/recommended`,
`GET /feed/popular`) and the Home sections built from them (`GET /feed/home` → `recommended`,
`popular`). The response shapes did not change: `{ items: [{ jobId, score, distanceKm, fitPercent,
isBoosted?, isSponsoredSlot?, boost?, boostPackage?, boostMultiplier? }], nextCursor, status }`.

Every number below lives in `backend/feed/marmot_tuning_knobs.ts` (feed config, `version: 2`) or
`BOOST_RANKING` in `server/hlBoostRanking.ts` (boost rules).

| Piece | Code |
| --- | --- |
| Organic score `S` | `popularityScore` in `backend/feed/walrus_scoring_engine.ts` |
| Location term `L` | `locationFactor` (same file) |
| Event decay (TS reference of the SQL) | `eventContribution` (same file) |
| Cold-start check | `isNewcomer` (same file) |
| Full pipeline | `rankPopularityFeed` in `backend/feed/kestrel_ranking_pipeline.ts` |
| Boost multiplier, cap, slots, gate | `server/hlBoostRanking.ts` |
| Aggregation SQL | `refresh_job_stats` (migration `058_feed_ranking_signals.sql`) |
| Tests | `tests/feed-ranking.test.ts`, `backend/feed/pangolin_proof_tests.ts`, `tests/plan-boost.test.ts` |

## 1. Signals

The app records anonymous events per job (`lib/event-recorder.ts` → `POST /events`, stored in
`job_events_anon`): `impression` (card was on screen), `view` (job page opened), `dwell_15s` (15 s
on the job page: time spent), `save`, `apply`. Each `(job, session, type)` counts at most once per
UTC day (anti-spam).

Weights `w`: view 1, dwell_15s 2, save 4, apply 8. Impressions are the denominator, not a reward.

For each window `p` (today 1 d, week 7 d, month 30 d) the refresh job stores, per job:

```
E_p = Σ over non-impression events younger than the window   w(type) · 0.5^(age / h_p)
I_p = Σ over impressions younger than the window              0.5^(age / h_p)
```

Half-lives `h_p`: today 0.5 d, week 3 d, month 10 d. **Recent activity counts more**: an apply
from yesterday counts 8 · 0.5^(1/10) ≈ 7.5 in the month window; one from 25 days ago counts ≈ 1.4.

Recommended ranks on the **month** window, Popular on the chosen chip (home uses **week**).

## 2. Equation

```
final(j) = S(j) · B(j)
S(j)     = R · C · Q · F · L
```

| Term | Formula | Default | Range |
| --- | --- | --- | --- |
| R, engagement rate | `(E + m·g) / (I + m)` | m = 60 | ≥ 0 |
| g, app-wide rate | `E_global / I_global`, or 0.08 until the window has 200 impressions | | |
| C, confidence | `1 − κ + κ · I / (I + 50)` | κ = 0.25 | 0.75 … 1 |
| Q, employer quality | `0.85 + 0.25 · quality`, unknown = 1 | | 0.85 … 1.1 |
| F, freshness | `0.8 + 0.2 · 0.5^(ageDays / 14)` | | 0.8 … 1 |
| L, location | see §4 | | 0.25 … 1.2 |
| B, boost | see §3 | | 1 … 1.15 |

R is Bayesian smoothing: a job with no exposure gets the app average `g` instead of 0 or a wild
number, and moves toward its real rate as impressions arrive. C keeps a lucky 3-impression job from
beating a proven one. Ties break on newer `created_at`, then id, so the order is deterministic and
pagination (cursor carries `asOf` and `offset`) stays stable.

## 3. Boost term

```
B(j) = clamp(packageMultiplier, 1, 1.15)   if startsAt ≤ now < endsAt and status = 'active'
                                            and employerQuality is unknown or ≥ 0.35
B(j) = 1                                    otherwise
```

Package multipliers (`server/hlPlanRules.ts`): starter 1.04, local 1.06, standard 1.08, urgent 1.10,
strong 1.12, maximum 1.15. Even an explicit `boosts.rank_multiplier` is clamped to 1.15.

- **Bounded:** at most +15 % on the score, smaller than the location bonus, so a boost reorders
  close competitors but cannot lift a weak job over a clearly better one organically.
- **Runs out:** the window is half-open. At `endsAt` the job goes back to `B = 1`; the 30 s server
  feed cache is the longest it can linger.
- **Slots** (per page of 10 in the full list): ranks 2 and 6 are *sponsored* slots. Each takes the
  best active boosted job not already placed, and the item gets `isSponsoredSlot: true`.
- **Never take over:** at most **2 boosted jobs per page of 10** in total, whether they landed in a
  sponsored slot or ranked there organically. Extra boosted jobs move to later pages (only
  at the very end of a list, when no organic jobs are left, can leftover boosted jobs share a page).
- **Relevance gate:** a boosted job only takes a sponsored rank if its organic score `S` is at least
  **0.5 ×** the organic score of the job it would push down. A job more than 2× as relevant is never
  buried by a placement; if no boosted job qualifies, the slot stays organic.

## 4. Location term

```
L(d) = regionFactor(d) · (1 + 0.2 / (1 + d / 10 km))      when distance d is known
L    = 1                                                   when it is not
regionFactor(d) = 1 for d ≤ 60 km, then linear down to 0.25 at 120 km and beyond
```

`d` is the straight-line distance between the viewer and the job (PostGIS, `feed_eligible_jobs.location`).
It is unknown when the viewer sent no `lat`/`lng`, the job is remote, or the job has no coordinates.
Closer jobs get up to +20 % (0 km → 1.2, 10 km → 1.1, 30 km → 1.05); far on-site jobs are damped,
never removed. Without a viewer location every job has `L = 1`, so the term drops out and the order is
exactly the location-free order. The server cache rounds coordinates to ~100 m.

## 5. Cold start

New jobs start at the app-average rate (smoothing) rather than zero, and freshness favours them. On
top of that, every **5th slot** (5, 10, 15, …) is given to the best-scoring *newcomer* not already
placed higher: a job younger than **7 days** with fewer than **20** decayed impressions in the
ranking window. If a newcomer already ranks above that slot, nothing moves; if there are no
newcomers, the slot is organic. This guarantees new postings get impressions, which then feed `R`.

## 6. Pipeline

1. Load eligible candidates (`feed_eligible_jobs` + `job_stats`, up to 5000) and their active boosts
   in one query each.
2. Score `final = S · B`; sort.
3. Interleave newcomers every 5th slot.
4. Cap at 300 items; variety rule (≤ 2 in a row from one employer, ≤ 3 from one category).
5. Boost placement (sponsored ranks, per-page cap, relevance gate), keeping the order of everything else.
6. Page. Home: Recommended takes 10, Popular takes the next 10 *excluding* jobs already shown.

Near and Explore keep their own ordering (proximity / exploration mix); boosts there only get the
sponsored ranks and the per-page cap.

## 7. Data and indexes

- `job_events_anon (job_id, event_type)` and new `job_events_anon (created_at)` for the refresh window scan.
- New partial index `boosts (job_id, expires_at) where status = 'active'` for the active-boost lookup.
- `job_stats` primary key on `job_id` (joined per candidate).
- Migration 058 makes `refresh_job_stats` read both `job_events` and `job_events_anon`; before it,
  events from the app were stored but never aggregated. **The refresh must be scheduled** (every
  10 min) using `refreshJobStatsSql()` so SQL and TypeScript share the same weights and half-lives.
