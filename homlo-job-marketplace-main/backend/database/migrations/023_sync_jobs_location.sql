-- =========================================================
-- 023_sync_jobs_location.sql
-- Keep jobs.location (geography, added in 021) in sync with the nullable
-- latitude/longitude columns at write time.
--
-- Problem: homlo_save_job (012) inserts/updates latitude/longitude but never
-- populates the geography column, so jobs saved AFTER migration 021 have a NULL
-- location and never appear in the geo/general candidate-retrieval sources
-- (which only consider j.location IS NOT NULL). Migration 021 only backfilled
-- rows existing at migration time.
--
-- This BEFORE trigger captures inserts and updates of latitude/longitude and
-- derives the geography column exactly like the 021 backfill, so every future
-- job saved through homlo_save_job (or any other writer) is immediately
-- eligible for geographic retrieval. Duplicate writes are idempotent
-- (same expression as the planner's own geocoding path).
-- =========================================================

create or replace function public.homlo_sync_jobs_location()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.location := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  else
    new.location := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_homlo_jobs_location_sync on jobs;
create trigger trg_homlo_jobs_location_sync
  before insert or update of latitude, longitude on jobs
  for each row execute function public.homlo_sync_jobs_location();

-- Backfill any rows written between 021 and this migration (idempotent).
update jobs
set location = st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
where latitude is not null and longitude is not null and location is null;