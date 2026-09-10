-- =========================================================
-- 011_revoke_rls_helper_role_execution.sql
-- The helper retained explicit role grants after the public
-- revoke. Remove direct RPC execution for API roles while
-- preserving internal database use.
-- =========================================================

revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
