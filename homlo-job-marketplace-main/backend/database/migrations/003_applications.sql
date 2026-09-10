-- =========================================================
-- 003_applications.sql
-- Applications are lifecycle/state-machine records, not soft-deleted.
-- A worker withdrawing = a status transition to 'withdrawn', not a
-- deleted row. One row per (job, worker) forever — re-applying after
-- withdrawing updates the existing row's status rather than inserting
-- a new one.
-- =========================================================

create table applications (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  worker_id   uuid not null references profiles(user_id) on delete cascade,

  status      text not null default 'applied'
                check (status in ('applied', 'reviewed', 'interview', 'hired', 'declined', 'withdrawn')),
  message     text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (job_id, worker_id)
);

create trigger trg_applications_updated_at
  before update on applications
  for each row execute function set_updated_at();

create index idx_applications_job on applications (job_id);
create index idx_applications_worker on applications (worker_id);
create index idx_applications_status on applications (status);
