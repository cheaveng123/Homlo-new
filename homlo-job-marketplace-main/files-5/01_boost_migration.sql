-- Homlo Jobs: boost lifecycle (schedule -> active -> expired) + inbox "Update" notifications.
-- Safe to re-run. BEFORE RUNNING: compare with the real `boosts` / `notifications` / `jobs`
-- tables and adjust column names in this file only (see IMPLEMENTATION_PROMPT_BOOSTING.md, step 1).

create extension if not exists pgcrypto;

create table if not exists public.boosts (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null,
  employer_user_id    uuid not null,
  plan_key            text not null,
  price_paid_cents    integer not null default 0,
  duration_days       integer not null check (duration_days > 0),
  rank_multiplier     numeric(4,3) not null default 1.000,
  payment_id          uuid,
  status              text not null default 'scheduled',
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  started_notified_at timestamptz,
  ended_notified_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- If a boosts table already existed, make sure every column we rely on is there.
alter table public.boosts add column if not exists plan_key text;
alter table public.boosts add column if not exists price_paid_cents integer not null default 0;
alter table public.boosts add column if not exists duration_days integer;
alter table public.boosts add column if not exists rank_multiplier numeric(4,3) not null default 1.000;
alter table public.boosts add column if not exists payment_id uuid;
alter table public.boosts add column if not exists status text not null default 'scheduled';
alter table public.boosts add column if not exists starts_at timestamptz;
alter table public.boosts add column if not exists ends_at timestamptz;
alter table public.boosts add column if not exists started_notified_at timestamptz;
alter table public.boosts add column if not exists ended_notified_at timestamptz;
alter table public.boosts add column if not exists updated_at timestamptz not null default now();

alter table public.boosts drop constraint if exists boosts_status_check;
alter table public.boosts add constraint boosts_status_check
  check (status in ('scheduled','active','expired','cancelled'));
alter table public.boosts drop constraint if exists boosts_window_check;
alter table public.boosts add constraint boosts_window_check check (ends_at > starts_at);

-- One payment can only ever create one boost (webhook retries are harmless).
create unique index if not exists boosts_payment_uidx
  on public.boosts (payment_id) where payment_id is not null;
-- A job can have only one ACTIVE boost; extra paid boosts queue as 'scheduled'.
create unique index if not exists boosts_one_active_per_job_uidx
  on public.boosts (job_id) where status = 'active';
create index if not exists boosts_job_status_idx on public.boosts (job_id, status, ends_at);
create index if not exists boosts_due_idx on public.boosts (status, starts_at, ends_at)
  where status in ('scheduled','active');

-- Moves boosts through their lifecycle and sends each inbox notification exactly once.
-- Safe to call as often as you like, from anywhere, concurrently.
create or replace function public.boost_tick()
returns table (activated int, expired int, notified_started int, notified_ended int)
language plpgsql
as $$
declare
  v_activated int := 0;
  v_expired   int := 0;
  v_ns        int := 0;
  v_ne        int := 0;
  v_tz        constant text := 'Asia/Phnom_Penh';   -- display timezone for the inbox text
begin
  -- one sweeper at a time; a second caller just returns zeros
  if not pg_try_advisory_xact_lock(727001) then
    return query select 0, 0, 0, 0;
    return;
  end if;

  -- 1) active boosts whose time is up
  update public.boosts set status = 'expired', updated_at = now()
   where status = 'active' and ends_at <= now();
  get diagnostics v_expired = row_count;

  -- 2) queued boosts whose window is over before they ever started (sweeper was down)
  update public.boosts set status = 'expired', updated_at = now()
   where status = 'scheduled' and ends_at <= now();
  
  -- 3) queued boosts that are due now
  update public.boosts b set status = 'active', updated_at = now()
   where b.status = 'scheduled' and b.starts_at <= now() and b.ends_at > now()
     and not exists (select 1 from public.boosts o
                      where o.job_id = b.job_id and o.status = 'active' and o.id <> b.id);
  get diagnostics v_activated = row_count;

  -- 4) "boost started" notifications
  with s as (
    update public.boosts set started_notified_at = now()
     where started_notified_at is null and status in ('active','expired')
     returning id, job_id, employer_user_id, starts_at, ends_at, duration_days
  ), ins as (
    insert into public.notifications (user_id, category, type, title, body, data)
    select s.employer_user_id, 'update', 'boost_started', 'Your boost is live',
           format('"%s" is boosted for %s day%s, until %s.',
                  j.title, s.duration_days, case when s.duration_days = 1 then '' else 's' end,
                  to_char(s.ends_at at time zone v_tz, 'Mon FMDD, HH12:MI AM')),
           jsonb_build_object('boost_id', s.id, 'job_id', s.job_id,
                              'starts_at', s.starts_at, 'ends_at', s.ends_at)
      from s join public.jobs j on j.id = s.job_id
    returning 1
  ) select count(*)::int into v_ns from ins;

  -- 5) "boost ended" notifications
  with e as (
    update public.boosts set ended_notified_at = now()
     where ended_notified_at is null and status = 'expired'
     returning id, job_id, employer_user_id, starts_at, ends_at
  ), ins as (
    insert into public.notifications (user_id, category, type, title, body, data)
    select e.employer_user_id, 'update', 'boost_ended', 'Your boost has ended',
           format('The boost on "%s" ended on %s.',
                  j.title, to_char(e.ends_at at time zone v_tz, 'Mon FMDD, HH12:MI AM')),
           jsonb_build_object('boost_id', e.id, 'job_id', e.job_id,
                              'starts_at', e.starts_at, 'ends_at', e.ends_at)
      from e join public.jobs j on j.id = e.job_id
    returning 1
  ) select count(*)::int into v_ne from ins;

  return query select v_activated, v_expired, v_ns, v_ne;
end;
$$;
