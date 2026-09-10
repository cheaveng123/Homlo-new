-- =========================================================
-- 020_job_quality_stats.sql
-- Precomputed job-level quality/interaction metrics used by the ranking
-- system (shrinkage weight w_job = n / (n + k) blends job-level quality
-- toward employer-level quality as evidence accumulates).
--
-- Written ONLY by a scheduled aggregation job (built in a later phase).
-- No live per-request computation and no population logic here —
-- structure only. Wilson lower-bound columns stay nullable until the
-- aggregation job has enough evidence to fill them.
-- =========================================================

create table job_quality_stats (
  job_id              uuid primary key references jobs(id) on delete cascade,

  impressions         int not null default 0,
  clicks              int not null default 0,
  applies_started     int not null default 0,
  applies_submitted   int not null default 0,

  ctr_wilson_lb       double precision,
  apply_rate_wilson_lb double precision,

  n_events            int not null default 0,  -- total job-level event count (evidence for shrinkage)

  last_computed_at    timestamptz
);
