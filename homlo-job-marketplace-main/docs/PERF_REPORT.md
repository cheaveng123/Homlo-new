# Performance hardening report (target: 1,000 concurrent users)

Date: 2026-11-20. Scope: Expo app → Express/tRPC server → Supabase Postgres.

**Measurement honesty.** No database (production or staging) was connected
during this work, so every timing, EXPLAIN plan and payload size below is
marked **could not measure**. Query counts ARE measured: by vitest tests that
count every statement sent to a fake database adapter
(`tests/query-budget-*.test.ts`). Sizes of files are measured on disk.

## 1. Before / after

| # | File | What changed | Metric | Before | After | How measured |
|---|---|---|---|---|---|---|
| 1 | `hooks/use-employer-applications.ts`, `components/MyListingsScreen.tsx`, `server/routers.ts` (`employer.allApplications`), `server/homlo-direct-service.ts` (`listAllEmployerApplicationsDirect`) | Employer dashboard loads every applicant in one query instead of one query per job | DB queries per dashboard load (34 jobs) | 35 | 2 | `query-budget-employer-applications.test.ts` |
| 2 | `server/homlo-direct-service.ts` (`withBoostsAndWorkTime`) | Boost flag + work-time lookups run in parallel instead of one after the other | Sequential DB round trips on a feed cache miss | 3 | 2 | code path; `query-budget-public-reads.test.ts` checks 3 queries total, same output |
| 3 | `server/homlo-direct-service.ts` (`employerProfileCache`) | Public employer profile cached 60 s per name; cleared by every listing/profile write | DB queries per job-detail view (employer profile) | 1 (full scan of `profiles`) | 0 on hit, 1 per name per minute | `query-budget-public-reads.test.ts` (incl. write invalidation) |
| 4 | `backend/database/migrations/060_perf_indexes.sql` (+ mirror `supabase/migrations/20261120200000_perf_indexes.sql`) | 3 indexes: open-jobs feed sort, `lower(full_name)`, trigram `full_name` | Rows scanned / plan | could not measure | could not measure | needs EXPLAIN on staging (commands in §3) |
| 5 | `lib/typography.ts` | Stop loading Space Grotesk + Manrope (zero references anywhere) at startup | Font files loaded before first paint | 20 files | 15 files (−464 KB) | file sizes on disk; reference count via grep |
| 6 | `assets/images/detailcategorypage.png` | Resized 1536×1024 → 576×384 (displayed in a 143 pt box; 576 px = 4× density) | File size | 1,588,592 B | 225,454 B (−86%) | `ls -l` |
| 7 | `backend/infrastructure/database/SupabaseAdapter.ts` | Slow-query log (≥ 200 ms, `SLOW_QUERY_MS` to change). SQL text only, never parameter values | — | none | logs `[db] slow query Nms rows=R: <sql>` | unit test |
| 8 | `server/_core/index.ts` | `GET /api/health/ready` — checks the database (2 s timeout), 503 when down. `/api/health` unchanged | — | liveness only | liveness + readiness | unit test of `checkDatabase` |
| 9 | `scripts/loadtest/k6-hot-endpoints.js` | k6 ramp 100 → 500 → 1,000 VUs over the 5 hot public paths | p95, error rate | not run | not run | see §5 |

Tests (round 2): `pnpm test` → 82 files passed, 1 skipped (817 tests passed, 12 skipped). `tsc --noEmit` → 0 errors. `pnpm check:migrations` passes.

## 2. Query budget per hot endpoint

| Endpoint | Queries before | Queries after | Bytes before | Bytes after |
|---|---|---|---|---|
| Employer dashboard (`employer.jobs` + applicants), 34 jobs | 35 | 2 | could not measure | could not measure (same rows) |
| `homlo.publicJobs` (cache miss) | 3 sequential | 3 (2 sequential steps) | could not measure (≤ 200 rows incl. description) | unchanged |
| `homlo.publicJobs` (cache hit) | 0 | 0 | — | — |
| `homlo.employerProfile` | 1 every call (seq scan) | 0 on hit / 1 per minute per name | — | unchanged |
| `homlo.homeFeed` | not changed | not changed | could not measure | — |
| `homlo.searchJobs` (miss) | 2 | 2 | could not measure | — |

## 3. Index plan proof

**Could not measure** — no database connection. Run on staging, before and after
applying `060_perf_indexes.sql`, and paste the plans here:

