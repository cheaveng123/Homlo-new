-- =========================================================
-- 005_saved_jobs_notifications.sql
-- saved_jobs is intentionally hard-delete: "unsave" just removes the
-- row. There's no auditing/history value in keeping tombstoned saves,
-- so a plain unique constraint (not a partial index) is enough here.
-- =========================================================

create table saved_jobs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(user_id) on delete cascade,
  job_id      uuid not null references jobs(id) on delete cascade,
  created_at  timestamptz not null default now(),

  unique (user_id, job_id)
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(user_id) on delete cascade,
  type        text not null,   -- e.g. 'new_application', 'message', 'job_status_change'
  title       text not null,
  body        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index idx_notifications_user_unread on notifications (user_id, read, created_at desc);
