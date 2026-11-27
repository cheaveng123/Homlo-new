alter table public.jobs
  add column if not exists limit_exempt boolean not null default false;
alter table public.jobs
  add column if not exists published_at timestamptz;

update public.jobs
   set limit_exempt = true
 where limit_exempt = false;

update public.jobs
   set published_at = coalesce(published_at, created_at)
 where status = 'open'
   and published_at is null;

create table if not exists public.account_subscriptions (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  active_jobs_limit int,
  monthly_post_limit int,
  current_period_start timestamptz not null default date_trunc('month', now()),
  current_period_end timestamptz not null default date_trunc('month', now()) + interval '1 month',
  free_standard_boost_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_account_subscriptions_period
  on public.account_subscriptions (current_period_end);

create table if not exists public.job_post_events (
  id bigserial primary key,
  employer_id uuid not null references public.profiles(user_id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  event_type text not null check (event_type in ('published', 'republished')),
  billing_period_start date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_job_post_events_employer_period
  on public.job_post_events (employer_id, billing_period_start);
create index if not exists idx_job_post_events_job
  on public.job_post_events (job_id);

create table if not exists public.boost_packages (
  id text primary key,
  name text not null,
  price_cents int not null check (price_cents >= 0),
  pro_price_cents int not null check (pro_price_cents >= 0),
  duration_days int not null check (duration_days > 0),
  multiplier numeric(5, 3) not null check (multiplier >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.boost_packages
  (id, name, price_cents, pro_price_cents, duration_days, multiplier)
values
  ('starter', 'Starter', 299, 249, 3, 1.04),
  ('local', 'Local', 699, 599, 5, 1.06),
  ('standard', 'Standard', 999, 799, 7, 1.08),
  ('urgent', 'Urgent Hire', 1499, 1199, 3, 1.10),
  ('strong', 'Strong', 1999, 1599, 7, 1.12),
  ('maximum', 'Maximum', 3999, 3199, 14, 1.15)
on conflict (id) do update
  set name = excluded.name,
      price_cents = excluded.price_cents,
      pro_price_cents = excluded.pro_price_cents,
      duration_days = excluded.duration_days,
      multiplier = excluded.multiplier,
      active = true,
      updated_at = now();

create table if not exists public.job_boosts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  employer_id uuid not null references public.profiles(user_id) on delete cascade,
  package_id text not null references public.boost_packages(id),
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'cancelled')),
  price_cents int not null check (price_cents >= 0),
  currency text not null default 'USD',
  payment_id text,
  purchased_at timestamptz not null default now(),
  starts_at timestamptz,
  ends_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_boosts_job on public.job_boosts (job_id);
create index if not exists idx_job_boosts_employer on public.job_boosts (employer_id);
create index if not exists idx_job_boosts_active_window
  on public.job_boosts (starts_at, ends_at)
  where status = 'active';
create unique index if not exists uq_job_boosts_one_live_per_job
  on public.job_boosts (job_id)
  where status in ('pending', 'active');
create unique index if not exists uq_job_boosts_payment
  on public.job_boosts (payment_id)
  where payment_id is not null;

alter table public.account_subscriptions enable row level security;
alter table public.job_post_events enable row level security;
alter table public.boost_packages enable row level security;
alter table public.job_boosts enable row level security;

revoke all on public.account_subscriptions from anon, authenticated;
revoke all on public.job_post_events from anon, authenticated;
revoke all on public.boost_packages from anon, authenticated;
revoke all on public.job_boosts from anon, authenticated;

grant select, insert, update, delete on public.account_subscriptions to service_role;
grant select, insert, update, delete on public.job_post_events to service_role;
grant select, insert, update, delete on public.boost_packages to service_role;
grant select, insert, update, delete on public.job_boosts to service_role;
grant usage, select on sequence public.job_post_events_id_seq to service_role;
