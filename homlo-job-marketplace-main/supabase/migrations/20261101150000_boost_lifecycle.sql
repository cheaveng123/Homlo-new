-- Homlo Jobs: boost lifecycle (scheduled -> active -> expired) + inbox "Update" notifications.
-- Adapted to the existing public.boosts schema:
--   employer_id / package / start_at / expires_at (not employer_user_id / plan_key / starts_at / ends_at).
-- Safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- 1. Extend the existing boosts table in place.
-- ---------------------------------------------------------
alter table public.boosts add column if not exists price_paid_cents integer not null default 0;
alter table public.boosts add column if not exists duration_days integer;
alter table public.boosts add column if not exists rank_multiplier numeric(4,3) not null default 1.000;
alter table public.boosts add column if not exists payment_id uuid;
alter table public.boosts add column if not exists started_notified_at timestamptz;
alter table public.boosts add column if not exists ended_notified_at timestamptz;
alter table public.boosts add column if not exists updated_at timestamptz not null default now();

-- Backfill the new duration from the existing paid window.
update public.boosts
   set duration_days = greatest(
         1,
         ceil(extract(epoch from (expires_at - start_at)) / 86400.0)::int
       )
 where duration_days is null;

update public.boosts
   set expires_at = start_at + make_interval(days => coalesce(duration_days, 7))
 where expires_at <= start_at;

alter table public.boosts alter column duration_days set not null;

-- Old statuses: pending -> scheduled. Active-but-finished -> expired.
alter table public.boosts drop constraint if exists boosts_status_check;
update public.boosts set status = 'scheduled', updated_at = now() where status = 'pending';
update public.boosts set status = 'expired', updated_at = now()
 where status = 'active' and expires_at <= now();

alter table public.boosts add constraint boosts_status_check
  check (status in ('scheduled', 'active', 'expired', 'cancelled'));
alter table public.boosts drop constraint if exists boosts_window_check;
alter table public.boosts add constraint boosts_window_check check (expires_at > start_at);

-- Grandfathered boosts must not send retroactive "started"/"ended" inbox notices.
update public.boosts
   set started_notified_at = coalesce(started_notified_at, now())
 where status in ('active', 'expired');
update public.boosts
   set ended_notified_at = coalesce(ended_notified_at, now())
 where status = 'expired'
    or (status = 'scheduled' and expires_at <= now());

-- One payment can only ever create one boost (webhook retries are harmless).
create unique index if not exists boosts_payment_uidx
  on public.boosts (payment_id) where payment_id is not null;

-- A job can have only one ACTIVE boost; extra paid boosts queue as 'scheduled'.
-- Demote any legacy duplicates before adding the unique index.
with ranked as (
  select id,
         row_number() over (
           partition by job_id
           order by start_at desc, created_at desc, id
         ) as rn
    from public.boosts
   where status = 'active'
)
update public.boosts b
   set status = 'scheduled', updated_at = now()
  from ranked r
 where b.id = r.id and r.rn > 1;

create unique index if not exists boosts_one_active_per_job_uidx
  on public.boosts (job_id) where status = 'active';
create index if not exists boosts_job_status_idx
  on public.boosts (job_id, status, expires_at);
create index if not exists boosts_due_idx
  on public.boosts (status, start_at, expires_at)
  where status in ('scheduled', 'active');

-- The plan-boost purchase table allows multiple paid boosts to queue for the same job.
drop index if exists public.uq_job_boosts_one_live_per_job;

-- Grandfather live plan boosts into the lifecycle table so existing paid boosts keep ranking.
do $$
begin
  if to_regclass('public.job_boosts') is not null then
    insert into public.boosts
      (job_id, employer_id, package, price_paid_cents, duration_days, rank_multiplier,
       payment_id, status, start_at, expires_at, started_notified_at)
    select
      jb.job_id,
      jb.employer_id,
      jb.package_id,
      jb.price_cents,
      coalesce(bp.duration_days, 7),
      coalesce(bp.multiplier, 1.000),
      jb.id,
      'active',
      coalesce(jb.starts_at, jb.purchased_at),
      coalesce(
        jb.ends_at,
        coalesce(jb.starts_at, jb.purchased_at) + make_interval(days => coalesce(bp.duration_days, 7))
      ),
      now()
    from public.job_boosts jb
    left join public.boost_packages bp on bp.id = jb.package_id
    where jb.status = 'active'
      and coalesce(
        jb.ends_at,
        coalesce(jb.starts_at, jb.purchased_at) + make_interval(days => coalesce(bp.duration_days, 7))
      ) > now()
      and not exists (select 1 from public.boosts b where b.payment_id = jb.id)
    on conflict (payment_id) where payment_id is not null do nothing;
  end if;
