-- =========================================================
-- 017_ranking_extensions.sql
-- Enable the extensions the recommendation/ranking system needs:
--   - postgis : geographic candidate retrieval (ST_DWithin / GIST)
--   - pg_cron : scheduled refresh of the aggregate quality stats
--               tables (implemented in a later phase)
-- =========================================================

-- ------------------------------------------------------------------
-- postgis
-- Available on Supabase and can be enabled via SQL. Like the other
-- Homlo extensions (pgcrypto, pg_trgm), it is created in the default
-- (public) schema so its types (geography, geometry, ST_*) are
-- reachable unqualified from migrations and RPC search_paths.
--
-- NOTE: Supabase officially recommends installing PostGIS into a
-- dedicated schema (e.g. the built-in "extensions" or a "gis" schema)
-- rather than public, and it cannot be relocated after creation.
-- If postgis already exists only in another schema on this project
-- (e.g. enabled earlier via the Dashboard), a Relocation to public is a
-- manual/dashboard action; the "if not exists" below then becomes a
-- no-op and the geography type can be referenced as extensions.geography.
-- ------------------------------------------------------------------
create extension if not exists postgis;

-- ------------------------------------------------------------------
-- pg_cron
-- Supabase historically requires pg_cron to be enabled through the
-- Dashboard (Database -> Extensions, or the Integrations -> Cron module)
-- rather than a plain SQL extension statement, because enabling it
-- provisions the postgres-owned "cron" schema and its objects. The
-- recommended SQL form is included below; if it fails because the cron
-- schema is missing or lacks the expected owner/privileges, enable it
-- via the Dashboard first — this migration then becomes a no-op.
-- ------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
