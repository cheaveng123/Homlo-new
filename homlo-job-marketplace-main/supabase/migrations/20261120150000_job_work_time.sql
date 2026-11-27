-- =========================================================
-- 059_job_work_time.sql
-- Work time and pay range for job listings (post-a-job flow).
--
--   work_days       which days the job runs ('mon'..'sun'); null = not set (N/A)
--   clock_in        shift start (local time); null = not set (N/A)
--   clock_out       shift end; may be earlier than clock_in (overnight shift)
--   pay_amount_max  top of a pay range; null = a fixed amount (pay_amount)
--
-- Nullable, no defaults, no backfill: existing listings read as "not set".
-- Written by the app server after homlo_save_job (server/routers.ts,
-- saveWorkTimeFields), so homlo_save_job's signature is unchanged.
--
-- Prepared locally for review. Take a database backup before applying.
-- =========================================================

alter table public.jobs
  add column if not exists work_days text[],
  add column if not exists clock_in time,
  add column if not exists clock_out time,
  add column if not exists pay_amount_max numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jobs_work_days_values_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_work_days_values_check
      check (
        work_days is null
        or work_days <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jobs_clock_pair_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_clock_pair_check
      check ((clock_in is null) = (clock_out is null));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jobs_pay_range_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_pay_range_check
      check (pay_amount_max is null or pay_amount is null or pay_amount_max > pay_amount);
  end if;
end;
$$;