end $$;

-- ---------------------------------------------------------
-- 2. Lifecycle sweeper. Sends each inbox notification exactly once.
--    Safe to call as often as you like, from anywhere, concurrently.
-- ---------------------------------------------------------
create or replace function public.boost_tick()
returns table (activated int, expired int, notified_started int, notified_ended int)
language plpgsql
as $$
declare
  v_activated int := 0;
  v_expired   int := 0;
  v_ns        int := 0;
  v_ne        int := 0;
  v_tz        constant text := 'Asia/Phnom_Penh';
begin
  if not pg_try_advisory_xact_lock(727001) then
    return query select 0, 0, 0, 0;
    return;
  end if;

  -- 1) active boosts whose time is up
  update public.boosts set status = 'expired', updated_at = now()
   where status = 'active' and expires_at <= now();
  get diagnostics v_expired = row_count;

  -- 2) queued boosts whose window is over before they ever started (sweeper was down)
  update public.boosts set status = 'expired', updated_at = now()
   where status = 'scheduled' and expires_at <= now();

  -- 3) queued boosts that are due now
  update public.boosts b set status = 'active', updated_at = now()
   where b.status = 'scheduled' and b.start_at <= now() and b.expires_at > now()
     and not exists (select 1 from public.boosts o
                      where o.job_id = b.job_id and o.status = 'active' and o.id <> b.id);
  get diagnostics v_activated = row_count;

  -- 4) "boost started" notifications
  with s as (
    update public.boosts set started_notified_at = now()
     where started_notified_at is null and status in ('active', 'expired')
     returning id, job_id, employer_id, start_at, expires_at, duration_days
  ), ins as (
    insert into public.notifications (user_id, category, type, title, body, data)
    select s.employer_id, 'update', 'boost_started', 'Your boost is live',
           format('"%s" is boosted for %s day%s, until %s.',
                  j.title, s.duration_days, case when s.duration_days = 1 then '' else 's' end,
                  to_char(s.expires_at at time zone v_tz, 'Mon FMDD, HH12:MI AM')),
           jsonb_build_object('boost_id', s.id, 'job_id', s.job_id,
                              'starts_at', s.start_at, 'ends_at', s.expires_at)
      from s join public.jobs j on j.id = s.job_id
    returning 1
  ) select count(*)::int into v_ns from ins;

  -- 5) "boost ended" notifications
  with e as (
    update public.boosts set ended_notified_at = now()
     where ended_notified_at is null and status = 'expired'
     returning id, job_id, employer_id, start_at, expires_at
  ), ins as (
    insert into public.notifications (user_id, category, type, title, body, data)
    select e.employer_id, 'update', 'boost_ended', 'Your boost has ended',
           format('The boost on "%s" ended on %s.',
                  j.title, to_char(e.expires_at at time zone v_tz, 'Mon FMDD, HH12:MI AM')),
           jsonb_build_object('boost_id', e.id, 'job_id', e.job_id,
                              'starts_at', e.start_at, 'ends_at', e.expires_at)
      from e join public.jobs j on j.id = e.job_id
    returning 1
  ) select count(*)::int into v_ne from ins;

  return query select v_activated, v_expired, v_ns, v_ne;
end;
$$;

revoke all on function public.boost_tick() from public, anon, authenticated;
grant execute on function public.boost_tick() to service_role;

-- ---------------------------------------------------------
-- 3. Inbox "Update" notifications.
-- ---------------------------------------------------------
alter table public.notifications add column if not exists category text;
update public.notifications set category = 'application' where category is null;
alter table public.notifications alter column category set default 'application';
alter table public.notifications alter column category set not null;
alter table public.notifications add column if not exists data jsonb;

create index if not exists notifications_user_category_idx
  on public.notifications (user_id, category, read, created_at desc);

