-- =========================================================
-- 022_candidate_retrieval.sql
-- Shared hard-eligibility filter for candidate retrieval (phase 3).
--
-- Every retrieval source filters through homlo_eligible_candidates(...)
-- first, so eligibility is enforced in exactly one place:
--
--   1. Job is NOT deleted and status = 'open' AND not full
--      (workers_hired < workers_needed — mirrors homlo_submit_application).
--   2. Job start date/time has not passed AND there is no "accepting
--      applications closes" notion (no application_deadline column exists);
--      end_date is an availability range, NOT a deadline, and is not used to
--      exclude jobs here.
--   3. The worker has not already applied (a row with status other than
--      'withdrawn'/'declined' — those two clear the gate so re-apply works,
--      matching homlo_submit_application's on conflict logic).
--   4. The employer is not the worker themselves (mirrors the
--      "Employers cannot apply to their own jobs" gate).
--   5. The employer's user is active (no suspension/ban). There is no
--      dedicated per-employer fraud flag; users.status is the fraud gate.
--   6. There is no blocking/blocked-users table in this schema, so blocked
--      employers are NOT filtered here (noted gap, no invented columns).
--   7. Hard commute cap: when BOTH the worker's coordinates and the job's
--      geography are known, the job must be within hardMaxCommuteKm. Jobs
--      with unverifiable location (job geography NULL) are kept — a missing
--      coordinate is treated as unknown, not ineligible. If the worker's
--      location is unknown, the distance check is skipped entirely.
--
-- All source-specific, "relevance"-style ordering and narrowing happens in
-- the retrieval service; this function returns only jobs that COULD be
-- surfaced. It also exposes the columns sources need: employer_active_jobs_count
-- (source 5) and employer_created_at.
-- =========================================================

create or replace function public.homlo_eligible_candidates(
  p_worker_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_hard_max_commute_km numeric,
  p_now timestamptz default null
)
returns table (
  id uuid,
  employer_id uuid,
  category_id uuid,
  created_at timestamptz,
  employer_active_jobs_count bigint,
  employer_created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    j.id,
    j.employer_id,
    j.category_id,
    j.created_at,
    (select count(*)::bigint
       from jobs jp
      where jp.employer_id = j.employer_id
        and jp.deleted_at is null) as employer_active_jobs_count,
    u.created_at as employer_created_at
  from jobs j
  join profiles emp
    on emp.user_id = j.employer_id
   and emp.deleted_at is null
  join users u
    on u.id = emp.user_id
  where j.deleted_at is null
    and j.status = 'open'
    and j.workers_hired < j.workers_needed
    and u.status = 'active'
    and (p_worker_id is null
         or (j.employer_id is distinct from p_worker_id
             and not exists (
               select 1
               from applications a
               where a.job_id = j.id
                 and a.worker_id = p_worker_id
                 and a.status not in ('withdrawn', 'declined')
             )))
    and (j.start_date is null
         or j.start_date > (coalesce(p_now, clock_timestamp()) at time zone 'UTC')::date
         or (j.start_date = (coalesce(p_now, clock_timestamp()) at time zone 'UTC')::date
             and (j.start_time is null or j.start_time > (coalesce(p_now, clock_timestamp()) at time zone 'UTC')::time)))
    and (p_latitude is null
         or p_longitude is null
         or p_hard_max_commute_km is null
         or j.location is null
         or st_dwithin(
              j.location,
              st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
              (p_hard_max_commute_km * 1000)::double precision
            ))
$$;

revoke all on function public.homlo_eligible_candidates(uuid, double precision, double precision, numeric, timestamptz)
from public, anon, authenticated;

grant execute on function public.homlo_eligible_candidates(uuid, double precision, double precision, numeric, timestamptz)
to service_role;