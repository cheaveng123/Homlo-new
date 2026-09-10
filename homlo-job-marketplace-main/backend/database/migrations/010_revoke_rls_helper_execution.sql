-- =========================================================
-- 010_revoke_rls_helper_execution.sql
-- Supabase created this SECURITY DEFINER helper while enabling
-- RLS automatically. It does not need to be callable through
-- the public PostgREST RPC surface.
-- =========================================================

revoke execute on function public.rls_auto_enable() from public;
