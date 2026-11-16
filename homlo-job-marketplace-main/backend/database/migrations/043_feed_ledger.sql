-- 043_feed_ledger.sql
-- Homlo Jobs feed backend: anonymous event log, precomputed stats, refresh function, eligibility view.
-- Plain PostgreSQL + PostGIS. Works on Supabase today and on AWS RDS/Aurora later (no Supabase-only features).
-- Ship this as a normal version-controlled migration file.

create extension if not exists postgis;

-- =====================================================================================
-- 1) ADAPTATION POINT  (the ONLY place that knows your real `jobs` columns)
-- =====================================================================================
-- Map your real columns here. The feed code reads ONLY this view.
-- Expected output columns (names and meaning must stay exactly as written):
--   id uuid, employer_id uuid, category text, work_arrangement text ('on_site'|'hybrid'|'remote'),
--   job_type text ('part_time'|'full_time'|'weekends' or null), pay_min float8, pay_max float8,
--   pay_period text ('hourly'|'daily'|'weekly'|'monthly'|'yearly' or null), created_at timestamptz,
--   positions_left int (null = unlimited), location geography(Point,4326) (null allowed for remote),
--   employer_quality float8 (0..1, null = unknown)
-- The WHERE clause must keep only jobs that are live, not soft-deleted, and not filled/closed/under review.
create or replace view feed_eligible_jobs as
select
  j.id,
  j.employer_id,
  c.name as category,
  case j.work_arrangement
    when 'On-site' then 'on_site'
    when 'Hybrid' then 'hybrid'
    when 'Remote' then 'remote'
    else 'on_site'
  end as work_arrangement,
  case j.pay_type
    when 'hourly' then 'part_time'
    when 'daily' then 'full_time'
    when 'fixed' then 'weekends'
    else null
  end as job_type,
  j.pay_amount::float8 as pay_min,
  j.pay_amount::float8 as pay_max,
  j.pay_type as pay_period,
  j.created_at,
  (j.workers_needed - j.workers_hired) as positions_left,
  j.location,
  null::float8 as employer_quality
from jobs j
left join categories c on c.id = j.category_id
where j.deleted_at is null
  and j.status = 'open'
  and (j.workers_hired < j.workers_needed or j.workers_needed = 0);

-- =====================================================================================
-- 2) Anonymous event log. No user id, no profile. session_id rotates and cannot identify anyone.
-- =====================================================================================
create table if not exists job_events (
  id          bigint generated always as identity primary key,
  job_id      uuid        not null,
  event_type  text        not null check (event_type in ('impression','view','dwell_15s','save','apply')),
  session_id  text        not null check (char_length(session_id) between 8 and 64),
  created_at  timestamptz not null default now()
);
-- No foreign key on purpose: this is a high-volume append-only table and a deleted job must not break ingestion.
create index if not exists job_events_created_idx     on job_events (created_at);
create index if not exists job_events_job_created_idx on job_events (job_id, created_at);

