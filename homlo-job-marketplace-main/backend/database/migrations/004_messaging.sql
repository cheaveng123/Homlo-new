-- =========================================================
-- 004_messaging.sql
-- conversations / conversation_members / messages / message_hidden_for
--
-- Deliberately not sender_id/receiver_id on messages — the
-- conversation + members model supports future multi-party threads
-- (worker + employer + agency) without a redesign.
--
-- job_id on conversations is nullable so Homlo can start with
-- job-specific conversations and add general (non-job) messaging
-- later with no migration.
--
-- Message deletion is per-user ("hide for me"), not a shared
-- deleted_at — a worker hiding a message must never affect what the
-- employer sees. "Delete for everyone" is a separate future feature.
-- =========================================================

create table conversations (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid references jobs(id) on delete set null,
  last_message_at timestamptz,          -- denormalized: fast inbox sort without a join

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create trigger trg_conversations_updated_at
  before update on conversations
  for each row execute function set_updated_at();

create index idx_conversations_job on conversations (job_id) where deleted_at is null;
create index idx_conversations_last_message on conversations (last_message_at desc) where deleted_at is null;

create table conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references profiles(user_id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index idx_conversation_members_user on conversation_members (user_id);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(user_id) on delete cascade,
  message         text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_messages_conversation_time on messages (conversation_id, created_at);

-- Per-user hide, not a shared delete.
create table message_hidden_for (
  message_id  uuid not null references messages(id) on delete cascade,
  user_id     uuid not null references profiles(user_id) on delete cascade,
  hidden_at   timestamptz not null default now(),
  primary key (message_id, user_id)
);
