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

Tests: `pnpm test` → 80 files passed, 1 skipped (801 tests passed, 12 skipped). `tsc --noEmit` → 0 errors.

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

## 7. Open issues (found, not fixed)

| Priority | Issue | Why not fixed |
|---|---|---|
| High | Job detail (`app/job/[id].tsx:52`) loads the whole public feed (≤ 200 rows with descriptions) to show one job; jobs past the 200 cap can't be opened there | Needs a single-job endpoint and a rework of the detail page's data flow — larger behaviour risk than this pass allowed |
| High | ~20 screens share `publicJobs`: no pagination, full `description` in the list, client-side filtering (incl. employer page matching by `employer_name`) | Changing the list shape touches every consumer; needs list/detail DTO split + cursor pagination |
| High | Signed-in calls go server → edge function → 3 Supabase hops (`invoke()`) | Moving each action to a direct read is per-action work (the pattern exists: `listEmployerJobsDirect`) |
| High | In-process caches are per instance; a write clears only the instance that took it. With 2+ instances other instances serve stale data up to TTL + 5 min stale window | Needs shared invalidation (Redis pub/sub or Postgres LISTEN/NOTIFY). Fine while you run one instance |
| Med | No `statement_timeout` on the app's DB role/pool | DECISION NEEDED: set per-connection via postgres.js `connection: { statement_timeout }` (may not pass through the Supabase pooler — needs a staging test) or `alter role` (affects migrations too). Recommend testing the first on staging |
| Med | Search radius uses Haversine `acos(...)` — no index can serve it; `ilike '%…%'` filters on description; OFFSET pagination | Rewrite of dynamic plpgsql; needs EXPLAIN data first |
| Med | `homlo_list_conversations`, `homlo_list_employer_applications_detailed`, the new `allApplications`: no row cap; `homlo_list_messages` defaults to 500 | Adding caps truncates responses = behaviour change; needs paging in the UI |
| Med | `homlo_list_employer_jobs_with_boosts`: per-job `count(distinct session_id)` over `job_events` | Needs a pre-aggregated views counter; schema change |
| Med | No response compression (gzip) on the API | Needs the `compression` dependency or a proxy setting; hosting unknown — may already be done at the edge |
| Low | `searchJobs` returns `total: rows.length` (page size, not match count) | Fixing changes a response value — DECISION NEEDED |
| Low | Low-cardinality single-column indexes (`idx_jobs_status`, `idx_*_status`, `idx_profiles_role`) may be unused | Needs `pg_stat_user_indexes` from the live DB before dropping anything |
| Low | `@expo-google-fonts/manrope` and `space-grotesk` still in `package.json`; two native map SDKs (`react-native-maps` + MapLibre) | Removing deps changes the lockfile / native build; do with a native rebuild |
| Low | ~20 large PNGs (170–380 KB) displayed small | Each needs its display size checked; unreferenced ones (e.g. 10 MB `detail-page-part.mov`) are not bundled, so they cost nothing at runtime |
| Low | No bundle-size or migration-lint CI check; no per-request query count in logs | Guardrail work for a follow-up |
