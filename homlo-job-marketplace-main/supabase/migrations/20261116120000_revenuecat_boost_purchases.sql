-- Homlo Jobs: RevenueCat one-time boost purchases.
-- A RevenueCat product buys exactly one boost for one job. The client creates a
-- pending intent first; the webhook matches the event to that intent and then
-- activates the existing public.boosts lifecycle row. Safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.revenuecat_boost_purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_token uuid not null default gen_random_uuid() unique,
  user_id uuid references public.profiles(user_id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  plan_id text references public.boost_packages(id),
  product_id text not null,
  rc_app_user_id text,
  rc_original_app_user_id text,
  rc_event_id text unique,
  rc_transaction_id text unique,
  status text not null default 'pending'
    check (status in ('pending', 'purchased', 'activated', 'failed', 'refunded', 'unmatched')),
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'USD',
  purchased_at timestamptz,
  activated_at timestamptz,
  boost_id uuid references public.boosts(id) on delete set null,
  failure_reason text,
  raw_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists revenuecat_boost_purchases_user_created_idx
  on public.revenuecat_boost_purchases (user_id, created_at desc);

create index if not exists revenuecat_boost_purchases_pending_match_idx
  on public.revenuecat_boost_purchases (user_id, product_id, created_at desc)
  where status = 'pending';

create index if not exists revenuecat_boost_purchases_job_idx
  on public.revenuecat_boost_purchases (job_id, created_at desc);

create index if not exists revenuecat_boost_purchases_status_idx
  on public.revenuecat_boost_purchases (status, created_at desc);

drop trigger if exists trg_revenuecat_boost_purchases_updated_at
  on public.revenuecat_boost_purchases;
create trigger trg_revenuecat_boost_purchases_updated_at
  before update on public.revenuecat_boost_purchases
  for each row execute function set_updated_at();

alter table public.revenuecat_boost_purchases enable row level security;

revoke all on public.revenuecat_boost_purchases from anon, authenticated;
grant select, insert, update, delete on public.revenuecat_boost_purchases to service_role;