```sql
explain (analyze, buffers) select * from homlo_list_public_published_jobs();
-- the function body, so the planner shows the jobs scan:
explain (analyze, buffers)
select j.id from jobs j
where j.deleted_at is null and j.status = 'open'
  and (j.workers_needed = 0 or j.workers_hired < j.workers_needed)
  and (j.end_date is null or j.end_date >= current_date)
order by j.created_at desc limit 200;
-- expect: Index Scan using idx_jobs_open_created_at (no Sort node)

explain (analyze, buffers)
select full_name from profiles
where full_name is not null and (lower(full_name) = lower('Homlo Cafe') or full_name ilike 'Homlo Cafe%')
order by (lower(full_name) = lower('Homlo Cafe')) desc, (role in ('employer','both')) desc, length(full_name) asc
limit 1;
-- expect: BitmapOr over idx_profiles_full_name_lower + idx_profiles_full_name_trgm (no Seq Scan)
```

I am guessing the planner will use these indexes; on a tiny table it may still
choose a sequential scan (correctly — that is cheaper). Re-check once `jobs`
has a few thousand rows.

**Applying it:** `CREATE INDEX CONCURRENTLY` cannot run inside a transaction.
Run each statement on its own (see the file header). If `supabase db push`
fails with "cannot run inside a transaction block", that is why — apply the
three statements one by one in the SQL editor instead.

## 4. Lighthouse

Not run. This is a native app first; Lighthouse only applies to the Expo web
build. Mobile scores for the web build: **could not measure** here.

## 5. Load test

Not run (no staging host, and runs from one IP hit the API rate limiter).

```bash
k6 run -e BASE_URL=https://<staging-host> scripts/loadtest/k6-hot-endpoints.js
```

Read `http_req_duration{stage:100|500|1000}` p95 and `errors`. 429s are
counted separately as `rate_limited`; raise the staging limits in
`server/_core/apiRateLimit.ts` for the test window or run from several IPs.

## 6. Rollback plan (newest first)

| Change | How to undo | What breaks if undone |
|---|---|---|
| Indexes (060) | `drop index concurrently if exists ...` ×3 (in the file header) | Nothing functional; feed sort and employer lookup scan again |
| `/api/health/ready` | remove the route | Nothing; only a load balancer pointing at it |
| Slow-query log | remove `logIfSlow` call | Nothing |
| Image resize | `git checkout <prev> -- assets/images/detailcategorypage.png` | Nothing |
| Fonts | re-add the 5 imports in `lib/typography.ts` | Nothing |
| Employer profile cache | remove `employerProfileCache` | Nothing; one scan per job-detail view again |
| Parallel boosts/work time | restore nested `withWorkTime(await withActiveBoosts(...))` | Nothing |
| `allApplications` | point the two hooks back at `trpc.useQueries(... employer.applications ...)`; the old endpoint is untouched | Nothing; dashboard goes back to 1 + N |

## 7. Round 2 — open issues fixed (2026-11-20)

| # | Was | File(s) | Change | Metric | Before | After | How measured |
|---|---|---|---|---|---|---|---|
| 10 | Job detail downloaded the whole feed; jobs past 200 couldn't open | `server/homlo-direct-service.ts` (`getPublishedJob`), `server/routers.ts` (`homlo.publicJob`), `app/job/[id].tsx`, `app/_layout.tsx` | New single-job endpoint, same columns and visibility rules as the feed function. Detail page renders the cached feed copy instantly if there is one, then the single-job answer. Client invalidates it with `publicJobs` | Rows sent to open one job | up to 200 (with descriptions) | 1 | `perf-direct-reads.test.ts` |
| 11 | Signed-in reads went server → edge function → 3 Supabase hops | `server/homlo-direct-service.ts` (`read`), `server/routers.ts` | `profile.get`, `application.list`, `application.for-job`, `messaging.conversations`, `notifications.list`, `account.get` read Postgres directly via the same security-definer functions, JSON built by Postgres (`json_agg` / `row_to_json`, as PostgREST does). Inactive accounts, non-uuid ids and any direct failure fall back to the gateway, so errors are unchanged | Network hops to Supabase per read | 3 (+ edge cold start) | 1 (`account.get`: 2 in parallel) | `perf-direct-reads.test.ts` (gateway call count = 0) |
| 12 | Caches per instance; other instances stale up to ~5 min after a write | `server/_core/cache-bus.ts`, `server/_core/index.ts` | Postgres `NOTIFY homlo_cache_invalidate` after each listing write; every instance `LISTEN`s and clears its caches. Payload = random instance id only. Best effort: if LISTEN isn't available it logs once and behaves as before. `CACHE_BUS=off` disables | Staleness on other instances after a write | up to TTL + 5 min | ~network latency | unit test with a fake pub/sub; **live LISTEN through your pooler: could not measure** |
| 13 | No statement timeout | `backend/infrastructure/database/query-metrics.ts`, `SupabaseAdapter.ts` | Every adapter query is cancelled on the server (postgres.js `cancel()`) after `DB_QUERY_TIMEOUT_MS` (default 15 s). Chosen over a `statement_timeout` startup parameter, which the Supabase pooler may not pass through | Max time one query can hold a connection | unbounded | 15 s | unit test |
| 14 | No per-request query count / request id in logs | `server/_core/index.ts`, `query-metrics.ts` | One JSON log line per API request: `requestId, method, route, status, durationMs, queries, dbMs`. `x-request-id` echoed or generated. No query strings, bodies or user data. `REQUEST_LOG=off` silences it | — | — | — | `request-metrics.test.ts` |
| 15 | Radius search computed `acos()` for every open job | `061_search_radius_and_total.sql` (+ `supabase/migrations/20261120210000_…`) | Lat/lng bounding box in front of the distance check (always contains the circle, so same results) — can use `idx_jobs_location` | Rows given to `acos()` | every open job | jobs inside the box | **could not measure** (needs EXPLAIN) |
| 16 | `searchJobs.total` was the page size | same migration + `searchJobsUncached` | `count(*) over ()` → real match count; stripped from job rows; falls back to the old value until 061 is applied. No client code reads `total` today | `total` | page size | match count | `perf-direct-reads.test.ts` |
| 17 | No API compression | `server/_core/index.ts`, `package.json` (`compression@1.8.1`, already in the lockfile as a transitive dep), `types/compression.d.ts` | gzip above 1 KB when the client accepts it | Bytes over the wire | **could not measure** without data (JSON typically 4–6× smaller) | — | `request-metrics.test.ts` checks a gzip response decodes to the same JSON |
| 18 | Unused font packages in `package.json` | `package.json`, `pnpm-lock.yaml` | Removed `@expo-google-fonts/manrope` and `@expo-google-fonts/space-grotesk` (nothing imports them) | — | — | — | `pnpm-lock.yaml` has 0 references |
| 19 | Large PNGs | 13 referenced PNGs in `assets/images/` | Lossless re-deflate (pixel data verified byte-identical) | Total size | 3,182,901 B | 2,840,987 B (−11%) | `stat` |
| 20 | No CI guardrails | `.github/workflows/perf-guardrails.yml`, `scripts/check-migrations.mjs`, `scripts/check-bundle-size.mjs` | CI runs typecheck, tests (incl. query budgets), migration lint, bundle-size limit | Android JS bundle | — | 9,737 KB measured; limit 10,240 KB | `expo export` run locally on 2026-11-20 |

