-- =========================================================
-- 002_categories_jobs.sql
-- Job listings: categories (lookup), jobs, job_media
-- =========================================================

create table categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique,
  slug  text not null unique
);

create table jobs (
  id              uuid primary key default gen_random_uuid(),
  employer_id     uuid not null references profiles(user_id) on delete cascade,
  category_id     uuid references categories(id) on delete set null,

  title           text not null,
  description     text not null,

  pay_amount      numeric(10, 2) not null,
  pay_currency    text not null default 'USD',
  pay_type        text not null check (pay_type in ('hourly', 'daily', 'fixed')),

  location_text   text,
  latitude        double precision,
  longitude       double precision,

  start_date      date,
  end_date        date,
  start_time      time,
  end_time        time,

  workers_needed  int not null default 1,
  workers_hired   int not null default 0,

  status          text not null default 'open'
                    check (status in ('draft', 'open', 'filled', 'closed', 'expired', 'cancelled')),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create trigger trg_jobs_updated_at
  before update on jobs
  for each row execute function set_updated_at();

-- Indexes for the queries that matter from day one: browse by status,
-- filter by category/location, sort employer's own listings.
create index idx_jobs_status on jobs (status) where deleted_at is null;
create index idx_jobs_employer on jobs (employer_id) where deleted_at is null;
create index idx_jobs_category on jobs (category_id) where deleted_at is null;
create index idx_jobs_location on jobs (latitude, longitude) where deleted_at is null;
create index idx_jobs_start_date on jobs (start_date) where deleted_at is null;

-- ---------------------------------------------------------
-- job_media — photos/videos attached to a listing.
-- Storage key, not a URL — the storage adapter resolves it.
-- ---------------------------------------------------------
create table job_media (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  storage_key  text not null,
  media_type   text not null check (media_type in ('image', 'video')),
  position     int not null default 0,
  created_at   timestamptz not null default now()
);

create index idx_job_media_job on job_media (job_id, position);
