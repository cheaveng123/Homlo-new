-- Revoke write-type privileges that anon/authenticated held on views and
-- stats tables, and all privileges on two tables with no known public-key use.
--
-- ALREADY APPLIED to the live project on 2026-11-10 via the SQL Editor (no
-- backup export was taken first). Verified afterwards with has_table_privilege:
-- sel = true and ins/upd/del/trunc = false for the views and stats tables;
-- everything false for job_events_anon and profile_photo_key_backup.
-- Kept in the repo so the migration history matches the live database.
-- Safe to re-run: REVOKE is repeatable.
--
-- NOT covered here: public.spatial_ref_sys (owned by supabase_admin, RLS off).

begin;

-- Views: keep SELECT, remove all write-type privileges.
revoke insert, update, delete, truncate, references, trigger
  on public.public_profiles, public.feed_eligible_jobs
  from anon, authenticated;

-- Stats tables: keep SELECT (their read policy stays), remove writes and TRUNCATE.
revoke insert, update, delete, truncate, references, trigger
  on public.job_stats, public.job_stats_global
  from anon, authenticated;

-- No policies and no known public-key use: remove everything.
revoke all on public.job_events_anon, public.profile_photo_key_backup
  from anon, authenticated;

commit;
