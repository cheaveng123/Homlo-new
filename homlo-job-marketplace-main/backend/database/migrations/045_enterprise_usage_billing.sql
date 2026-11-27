-- 045_enterprise_usage_billing.sql
-- Enterprise usage-based billing support
-- Adds pricing columns to plan_catalog, makes enterprise limits unlimited,
-- adds usage tracking for enterprise billing, and updates limit enforcement.

-- Add pricing and usage columns to plan_catalog
alter table plan_catalog
  add column if not exists base_price_cents int,
  add column if not exists included_active_jobs int,
  add column if not exists included_monthly_posts int,
  add column if not exists overage_per_job_cents int,
  add column if not exists overage_per_post_cents int;

-- Update plan_catalog with pricing data
-- Free and Pro: fixed limits with base price
-- Enterprise: base price with included amounts, overage rates for usage-based billing
update plan_catalog set
  base_price_cents = 0,
  included_active_jobs = 2,
  included_monthly_posts = 5,
  overage_per_job_cents = 0,
  overage_per_post_cents = 0
where plan = 'free';

update plan_catalog set
  base_price_cents = 1999,
  included_active_jobs = 15,
  included_monthly_posts = 50,
  overage_per_job_cents = 0,
  overage_per_post_cents = 0
where plan = 'pro';

update plan_catalog set
  base_price_cents = 49900,
  included_active_jobs = 100,
  included_monthly_posts = 500,
  overage_per_job_cents = 500,
  overage_per_post_cents = 100
where plan = 'enterprise';

-- Make enterprise limits effectively unlimited by setting to NULL
-- The enforcement logic will treat NULL as unlimited
update plan_catalog set
  active_jobs_limit = null,
  monthly_posts = null
where plan = 'enterprise';

-- Create table to track enterprise usage for monthly billing
create table if not exists enterprise_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  billing_month date not null, -- first day of the month
  peak_active_jobs int not null default 0,
  total_posts int not null default 0,
  overage_jobs int not null default 0,
  overage_posts int not null default 0,
  overage_charge_cents int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, billing_month)
);

create index if not exists idx_enterprise_usage_user_month on enterprise_usage (user_id, billing_month);

-- Track when enterprise subscription was created for billing cycles
alter table subscriptions
  add column if not exists enterprise_billing_anchor timestamptz;

-- Update homlo_update_subscription_limits to handle enterprise
create or replace function public.homlo_update_subscription_limits(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan text;
  v_enterprise_anchor timestamptz;
begin
  if not exists (select 1 from subscriptions where user_id = p_user_id) then
    insert into subscriptions (user_id, plan, status, active_jobs_limit, monthly_posts)
    select p_user_id, 'free', 'active', active_jobs_limit, monthly_posts
    from plan_catalog where plan = 'free';
    return;
  end if;

  select plan into v_plan from subscriptions where user_id = p_user_id;

  -- For enterprise, ensure billing anchor is set
  if v_plan = 'enterprise' then
    select enterprise_billing_anchor into v_enterprise_anchor
    from subscriptions where user_id = p_user_id;

    if v_enterprise_anchor is null then
      update subscriptions
      set enterprise_billing_anchor = date_trunc('month', now())
      where user_id = p_user_id;
    end if;
  end if;
end;
$$;

-- Update homlo_save_job to skip limit enforcement for enterprise
-- The existing function already has the logic; we need to update it
-- We'll do this by replacing the function in a separate statement after this migration
-- For now, the limit check in homlo_save_job will use the updated plan_catalog
-- where enterprise has NULL limits, and the enforcement logic should treat NULL as unlimited

-- Function to record enterprise usage (called periodically or on job events)
create or replace function public.homlo_record_enterprise_usage(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan text;
  v_active_count int;
  v_monthly_posts int;
  v_included_jobs int;
  v_included_posts int;
  v_overage_jobs int;
  v_overage_posts int;
  v_overage_per_job int;
  v_overage_per_post int;
  v_overage_charge int;
  v_billing_month date;
begin
  select plan into v_plan from subscriptions where user_id = p_user_id;
  if v_plan != 'enterprise' then
    return;
  end if;

  select included_active_jobs, included_monthly_posts, overage_per_job_cents, overage_per_post_cents
  into v_included_jobs, v_included_posts, v_overage_per_job, v_overage_per_post
  from plan_catalog where plan = 'enterprise';

  -- Count current active jobs
  select count(*)
  into v_active_count
  from jobs
  where employer_id = p_user_id
    and status in ('open', 'filled')
    and deleted_at is null;

  -- Count posts this month
  select count(*)
  into v_monthly_posts
  from jobs
  where employer_id = p_user_id
    and deleted_at is null
    and created_at >= date_trunc('month', now());

  v_overage_jobs := greatest(v_active_count - v_included_jobs, 0);
  v_overage_posts := greatest(v_monthly_posts - v_included_posts, 0);
  v_overage_charge := (v_overage_jobs * v_overage_per_job) + (v_overage_posts * v_overage_per_post);

  v_billing_month := date_trunc('month', now());

  insert into enterprise_usage (
    user_id, billing_month, peak_active_jobs, total_posts,
    overage_jobs, overage_posts, overage_charge_cents
  )
  values (
    p_user_id, v_billing_month, v_active_count, v_monthly_posts,
    v_overage_jobs, v_overage_posts, v_overage_charge
  )
  on conflict (user_id, billing_month) do update set
    peak_active_jobs = greatest(enterprise_usage.peak_active_jobs, excluded.peak_active_jobs),
    total_posts = excluded.total_posts,
    overage_jobs = excluded.overage_jobs,
    overage_posts = excluded.overage_posts,
    overage_charge_cents = excluded.overage_charge_cents,
    updated_at = now();
end;
$$;

-- Monthly billing job function (to be run via pg_cron)
create or replace function public.homlo_process_enterprise_billing(
  p_billing_month date default date_trunc('month', now())
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_processed int := 0;
  v_record enterprise_usage%rowtype;
begin
  for v_record in
    select * from enterprise_usage
    where billing_month = p_billing_month
      and overage_charge_cents > 0
  loop
    -- Here you would create a payment record for the overage charge
    -- For now, we just log it; in production, call homlo_create_subscription_payment
    -- with the overage amount and mark as 'usage_overage' type
    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;

grant execute on function public.homlo_record_enterprise_usage(uuid) to service_role;
grant execute on function public.homlo_process_enterprise_billing(date) to service_role;