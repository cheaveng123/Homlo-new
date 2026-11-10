-- Enterprise usage billing, hardened replacement for the unapplied
-- backend/database/migrations/045_enterprise_usage_billing.sql.
-- Differences from 045: RLS and revokes on the new table and functions,
-- the table references profiles(user_id), no NULL "unlimited" update
-- (those columns are NOT NULL and homlo_save_job already skips enterprise),
-- homlo_update_subscription_limits is not replaced, and a missing
-- subscription row no longer reaches the usage insert.

begin;

alter table public.plan_catalog
  add column if not exists included_active_jobs int,
  add column if not exists included_monthly_posts int,
  add column if not exists overage_per_job_cents int,
  add column if not exists overage_per_post_cents int;

update public.plan_catalog set
  included_active_jobs = 2,
  included_monthly_posts = 5,
  overage_per_job_cents = 0,
  overage_per_post_cents = 0
where plan = 'free';

update public.plan_catalog set
  included_active_jobs = 15,
  included_monthly_posts = 50,
  overage_per_job_cents = 0,
  overage_per_post_cents = 0
where plan = 'pro';

update public.plan_catalog set
  included_active_jobs = 100,
  included_monthly_posts = 500,
  overage_per_job_cents = 500,
  overage_per_post_cents = 100
where plan = 'enterprise';

create table if not exists public.enterprise_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  billing_month date not null, -- first day of the month
  peak_active_jobs int not null default 0 check (peak_active_jobs >= 0),
  total_posts int not null default 0 check (total_posts >= 0),
  overage_jobs int not null default 0 check (overage_jobs >= 0),
  overage_posts int not null default 0 check (overage_posts >= 0),
  overage_charge_cents int not null default 0 check (overage_charge_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, billing_month)
);

alter table public.enterprise_usage enable row level security;
revoke all on table public.enterprise_usage from PUBLIC, anon, authenticated;

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
  -- is distinct from: a user with no subscription row has a NULL plan
  if v_plan is distinct from 'enterprise' then
    return;
  end if;

  select included_active_jobs, included_monthly_posts, overage_per_job_cents, overage_per_post_cents
  into v_included_jobs, v_included_posts, v_overage_per_job, v_overage_per_post
  from plan_catalog where plan = 'enterprise';

  select count(*) into v_active_count
  from jobs
  where employer_id = p_user_id
    and status in ('open', 'filled')
    and deleted_at is null;

  select count(*) into v_monthly_posts
  from jobs
  where employer_id = p_user_id
    and deleted_at is null
    and created_at >= date_trunc('month', now());

  v_overage_jobs := greatest(v_active_count - v_included_jobs, 0);
  v_overage_posts := greatest(v_monthly_posts - v_included_posts, 0);
  v_overage_charge := (v_overage_jobs * v_overage_per_job) + (v_overage_posts * v_overage_per_post);
  v_billing_month := date_trunc('month', now())::date;

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

-- Counts rows with an overage charge for the month. It does not create any
-- payment yet; no payment provider exists.
create or replace function public.homlo_process_enterprise_billing(
  p_billing_month date default date_trunc('month', now())::date
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_processed int;
begin
  select count(*) into v_processed
  from enterprise_usage
  where billing_month = p_billing_month
    and overage_charge_cents > 0;
  return v_processed;
end;
$$;

revoke all on function public.homlo_record_enterprise_usage(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.homlo_process_enterprise_billing(date) from PUBLIC, anon, authenticated;
grant execute on function public.homlo_record_enterprise_usage(uuid) to service_role;
grant execute on function public.homlo_process_enterprise_billing(date) to service_role;

commit;
