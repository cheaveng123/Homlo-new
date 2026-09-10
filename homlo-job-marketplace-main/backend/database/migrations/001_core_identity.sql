-- =========================================================
-- 001_core_identity.sql
-- Core identity layer: users, user_identities, profiles
--
-- Design rule: every other migration references profiles(user_id)
-- or users(id) — never an auth provider's own tables. Identity
-- providers (Supabase Auth, Google, Apple, Cognito, phone, ...) are
-- mapped in via user_identities, so swapping the auth provider never
-- touches jobs/applications/messages/payments/etc.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- shared trigger: keep updated_at current on every UPDATE
-- ---------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------
-- users — the canonical Homlo identity. Nothing else in the
-- schema ever points at an auth provider's user table directly.
-- ---------------------------------------------------------
create table users (
  id          uuid primary key default gen_random_uuid(),
  status      text not null default 'active'
                check (status in ('active', 'suspended', 'banned')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

create index idx_users_status on users (status) where deleted_at is null;

-- ---------------------------------------------------------
-- user_identities — one row per (user, auth provider) link.
-- Supports multiple identities per user (Supabase now, Google/Apple/
-- Cognito later, or several at once) with zero change to any other
-- table when the auth provider changes.
-- ---------------------------------------------------------
create table user_identities (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,

  provider          text not null,   -- 'supabase' | 'google' | 'apple' | 'cognito' | 'phone' | ...
  provider_user_id  text not null,

  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

-- Partial unique index: a soft-deleted identity link can be
-- re-created (e.g. user unlinks then relinks the same Google account)
-- without colliding with its own tombstoned row.
create unique index uq_user_identities_provider_active
  on user_identities (provider, provider_user_id)
  where deleted_at is null;

create index idx_user_identities_user on user_identities (user_id) where deleted_at is null;

-- ---------------------------------------------------------
-- profiles — the marketplace-facing profile. 1:1 with users,
-- so its primary key IS the foreign key (no separate surrogate id).
-- ---------------------------------------------------------
create table profiles (
  user_id           uuid primary key references users(id) on delete cascade,

  role              text not null check (role in ('worker', 'employer', 'both')),
  full_name         text not null,
  phone             text,
  profile_photo_key text,             -- storage key/path, never a full URL
  bio               text,
  location_text     text,
  latitude          double precision,
  longitude         double precision,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create index idx_profiles_role on profiles (role) where deleted_at is null;
