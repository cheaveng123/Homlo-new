-- =========================================================
-- 007_boosts_payments.sql
-- boosts / payments are lifecycle records (no soft delete).
--
-- payment_webhook_events is the idempotency guard: a provider (e.g.
-- ABA PayWay) can redeliver the same event more than once, and this
-- table's UNIQUE(provider, provider_event_id) is what stops a
-- duplicate delivery from activating a boost twice. The backend must
-- process webhooks inside a transaction: insert the event row first;
-- if that insert violates the unique constraint, stop — the event was
-- already handled.
-- =========================================================

create table boosts (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  employer_id uuid not null references profiles(user_id) on delete cascade,
  package     text not null,
  start_at    timestamptz not null,
  expires_at  timestamptz not null,

  status      text not null default 'active'
                check (status in ('active', 'expired', 'cancelled')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_boosts_updated_at
  before update on boosts
  for each row execute function set_updated_at();

create index idx_boosts_job on boosts (job_id);
create index idx_boosts_status on boosts (status);

create table payments (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references profiles(user_id) on delete cascade,
  job_id                  uuid references jobs(id) on delete set null,
  boost_id                uuid references boosts(id) on delete set null,

  amount                  numeric(10, 2) not null,
  currency                text not null default 'USD',
  provider                text not null,             -- e.g. 'aba_payway'
  provider_transaction_id text unique,

  status                  text not null default 'pending'
                            check (status in ('pending', 'completed', 'failed', 'refunded')),

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger trg_payments_updated_at
  before update on payments
  for each row execute function set_updated_at();

create index idx_payments_user on payments (user_id);
create index idx_payments_status on payments (status);

-- ---------------------------------------------------------
-- payment_webhook_events — raw event log + idempotency guard.
-- ---------------------------------------------------------
create table payment_webhook_events (
  id                 uuid primary key default gen_random_uuid(),
  provider            text not null,
  provider_event_id   text not null,
  event_type          text not null,
  payload             jsonb not null,
  received_at         timestamptz not null default now(),
  processed_at        timestamptz,

  unique (provider, provider_event_id)
);

create index idx_webhook_events_unprocessed
  on payment_webhook_events (received_at)
  where processed_at is null;
