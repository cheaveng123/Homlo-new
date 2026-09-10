-- =========================================================
-- 018_job_events.sql
-- Append-only interaction event log feeding the recommendation/
-- ranking system. Events are immutable historical facts: there is NO
-- updated_at / deleted_at column and no UPDATE/DELETE path. Rows are
-- only ever inserted, then read for aggregates and future ML feature
-- extraction.
--
-- employer_id is denormalized here so employer-level stats can be
-- computed from this table alone without joining jobs.
-- =========================================================

create table job_events (
  id                     bigint generated always as identity primary key,

  event_type             text not null check (event_type in (
                           'impression', 'click', 'view', 'save', 'unsave',
                           'share', 'apply_started', 'apply_submitted',
                           'apply_withdrawn', 'hide', 'not_interested', 'report'
                         )),

  user_id                uuid references users(id) on delete set null,
  job_id                 uuid not null references jobs(id) on delete cascade,
  employer_id            uuid not null references profiles(user_id) on delete cascade,
  session_id             uuid,

  occurred_at            timestamptz not null default now(),
  feed_position          int,
  feed_context           text,   -- e.g. 'home_feed' | 'search' | 'category_browse' | 'saved'
  shown_as_sponsored     boolean not null default false,
  shown_as_exploration   boolean not null default false,

  ranking_score_snapshot jsonb,  -- component scores at serve time, for debugging / ML reuse

  user_lat               double precision,
  user_lng               double precision,
  distance_km_at_event   double precision,
  device_id              text,
  ip_hash                text,   -- digest only (e.g. SHA-256); NEVER store a raw IP
  dwell_time_ms          int     -- populated for 'view' events
);

-- Query paths used by the ranking/aggregation layer.
create index idx_job_events_job_type_time     on job_events (job_id, event_type, occurred_at);
create index idx_job_events_user_time         on job_events (user_id, occurred_at);
create index idx_job_events_employer_type_time on job_events (employer_id, event_type, occurred_at);
