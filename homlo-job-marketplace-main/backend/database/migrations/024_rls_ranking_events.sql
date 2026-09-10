-- =========================================================
-- 024_rls_ranking_events.sql
-- Enable row-level security (zero policies) on the ranking/event tables.
--
-- Context: these tables are only ever touched by the server-mediated pipeline —
-- ranking reads, event logging, quality aggregation, and boosts all run through
-- the service role (which bypasses RLS). The Supabase bootstrap enabled RLS on
-- core user tables out-of-band; these ranking tables were created by direct
-- migrations (007/018/019/020) and carried no policies, so their protection had
-- to be stated explicitly here.
--
-- Policies: zero. RLS with no policy is "deny all" for anon/authenticated;
-- service_role continues to bypass it (Supabase grants BYPASSRLS), so no server
-- code needs changes. No FORCE ROW LEVEL SECURITY is set, so the service-role
-- path is unaffected while anonymous/authenticated clients receive no rows and
-- cannot write.
-- =========================================================

alter table public.boosts enable row level security;
alter table public.job_events enable row level security;
alter table public.job_quality_stats enable row level security;
alter table public.employer_quality_stats enable row level security;