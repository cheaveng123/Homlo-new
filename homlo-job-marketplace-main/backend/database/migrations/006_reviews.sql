-- =========================================================
-- 006_reviews.sql
-- Soft-deleted (disputes/moderation may need the history), so the
-- uniqueness guard is a partial index, not a table constraint —
-- otherwise a removed review would permanently block a legitimate
-- re-review of the same job/reviewer/reviewee triple.
-- =========================================================

create table reviews (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  reviewer_id  uuid not null references profiles(user_id) on delete cascade,
  reviewee_id  uuid not null references profiles(user_id) on delete cascade,
  rating       int not null check (rating between 1 and 5),
  comment      text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create trigger trg_reviews_updated_at
  before update on reviews
  for each row execute function set_updated_at();

create unique index uq_reviews_active
  on reviews (job_id, reviewer_id, reviewee_id)
  where deleted_at is null;

create index idx_reviews_reviewee on reviews (reviewee_id) where deleted_at is null;
