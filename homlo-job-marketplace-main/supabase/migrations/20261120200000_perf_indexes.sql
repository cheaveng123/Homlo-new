-- =========================================================
-- 060_perf_indexes.sql
-- Performance indexes for the two hottest public reads (perf audit, Phase 2).
--
--  1. Public job feed — homlo_list_public_published_jobs():
--       where deleted_at is null and status = 'open'
--       order by created_at desc limit 200
--     Only idx_jobs_status (status) existed, so every open job was read and
--     sorted. A partial index ordered by created_at lets Postgres read the
--     newest 200 straight off the index. Also serves search's "newest" sort.
--
--  2. Employer profile lookup — HomloDirectService.getEmployerProfile():
--       where full_name is not null
--         and (lower(full_name) = lower($1) or full_name ilike $1 || '%')
--     Nothing indexed profiles.full_name, so this was a full scan of profiles
--     on every job detail and employer page. A btree on lower(full_name)
--     serves the exact match; a trigram GIN serves the ILIKE prefix match.
--     (pg_trgm is already installed — 016_job_search.sql.)
--
-- Additive only: no table, column, row or function changes.
--
-- HOW TO APPLY: CREATE INDEX CONCURRENTLY does not block writes, but it
-- cannot run inside a transaction block. Run EACH statement below on its own
-- (one at a time in the SQL editor, or psql with autocommit). Do not paste the
-- whole file as one query. Then confirm with EXPLAIN (see docs/PERF_REPORT.md).
--
-- ROLLBACK (also one statement at a time):
--   drop index concurrently if exists public.idx_jobs_open_created_at;
--   drop index concurrently if exists public.idx_profiles_full_name_lower;
--   drop index concurrently if exists public.idx_profiles_full_name_trgm;
-- =========================================================

create index concurrently if not exists idx_jobs_open_created_at
  on public.jobs (created_at desc)
  where deleted_at is null and status = 'open';

create index concurrently if not exists idx_profiles_full_name_lower
  on public.profiles (lower(full_name))
  where full_name is not null;

create index concurrently if not exists idx_profiles_full_name_trgm
  on public.profiles using gin (full_name gin_trgm_ops)
  where full_name is not null;
