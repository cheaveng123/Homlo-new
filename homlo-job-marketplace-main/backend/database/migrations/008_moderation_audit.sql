-- =========================================================
-- 008_moderation_audit.sql
-- reports (user-submitted moderation flags) and audit_logs
-- (system-recorded event trail for every important marketplace action).
-- =========================================================

create table reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references profiles(user_id) on delete cascade,

  target_type  text not null check (target_type in ('job', 'user', 'review', 'message')),
  target_id    uuid not null,

  reason       text not null,
  details      text,

  status       text not null default 'open'
                 check (status in ('open', 'reviewed', 'dismissed', 'actioned')),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_reports_updated_at
  before update on reports
  for each row execute function set_updated_at();

create index idx_reports_status on reports (status);
create index idx_reports_target on reports (target_type, target_id);

-- ---------------------------------------------------------
-- audit_logs — append-only. No updated_at/deleted_at: an audit
-- record should never be edited or removed by application code.
-- ---------------------------------------------------------
create table audit_logs (
  id              uuid primary key default gen_random_uuid(),
  actor_user_id   uuid references users(id) on delete set null,  -- null = system action
  action          text not null,       -- e.g. 'job.created', 'application.hired', 'boost.activated'
  entity_type     text not null,
  entity_id       uuid,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index idx_audit_logs_entity on audit_logs (entity_type, entity_id);
create index idx_audit_logs_actor on audit_logs (actor_user_id);
create index idx_audit_logs_created on audit_logs (created_at desc);
