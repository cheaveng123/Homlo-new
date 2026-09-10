-- =========================================================
-- 021_jobs_geography.sql
-- Add PostGIS geography support to jobs.job location for geographic
-- candidate retrieval (ST_DWithin / GIST).
--
-- Adds a nullable geography(Point, 4326) column alongside the existing
-- latitude/longitude columns. Existing columns are NOT modified
-- destructively; the new column is backfilled once from current lat/lng
-- values. A later-phase aggregation/trigger may keep it in sync.
-- =========================================================

alter table jobs add column if not exists location geography(Point, 4326);

-- Backfill geography from existing lat/lng (only where both are present).
update jobs
set location = st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
where latitude is not null and longitude is not null;

-- GIST index for radius (ST_DWithin) lookups.
create index if not exists idx_jobs_location_geog on jobs using gist (location);
