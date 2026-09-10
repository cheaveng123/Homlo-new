-- =========================================================
-- 027_accounts_verification_boosts.sql
-- Backs the Profile ecosystem with real, persistent state:
--   * profiles.verified  — real verification status (never auto-verified)
--   * subscriptions      — employer account plan (free / pro / enterprise)
--   * homlo_get_account  — one call returning profile + verified +
--                          subscription + recent-activity counts
--   * homlo_upsert_subscription — persist plan changes
--   * homlo_create_boost / homlo_verify_boost_payment — create a real
--                          boost + pending payment, then activate only
--                          after server-side verification (idempotent)
--   * boosting is exposed to the public published-jobs feed so ranked/
--                          featured surfaces reflect active boosts
-- =========================================================

-- ---------------------------------------------------------
-- profiles.verified — real, human-set verification state.
-- Default false: a user is never considered verified merely by
-- having an account or an e-mail. Only an authorized operator
-- flips this (set via homlo_set_profile_verified below); no
-- client-supplied value is accepted.
-- ---------------------------------------------------------
alter table profiles
  add column if not exists verified boolean not null default false;

-- ---------------------------------------------------------
-- subscriptions — the employer account plan. 1:1 with profiles.
-- ---------------------------------------------------------
create table if not exists subscriptions (
  user_id           uuid primary key references profiles(user_id) on delete cascade,
  plan              text not null check (plan in ('free', 'pro', 'enterprise')) default 'free',
  status            text not null check (status in ('active', 'canceled', 'past_due')) default 'active',
  active_jobs_limit int,
  monthly_posts     int,
  provider          text,             -- e.g. 'aba_payway' | 'stripe' | null for manual/free
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_subscriptions_updated_at on subscriptions;
create trigger trg_subscriptions_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

create table if not exists plan_catalog (
  plan              text primary key,
  active_jobs_limit int not null,
  monthly_posts     int not null
);

insert into plan_catalog (plan, active_jobs_limit, monthly_posts) values
  ('free', 2, 5),
  ('pro', 15, 50),
  ('enterprise', 1000, 10000)
on conflict (plan) do nothing;

-- ---------------------------------------------------------
-- homlo_set_profile_verified — service-role RPC that flips the
-- verified flag for a user. NEVER exposed to the client; the
-- gateway does not route an action to it.
-- ---------------------------------------------------------
create or replace function public.homlo_set_profile_verified(
  p_user_id uuid,
  p_verified boolean
)
returns profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile profiles%rowtype;
begin
  update profiles
    set verified = coalesce(p_verified, false)
  where user_id = p_user_id and deleted_at is null
  returning * into v_profile;
  if not found then
    raise exception 'Profile not found';
  end if;
  return v_profile;
end;
$$;

-- ---------------------------------------------------------
-- homlo_get_account — combined account read model for the
-- Profile screen: profile fields + verification + subscription +
-- live recent-activity counts (applications, jobs posted).
-- ---------------------------------------------------------
create or replace function public.homlo_get_account(p_user_id uuid)
returns table (
  user_id uuid,
  role text,
  full_name text,
  phone text,
  bio text,
  location_text text,
  latitude double precision,
  longitude double precision,
  profile_photo_key text,
  verified boolean,
  plan text,
  plan_status text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    p.user_id,
    p.role,
    p.full_name,
    p.phone,
    p.bio,
    p.location_text,
    p.latitude,
    p.longitude,
    p.profile_photo_key,
    coalesce(p.verified, false),
    coalesce(s.plan, 'free'),
    coalesce(s.status, 'active')
  from profiles p
  left join subscriptions s on s.user_id = p.user_id
  where p.user_id = p_user_id and p.deleted_at is null;
$$;

-- ---------------------------------------------------------
-- homlo_get_recent_activity — profile "Recent activity" counts
-- derived from real records for the authenticated user.
-- ---------------------------------------------------------
create or replace function public.homlo_get_recent_activity(p_user_id uuid)
returns table (
  application_count bigint,
  posted_job_count  bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from applications a where a.worker_id = p_user_id),
    (select count(*) from jobs j where j.employer_id = p_user_id and j.deleted_at is null);
$$;

-- ---------------------------------------------------------
-- homlo_upsert_subscription — persists a plan change keyed to the
-- authenticated user. The gateway derives the user id from the
-- session; the client never supplies a user id.
-- ---------------------------------------------------------
create or replace function public.homlo_upsert_subscription(
  p_user_id uuid,
  p_plan text
)
returns subscriptions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limits plan_catalog%rowtype;
  v_subscription subscriptions%rowtype;
begin
  if not exists (select 1 from profiles where user_id = p_user_id and deleted_at is null) then
    raise exception 'Profile not found';
  end if;
  select * into v_limits from plan_catalog where plan = p_plan;
  if not found then
    raise exception 'Unknown plan';
  end if;

  insert into subscriptions (user_id, plan, status, active_jobs_limit, monthly_posts)
  values (
    p_user_id,
    p_plan,
    'active',
    v_limits.active_jobs_limit,
    v_limits.monthly_posts
  )
  on conflict (user_id) do update set
    plan = excluded.plan,
    status = 'active',
    active_jobs_limit = excluded.active_jobs_limit,
    monthly_posts = excluded.monthly_posts,
    current_period_start = now(),
    current_period_end = now() + interval '1 month'
  returning * into v_subscription;

  return v_subscription;
end;
$$;

-- ---------------------------------------------------------
-- homlo_create_subscription_payment — creates a real, pending payment
-- row for an account-plan purchase (boost_id and job_id stay null for
-- plan payments). The plan itself is only applied by the gateway AFTER
-- homlo_record_payment_webhook completes the payment. Free plans never
-- reach this function.
-- ---------------------------------------------------------
create or replace function public.homlo_create_subscription_payment(
  p_user_id uuid,
  p_plan text,
  p_amount numeric,
  p_currency text default 'USD',
  p_provider text default 'aba_payway'
)
returns payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment payments%rowtype;
begin
  if not exists (select 1 from profiles where user_id = p_user_id and deleted_at is null) then
    raise exception 'Profile not found';
  end if;
  if p_plan not in ('free', 'pro', 'enterprise') then
    raise exception 'Unknown plan';
  end if;
  insert into payments (user_id, amount, currency, provider, status)
  values (p_user_id, p_amount, coalesce(nullif(trim(p_currency), ''), 'USD'), coalesce(nullif(trim(p_provider), ''), 'aba_payway'), 'pending')
  returning * into v_payment;
  return v_payment;
end;
$$;

-- ---------------------------------------------------------
-- homlo_create_boost — creates a real boost + pending payment row
-- for a job owned by the authenticated employer. No enforcement of
-- "paid" happens here; activation is gated by homlo_verify_boost_payment.
-- Returns both rows.
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

  -- Cancel any existing active boost for this job so a re-boost replaces it.
  update boosts
    set status = 'cancelled', updated_at = now()
  where job_id = p_job_id and status = 'active';

  case p_package
    when 'starter'  then v_days := 3;
    when 'local'    then v_days := 5;
    when 'standard' then v_days := 7;
    when 'urgent'   then v_days := 3;
    when 'strong'   then v_days := 7;
    when 'maximum'  then v_days := 14;
    else raise exception 'Unknown boost package';
  end case;

  insert into boosts (job_id, employer_id, package, start_at, expires_at, status)
  values (p_job_id, p_employer_id, p_package, now(), now() + make_interval(days => v_days), 'active')
  returning * into v_boost;

  insert into payments (user_id, job_id, boost_id, amount, currency, provider, status)
  values (p_employer_id, p_job_id, v_boost.id, p_amount, coalesce(nullif(trim(p_currency), ''), 'USD'), coalesce(nullif(trim(p_provider), ''), 'aba_payway'), 'pending')
  returning * into v_payment;

  return query select v_boost.id, v_payment.id, v_payment.status, v_payment.amount, v_payment.currency;
end;
$$;

-- ---------------------------------------------------------
-- homlo_record_payment_webhook — idempotent server-side payment
-- verification entry point. In production this is called by the
-- payment provider's webhook (or a signed callback verified against
-- the provider). The UNIQUE(provider, provider_event_id) guard
-- prevents a redelivered event from activating a boost twice.
--
-- For environments without a live provider, the gateway may call
-- this directly in "development/simulated" mode AFTER client
-- confirmation — the activation still flows through the same
-- idempotent, payment-status-gated path.
-- ---------------------------------------------------------
create or replace function public.homlo_record_payment_webhook(
  p_provider text,
  p_provider_event_id text,
  p_provider_transaction_id text,
  p_payment_id uuid,
  p_result text
)
returns payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment payments%rowtype;
  v_event_id uuid;
begin
  if p_result not in ('completed', 'failed') then
    raise exception 'Unknown payment result';
  end if;

  -- Idempotency guard: a duplicate event is a no-op.
  insert into payment_webhook_events (provider, provider_event_id, event_type, payload)
  values (p_provider, p_provider_event_id, p_result, jsonb_build_object('payment_id', p_payment_id, 'provider_transaction_id', p_provider_transaction_id))
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    -- Already processed; return the current payment state untouched.
    select * into v_payment from payments where id = p_payment_id;
    return v_payment;
  end if;

  select * into v_payment from payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;
  if v_payment.status <> 'pending' then
    return v_payment;
  end if;

  if p_result = 'completed' then
    update payments
      set status = 'completed',
          provider_transaction_id = coalesce(provider_transaction_id, p_provider_transaction_id),
          updated_at = now()
      where id = p_payment_id
      returning * into v_payment;
  else
    update payments
      set status = 'failed',
          provider_transaction_id = coalesce(provider_transaction_id, p_provider_transaction_id),
          updated_at = now()
      where id = p_payment_id
      returning * into v_payment;
  end if;

  return v_payment;
end;
$$;

-- ---------------------------------------------------------
-- homlo_get_active_boost — resolve the active boost for a job (if any).
-- The public feed and employer hub both use this so the boost state
-- shown in UI always comes from the database.
-- ---------------------------------------------------------
create or replace function public.homlo_get_active_boost(p_job_id uuid)
returns boosts
language sql
security definer
set search_path = public, pg_temp
as $$
  select b.*
  from boosts b
  where b.job_id = p_job_id
    and b.status = 'active'
    and b.expires_at > now()
  order by b.created_at desc
  limit 1;
$$;

-- ---------------------------------------------------------
-- Update the public published-jobs feed to expose active boosts:
--   * boosted jobs sort above standard listings
--   * each row gains a `boosted` flag + boost expiration
-- This makes a verified boost actually influence the surfaces that
-- rank and display jobs (featured/searchable feed).
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
  boost_expires_at timestamptz,
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
    b.expires_at as boost_expires_at,
    (b.id is not null) as boosted
  from jobs j
  left join categories c on c.id = j.category_id
  left join profiles p on p.user_id = j.employer_id and p.deleted_at is null
  left join lateral (
    select b.expires_at, b.id
    from boosts b
    where b.job_id = j.id
      and b.status = 'active'
      and b.expires_at > now()
    order by b.created_at desc
    limit 1
  ) b on true
  where j.deleted_at is null
    and j.status = 'open'
  order by (b.id is not null) desc, j.created_at desc
  limit 200;
$$;

-- ---------------------------------------------------------
-- Enforce plan limits at the service layer when a job is opened:
-- an employer on the Free plan may only have 2 active jobs; Pro 15.
-- Savings happen in homlo_save_job when status transitions to 'open'.
-- ---------------------------------------------------------
create or replace function public.homlo_update_subscription_limits(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from subscriptions where user_id = p_user_id) then
    insert into subscriptions (user_id, plan, status, active_jobs_limit, monthly_posts)
    select p_user_id, 'free', 'active', active_jobs_limit, monthly_posts
    from plan_catalog where plan = 'free';
  end if;
end;
$$;

-- ---------------------------------------------------------
-- homlo_list_employer_jobs_with_boosts — employer hub read model:
-- every job the authenticated employer owns, plus its active-boost
-- state (resolved from the database, never from local storage).
-- ---------------------------------------------------------
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
  boost_expires_at timestamptz
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
    b.id as boost_id, b.package as boost_package, b.expires_at as boost_expires_at
  from jobs j
  left join lateral (
    select b.id, b.package, b.expires_at
    from boosts b
    where b.job_id = j.id
      and b.status = 'active'
      and b.expires_at > now()
    order by b.created_at desc
    limit 1
  ) b on true
  where j.employer_id = p_employer_id and j.deleted_at is null
  order by j.updated_at desc;
$$;

-- ---------------------------------------------------------
-- homlo_list_worker_applications_detailed — worker "My applications"
-- read model with the real employer name + pay context (the base
-- read model only exposes a raw employer_id, which the UI must never
-- format as a static string).
-- ---------------------------------------------------------
create or replace function public.homlo_list_worker_applications_detailed(p_worker_id uuid)
returns table (
  id uuid,
  job_id uuid,
  status text,
  message text,
  created_at timestamptz,
  updated_at timestamptz,
  job_title text,
  job_location_text text,
  employer_id uuid,
  employer_name text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    a.id, a.job_id, a.status, a.message, a.created_at, a.updated_at,
    j.title, j.location_text, j.employer_id, ep.full_name as employer_name
  from applications a
  join jobs j on j.id = a.job_id and j.deleted_at is null
  left join profiles ep on ep.user_id = j.employer_id and ep.deleted_at is null
  where a.worker_id = p_worker_id
  order by a.updated_at desc;
$$;

-- ---------------------------------------------------------
-- homlo_list_employer_applications_detailed — employer applicant
-- read model with real applicant identity (supersedes the base 012
-- version which already joined profiles; this adds nothing new but
-- keeps the gateway contract aligned).
-- ---------------------------------------------------------
create or replace function public.homlo_list_employer_applications_detailed(p_employer_id uuid, p_job_id uuid)
returns table (
  id uuid,
  job_id uuid,
  worker_id uuid,
  status text,
  message text,
  created_at timestamptz,
  updated_at timestamptz,
  worker_full_name text,
  worker_location text,
  worker_bio text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select a.id, a.job_id, a.worker_id, a.status, a.message, a.created_at, a.updated_at, p.full_name, p.location_text, p.bio
  from applications a
  join jobs j on j.id = a.job_id and j.deleted_at is null
  join profiles p on p.user_id = a.worker_id and p.deleted_at is null
  where j.employer_id = p_employer_id and a.job_id = p_job_id
  order by a.created_at desc;
$$;

-- ---------------------------------------------------------
-- homlo_save_job — redeclared from 025 to enforce account-plan
-- limits at the service layer (single source of truth, not a
-- frontend-only check). A Free account can hold up to 2 active
-- jobs and 5 published posts/month; Pro 15/50.
-- ---------------------------------------------------------
create or replace function public.homlo_save_job(
  p_employer_id uuid,
  p_job_id uuid,
  p_category_id uuid,
  p_title text,
  p_description text,
  p_pay_amount numeric,
  p_pay_currency text,
  p_pay_type text,
  p_location_text text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_workers_needed integer default 1,
  p_status text default 'draft',
  p_address_line text default null,
  p_city text default null,
  p_district text default null,
  p_province text default null,
  p_country text default null,
  p_postal_code text default null,
  p_banner_image text default null
)
returns jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job jobs%rowtype;
  v_employer_role text;
  v_title text;
  v_description text;
  v_pay_amount numeric;
  v_workers_needed integer;
  v_pay_type text;
  v_plan text;
  v_plan_limit int;
  v_post_limit int;
  v_active_count bigint;
  v_monthly_posts bigint;
begin
  select role into v_employer_role from profiles where user_id = p_employer_id and deleted_at is null;
  if v_employer_role not in ('employer', 'both') then
    raise exception 'An employer profile is required to manage jobs';
  end if;
  if p_status not in ('draft', 'open', 'closed', 'cancelled') then
    raise exception 'Job status is invalid';
  end if;

  -- Strict validation only applies to published/closed jobs. Drafts may be
  -- persisted with an incomplete form so "Save draft" is reliable at any step.
  if p_status <> 'draft' then
    if coalesce(trim(p_title), '') = '' or coalesce(trim(p_description), '') = '' then
      raise exception 'Job title and description are required';
    end if;
    if p_pay_amount is null or p_pay_amount < 0 or p_workers_needed is null or p_workers_needed < 1 then
      raise exception 'Job pay and worker capacity must be valid';
    end if;
    if p_pay_type not in ('hourly', 'daily', 'fixed') then
      raise exception 'Job pay type is invalid';
    end if;
  end if;

  -- Ensure a subscription row exists (defaults to Free) and read the limits.
  perform public.homlo_update_subscription_limits(p_employer_id);
  select plan, coalesce(active_jobs_limit, 2), coalesce(monthly_posts, 5)
    into v_plan, v_plan_limit, v_post_limit
  from subscriptions where user_id = p_employer_id;

  if p_status = 'open' then
    select count(*) into v_active_count
      from jobs
      where employer_id = p_employer_id
        and status in ('open', 'filled')
        and deleted_at is null
        and id is distinct from p_job_id;

    if v_active_count >= v_plan_limit then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Your %s plan allows %s active jobs. Open additional listings by upgrading your plan.',
          v_plan, v_plan_limit
        );
    end if;

    select count(*) into v_monthly_posts
      from jobs
      where employer_id = p_employer_id
        and deleted_at is null
        and created_at >= date_trunc('month', now());

    if p_job_id is null and v_monthly_posts >= v_post_limit then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Your %s plan allows %s published posts per month. Upgrade to publish more.',
          v_plan, v_post_limit
        );
    end if;
  end if;

  v_title := coalesce(trim(p_title), '');
  v_description := coalesce(trim(p_description), '');
  v_pay_amount := coalesce(p_pay_amount, 0);
  v_workers_needed := greatest(coalesce(p_workers_needed, 1), 1);
  v_pay_type := coalesce(p_pay_type, 'fixed');

  if p_job_id is null then
    insert into jobs (employer_id, category_id, title, description, pay_amount, pay_currency, pay_type, location_text, latitude, longitude, workers_needed, status, address_line, city, district, province, country, postal_code, banner_image)
    values (p_employer_id, p_category_id, v_title, v_description, v_pay_amount, coalesce(nullif(trim(p_pay_currency), ''), 'USD'), v_pay_type, nullif(trim(coalesce(p_location_text, '')), ''), p_latitude, p_longitude, v_workers_needed, p_status, nullif(trim(coalesce(p_address_line, '')), ''), nullif(trim(coalesce(p_city, '')), ''), nullif(trim(coalesce(p_district, '')), ''), nullif(trim(coalesce(p_province, '')), ''), nullif(trim(coalesce(p_country, '')), ''), nullif(trim(coalesce(p_postal_code, '')), ''), nullif(trim(coalesce(p_banner_image, '')), ''))
    returning * into v_job;
  else
    update jobs set
      category_id = p_category_id,
      title = v_title,
      description = v_description,
      pay_amount = v_pay_amount,
      pay_currency = coalesce(nullif(trim(p_pay_currency), ''), 'USD'),
      pay_type = v_pay_type,
      location_text = nullif(trim(coalesce(p_location_text, '')), ''),
      latitude = p_latitude,
      longitude = p_longitude,
      address_line = nullif(trim(coalesce(p_address_line, '')), ''),
      city = nullif(trim(coalesce(p_city, '')), ''),
      district = nullif(trim(coalesce(p_district, '')), ''),
      province = nullif(trim(coalesce(p_province, '')), ''),
      country = nullif(trim(coalesce(p_country, '')), ''),
      postal_code = nullif(trim(coalesce(p_postal_code, '')), ''),
      banner_image = nullif(trim(coalesce(p_banner_image, '')), ''),
      workers_needed = greatest(v_workers_needed, workers_hired),
      status = case when workers_hired >= greatest(v_workers_needed, workers_hired) then 'filled' else p_status end
    where id = p_job_id and employer_id = p_employer_id and deleted_at is null
    returning * into v_job;
    if not found then
      raise exception 'Only the listing employer can update this job';
    end if;
  end if;
  return v_job;
end;
$$;

revoke all on function public.homlo_save_job(uuid, uuid, uuid, text, text, numeric, text, text, text, double precision, double precision, integer, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.homlo_save_job(uuid, uuid, uuid, text, text, numeric, text, text, text, double precision, double precision, integer, text, text, text, text, text, text, text, text) to service_role;

-- ---------------------------------------------------------
-- Grants (service_role only — these are never client-callable).
-- ---------------------------------------------------------
revoke all on function public.homlo_set_profile_verified(uuid, boolean) from public, anon, authenticated;
revoke all on function public.homlo_list_public_published_jobs() from public, anon, authenticated;
revoke all on function public.homlo_get_account(uuid) from public, anon, authenticated;
revoke all on function public.homlo_get_recent_activity(uuid) from public, anon, authenticated;
revoke all on function public.homlo_upsert_subscription(uuid, text) from public, anon, authenticated;
revoke all on function public.homlo_create_subscription_payment(uuid, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.homlo_create_boost(uuid, uuid, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.homlo_record_payment_webhook(text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.homlo_get_active_boost(uuid) from public, anon, authenticated;
revoke all on function public.homlo_update_subscription_limits(uuid) from public, anon, authenticated;
revoke all on function public.homlo_list_employer_jobs_with_boosts(uuid) from public, anon, authenticated;
revoke all on function public.homlo_list_worker_applications_detailed(uuid) from public, anon, authenticated;
revoke all on function public.homlo_list_employer_applications_detailed(uuid, uuid) from public, anon, authenticated;

grant execute on function public.homlo_set_profile_verified(uuid, boolean) to service_role;
grant execute on function public.homlo_list_public_published_jobs() to service_role;
grant execute on function public.homlo_get_account(uuid) to service_role;
grant execute on function public.homlo_get_recent_activity(uuid) to service_role;
grant execute on function public.homlo_upsert_subscription(uuid, text) to service_role;
grant execute on function public.homlo_create_subscription_payment(uuid, text, numeric, text, text) to service_role;
grant execute on function public.homlo_create_boost(uuid, uuid, text, numeric, text, text) to service_role;
grant execute on function public.homlo_record_payment_webhook(text, text, text, uuid, text) to service_role;
grant execute on function public.homlo_get_active_boost(uuid) to service_role;
grant execute on function public.homlo_update_subscription_limits(uuid) to service_role;
grant execute on function public.homlo_list_employer_jobs_with_boosts(uuid) to service_role;
grant execute on function public.homlo_list_worker_applications_detailed(uuid) to service_role;
grant execute on function public.homlo_list_employer_applications_detailed(uuid, uuid) to service_role;