### How to apply round 2's migration

`061_search_radius_and_total.sql` is a normal transactional migration (drop + recreate the search function, grants restored). Apply it with your usual flow. The server works before and after it.

### Round 2 rollback

| Change | How to undo | What breaks if undone |
|---|---|---|
| 061 search | re-run section 8 of `046_job_capacity_and_visibility.sql` | Nothing; `total` falls back to page size, radius search scans again |
| Compression | remove `app.use(compression(...))` | Nothing; bigger responses |
| Query timeout | `DB_QUERY_TIMEOUT_MS=600000` (or revert `queryWith`) | Nothing |
| Request log | `REQUEST_LOG=off` | Nothing |
| Cache bus | `CACHE_BUS=off` | Multi-instance staleness returns |
| Direct reads | change `.read(ctx.supabaseAccessToken, ctx.homloUser, …)` back to `.invoke(ctx.supabaseAccessToken, …)` in `server/routers.ts` | Nothing; slower signed-in screens |
| `homlo.publicJob` | revert `app/job/[id].tsx` to `usePublishedJobs()` | Detail downloads the full list again; jobs past 200 can't open |

## 8. Open issues (still not fixed)

| Priority | Issue | Why not fixed |
|---|---|---|
| Med | `publicJobs` is still one 200-row list (with descriptions) shared by ~20 screens, filtered on the device; no pagination | Splitting list/detail shapes and adding cursors touches every consumer screen — a redesign of the data flow. Compression (#17) and the detail endpoint (#10) remove most of the cost meanwhile |
| Med | `homlo_list_conversations`, `homlo_list_employer_applications_detailed`, `employer.allApplications`: no row cap; `homlo_list_messages` default 500 | A cap silently drops rows the UI shows today = behaviour change. Needs paging in those screens first |
| Med | `homlo_list_employer_jobs_with_boosts`: per-job `count(distinct session_id)` over `job_events` | Needs a pre-aggregated view counter (new table/trigger) |
| Low | Employer page matches jobs by `employer_name` text on the device | Needs an employer id in the public job record (response shape change) |
| Low | Low-cardinality single-column indexes may be unused | Needs `pg_stat_user_indexes` from the live DB before dropping anything |
| Low | Two native map SDKs (`react-native-maps` + MapLibre) | Removing one needs a native rebuild and on-device testing of every map screen |
| Low | Haversine `acos()` can return NaN for a job at the exact search point (float rounding > 1), excluding it | Pre-existing; fixing changes results. One-line fix: `acos(least(1, …))` — say if you want it |
| Low | Lighthouse, load test, EXPLAIN plans not run | No staging access in this session — commands are in §3 and §5 |
