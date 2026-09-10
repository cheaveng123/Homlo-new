-- =========================================================
-- 019_employer_quality_stats.sql
-- Precomputed employer-level quality metrics used by the ranking
-- system (ContinuousShrinkage blends these toward job-level evidence).
--
-- This table is written ONLY by a scheduled aggregation job (built in a
-- later phase). No live per-request computation and no population logic
-- here — structure only. Wilson lower-bound columns stay nullable until
-- the aggregation job has enough evidence to fill them.
-- =========================================================

create table employer_quality_stats (
  employer_id                     uuid primary key references profiles(user_id) on delete cascade,

  n_jobs_posted                   int not null default 0,
  n_completions                   int not null default 0,
  n_reports                       int not null default 0,

  completion_rate_wilson_lb       double precision,
  positive_review_rate_wilson_lb  double precision,
  response_rate_wilson_lb         double precision,

  verification_status             text not null default 'unverified'
                                    check (verification_status in ('unverified', 'partial', 'verified')),

  last_computed_at                timestamptz
);