-- =====================================================================================
-- 3) Precomputed, time-decayed aggregates (rewritten by refresh_job_stats)
-- =====================================================================================
create table if not exists job_stats (
  job_id      uuid primary key,
  e_today     float8 not null default 0,
  i_today     float8 not null default 0,
  e_week      float8 not null default 0,
  i_week      float8 not null default 0,
  e_month     float8 not null default 0,
  i_month     float8 not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists job_stats_global (
  period       text primary key check (period in ('today','week','month')),
  engagement   float8 not null default 0,
  impressions  float8 not null default 0,
  updated_at   timestamptz not null default now()
);

-- Only the backend (service role / DB owner) touches these tables. Clients never read or write them directly.
alter table job_events        enable row level security;
alter table job_stats         enable row level security;
alter table job_stats_global  enable row level security;

-- =====================================================================================
-- 4) Refresh function. Run every 10-15 minutes.
--    Generate the exact call (with your tuning numbers) from marmot_tuning_knobs.ts -> refreshJobStatsSql().
--    Anti-spam: each (job, session, event type) counts at most once per UTC day.
-- =====================================================================================
create or replace function refresh_job_stats(p_config jsonb)
returns void
language plpgsql
as $$
declare
  v_now        timestamptz := clock_timestamp();
  w_view       float8 := (p_config #>> '{eventWeights,view}')::float8;
  w_dwell      float8 := (p_config #>> '{eventWeights,dwell_15s}')::float8;
  w_save       float8 := (p_config #>> '{eventWeights,save}')::float8;
  w_apply      float8 := (p_config #>> '{eventWeights,apply}')::float8;
  win_today    float8 := (p_config #>> '{periods,today,windowDays}')::float8;
  hl_today     float8 := (p_config #>> '{periods,today,halfLifeDays}')::float8;
  win_week     float8 := (p_config #>> '{periods,week,windowDays}')::float8;
  hl_week      float8 := (p_config #>> '{periods,week,halfLifeDays}')::float8;
  win_month    float8 := (p_config #>> '{periods,month,windowDays}')::float8;
  hl_month     float8 := (p_config #>> '{periods,month,halfLifeDays}')::float8;
  v_retention  int    := (p_config ->> 'retentionDays')::int;
  v_max_window float8;
begin
  if w_view is null or w_dwell is null or w_save is null or w_apply is null
     or win_today is null or hl_today is null or win_week is null or hl_week is null
     or win_month is null or hl_month is null or v_retention is null then
    raise exception 'refresh_job_stats: incomplete config (use refreshJobStatsSql() from marmot_tuning_knobs.ts)';
  end if;

  v_max_window := greatest(win_today, win_week, win_month);

  delete from job_events where created_at < v_now - make_interval(days => v_retention);

  drop table if exists _job_stats_agg;
  create temp table _job_stats_agg on commit drop as
  with deduped as (
    select distinct on (job_id, session_id, event_type, ((created_at at time zone 'UTC')::date))
           job_id, event_type, created_at
    from job_events
    where created_at >= v_now - make_interval(secs => v_max_window * 86400)
    order by job_id, session_id, event_type, ((created_at at time zone 'UTC')::date), created_at
  ), scored as (
    select job_id,
           greatest(0, extract(epoch from (v_now - created_at)) / 86400.0) as age_days,
           (event_type = 'impression') as is_impr,
           case event_type
             when 'view'      then w_view
             when 'dwell_15s' then w_dwell
             when 'save'      then w_save
             when 'apply'     then w_apply
             else 0
           end as w
    from deduped
  )
  select job_id,
    sum(case when not is_impr and age_days <= win_today then w * power(0.5, age_days / hl_today) else 0 end) as e_today,
    sum(case when     is_impr and age_days <= win_today then     power(0.5, age_days / hl_today) else 0 end) as i_today,
    sum(case when not is_impr and age_days <= win_week  then w * power(0.5, age_days / hl_week)  else 0 end) as e_week,
    sum(case when     is_impr and age_days <= win_week  then     power(0.5, age_days / hl_week)  else 0 end) as i_week,
    sum(case when not is_impr and age_days <= win_month then w * power(0.5, age_days / hl_month) else 0 end) as e_month,
    sum(case when     is_impr and age_days <= win_month then     power(0.5, age_days / hl_month) else 0 end) as i_month
  from scored
  group by job_id;

  -- Jobs with no recent events must go back to zero.
  delete from job_stats s where not exists (select 1 from _job_stats_agg a where a.job_id = s.job_id);

  insert into job_stats (job_id, e_today, i_today, e_week, i_week, e_month, i_month, updated_at)
  select job_id, e_today, i_today, e_week, i_week, e_month, i_month, v_now from _job_stats_agg
  on conflict (job_id) do update set
    e_today = excluded.e_today, i_today = excluded.i_today,
    e_week  = excluded.e_week,  i_week  = excluded.i_week,
    e_month = excluded.e_month, i_month = excluded.i_month,
    updated_at = excluded.updated_at;

  insert into job_stats_global (period, engagement, impressions, updated_at)
  select 'today', coalesce(sum(e_today), 0), coalesce(sum(i_today), 0), v_now from _job_stats_agg
  union all
  select 'week',  coalesce(sum(e_week),  0), coalesce(sum(i_week),  0), v_now from _job_stats_agg
  union all
  select 'month', coalesce(sum(e_month), 0), coalesce(sum(i_month), 0), v_now from _job_stats_agg
  on conflict (period) do update set
    engagement = excluded.engagement, impressions = excluded.impressions, updated_at = excluded.updated_at;
end;
$$;

-- Scheduling example (Supabase pg_cron). Paste the output of refreshJobStatsSql() inside:
--   select cron.schedule('refresh-job-stats', '*/10 * * * *', $cron$ <output of refreshJobStatsSql()> $cron$);