drop function if exists public.homlo_list_user_notifications(uuid);
create or replace function public.homlo_list_user_notifications(p_user_id uuid)
returns table (
  id uuid,
  type text,
  title text,
  body text,
  read boolean,
  created_at timestamptz,
  job_id uuid,
  application_id uuid,
  job_title text,
  category text,
  data jsonb
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    n.id,
    n.type,
    n.title,
    n.body,
    n.read,
    n.created_at,
    n.job_id,
    n.application_id,
    j.title as job_title,
    n.category,
    n.data
  from notifications n
  left join jobs j on j.id = n.job_id
  where n.user_id = p_user_id
  order by n.created_at desc
  limit 200;
$$;

revoke all on function public.homlo_list_user_notifications(uuid) from public, anon, authenticated;
grant execute on function public.homlo_list_user_notifications(uuid) to service_role;

-- ---------------------------------------------------------
-- 4. Employer job list with full boost timing.
-- ---------------------------------------------------------
drop function if exists public.homlo_list_employer_jobs_with_boosts(uuid);
create or replace function public.homlo_list_employer_jobs_with_boosts(p_employer_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  pay_amount numeric,
  pay_currency text,
  pay_type text,
  location_text text,
  latitude double precision,
  longitude double precision,
  workers_needed integer,
  workers_hired integer,
  address_line text,
  city text,
  district text,
  province text,
  country text,
  postal_code text,
  banner_image text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  boost_id uuid,
  boost_package text,
  boost_expires_at timestamptz,
  requirements text,
  category text,
  views_count bigint,
  work_arrangement text,
  boost_status text,
  boost_starts_at timestamptz,
  boost_rank_multiplier numeric,
  server_now timestamptz,
  queued_boosts integer
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    j.id, j.title, j.description, j.pay_amount, j.pay_currency, j.pay_type,
    j.location_text, j.latitude, j.longitude, j.workers_needed, j.workers_hired,
    j.address_line, j.city, j.district, j.province, j.country, j.postal_code,
    j.banner_image, j.status, j.created_at, j.updated_at,
    b.id as boost_id, b.package as boost_package, b.expires_at as boost_expires_at,
    j.requirements,
    c.name as category,
    (
      select count(distinct e.session_id)::bigint
      from job_events_anon e
      where e.job_id = j.id and e.event_type = 'view'
    ) as views_count,
    j.work_arrangement,
    b.status as boost_status,
    b.start_at as boost_starts_at,
    b.rank_multiplier as boost_rank_multiplier,
    now() as server_now,
    (
      select count(*)::int from public.boosts q
      where q.job_id = j.id and q.status = 'scheduled'
    ) as queued_boosts
  from jobs j
  left join categories c on c.id = j.category_id
  left join lateral (
    select b.id, b.package, b.expires_at, b.status, b.start_at, b.rank_multiplier
    from public.boosts b
    where b.job_id = j.id
      and b.status = 'active'
      and b.start_at <= now()
      and b.expires_at > now()
    order by b.rank_multiplier desc, b.created_at desc
    limit 1
  ) b on true
  where j.employer_id = p_employer_id and j.deleted_at is null
  order by j.updated_at desc;
$$;

revoke all on function public.homlo_list_employer_jobs_with_boosts(uuid) from public, anon, authenticated;
grant execute on function public.homlo_list_employer_jobs_with_boosts(uuid) to service_role;

-- ---------------------------------------------------------
-- 5. Public job feed exposes only the ad flag (never price/plan/end time).
-- ---------------------------------------------------------
drop function if exists public.homlo_list_public_published_jobs();
create or replace function public.homlo_list_public_published_jobs()
returns table (
  id uuid,
  title text,
  description text,
  pay_amount numeric,
  pay_currency text,
  pay_type text,
  location_text text,
  latitude double precision,
  longitude double precision,
  workers_needed integer,
  created_at timestamptz,
  category text,
  employer_name text,
  employer_photo_key text,
  banner_image text,
  status text,
  workers_hired integer,
  work_arrangement text,
  boosted boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    j.id,
    j.title,
    j.description,
    j.pay_amount,
    j.pay_currency,
    j.pay_type,
    j.location_text,
    j.latitude,
    j.longitude,
    j.workers_needed,
    j.created_at,
    coalesce(c.name, 'Other') as category,
    p.full_name as employer_name,
    p.profile_photo_key as employer_photo_key,
    j.banner_image,
    j.status,
    j.workers_hired,
    j.work_arrangement,
    exists (
      select 1 from public.boosts b
      where b.job_id = j.id
        and b.status = 'active'
        and b.start_at <= now()
        and b.expires_at > now()
    ) as boosted
  from jobs j
  left join categories c on c.id = j.category_id
  left join profiles p on p.user_id = j.employer_id and p.deleted_at is null
  where j.deleted_at is null
    and j.status = 'open'
    and (j.workers_needed = 0 or j.workers_hired < j.workers_needed)
    and (j.end_date is null or j.end_date >= current_date)
  order by j.created_at desc
  limit 200;
$$;

revoke all on function public.homlo_list_public_published_jobs() from public, anon, authenticated;
grant execute on function public.homlo_list_public_published_jobs() to service_role;

-- ---------------------------------------------------------
-- 6. Keep the legacy create-boost RPC usable with the new status model.
-- ---------------------------------------------------------
create or replace function public.homlo_create_boost(
  p_employer_id uuid,
  p_job_id uuid,
  p_package text,
  p_amount numeric,
  p_currency text default 'USD',
  p_provider text default 'aba_payway'
)
returns table (
  boost_id uuid,
  payment_id uuid,
  payment_status text,
  amount numeric,
  currency text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job jobs%rowtype;
  v_boost boosts%rowtype;
  v_payment payments%rowtype;
  v_days int;
  v_expected_amount numeric;
  v_is_pro boolean;
begin
  select * into v_job from jobs where id = p_job_id and deleted_at is null for update;
  if not found then
    raise exception 'Job not found';
  end if;
  if v_job.employer_id <> p_employer_id then
    raise exception 'Only the listing employer can boost this job';
  end if;
  if v_job.status <> 'open' then
    raise exception 'Only live jobs can be boosted';
  end if;

  case p_package
    when 'starter'  then v_days := 3;
    when 'local'    then v_days := 5;
    when 'standard' then v_days := 7;
    when 'urgent'   then v_days := 3;
    when 'strong'   then v_days := 7;
    when 'maximum'  then v_days := 14;
    else raise exception 'Unknown boost package';
  end case;

  select exists (
    select 1
    from subscriptions
    where user_id = p_employer_id
      and plan = 'pro'
      and status = 'active'
  ) into v_is_pro;

  case p_package
    when 'starter'  then v_expected_amount := case when v_is_pro then 2.49 else 2.99 end;
    when 'local'    then v_expected_amount := case when v_is_pro then 5.99 else 6.99 end;
    when 'standard' then v_expected_amount := case when v_is_pro then 7.99 else 9.99 end;
    when 'urgent'   then v_expected_amount := case when v_is_pro then 11.99 else 14.99 end;
    when 'strong'   then v_expected_amount := case when v_is_pro then 15.99 else 19.99 end;
    when 'maximum'  then v_expected_amount := case when v_is_pro then 31.99 else 39.99 end;
  end case;

  if p_amount is null or p_amount <= 0 or abs(p_amount - v_expected_amount) > 0.005 then
    raise exception 'Boost amount does not match package';
  end if;

  update boosts
    set status = 'cancelled', updated_at = now()
  where job_id = p_job_id
    and status = 'scheduled';

  insert into boosts (job_id, employer_id, package, start_at, expires_at, status, duration_days)
  values (p_job_id, p_employer_id, p_package, now(), now() + make_interval(days => v_days), 'scheduled', v_days)
  returning * into v_boost;

  insert into payments (user_id, job_id, boost_id, amount, currency, provider, status)
  values (p_employer_id, p_job_id, v_boost.id, p_amount, coalesce(nullif(trim(p_currency), ''), 'USD'), coalesce(nullif(trim(p_provider), ''), 'aba_payway'), 'pending')
  returning * into v_payment;

  return query select v_boost.id, v_payment.id, v_payment.status, v_payment.amount, v_payment.currency;
end;
$$;

revoke all on function public.homlo_create_boost(uuid, uuid, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.homlo_create_boost(uuid, uuid, text, numeric, text, text) to service_role;
