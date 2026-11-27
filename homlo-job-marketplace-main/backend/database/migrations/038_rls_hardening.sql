-- =========================================================
-- 038_rls_hardening.sql
-- Complete RLS security audit pass for Homlo.
--
-- Summary of the audit (verified live on the linked project):
--  * Every app table in `public` already has RLS enabled
--    (only the PostGIS metadata table spatial_ref_sys is off,
--    owned by supabase_admin — intentionally left untouched).
--  * BUT Supabase's default privileges grant anon + authenticated
--    ALL (incl. INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER) on every
--    public table, and EXECUTE on every public function. The
--    tables are secured only by the RLS policies below; the grants
--    are a foot-gun and are what the Dashboard Security Advisor
--    flags as "unsafe grants / Data API writable tables".
--    This migration minimizes them to the absolute minimum the
--    React Native app needs.
--  * The client (RN app) only ever touches the database through:
--      - Realtime SELECTs on messaging tables (RLS-driven) with the
--        user's access token,
--      - public storage URLs,
--      - service-role RPCs (SECURITY DEFINER) via the tRPC gateway.
--    So anon needs ZERO table grants, authenticated needs SELECT on
--    the four messaging tables only, and NO client-facing RPCs are
--    required — policies read only homlo_current_user_id().
--  * Security holes closed:
--      1. homlo_is_conversation_member(uuid,uuid) and
--         homlo_is_blocked(uuid,uuid) were EXECUTE-granted to
--         anon+authenticated SECURITY DEFINER helpers that accept an
--         arbitrary (conversation_id, user_id) — an IDOR
--         (conversation-membership / block-state enumeration) via the
--         Data API. Now service_role only.
--      2. homlo_sync_jobs_location() (trigger-only) was callable by
--         clients. Now service_role/owner only.
--      3. message_hidden_for had RLS enabled but ZERO policies, so the
--         messages SELECT policy's `not exists(message_hidden_for ...
--         )` subquery could never see a row — "hide message for me"
--         was silently not enforced at RLS time. An own-rows SELECT
--         policy is added so the filter works for realtime readers.
--  * RLS is never FORCEd: the SECURITY DEFINER service functions run
--    as table owner (postgres) and must keep bypassing RLS.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Re-assert RLS on every app table (idempotent; also guards any
--    table that future work might create before this runs).
--    No FORCE ROW LEVEL SECURITY — it would break the SECURITY
--    DEFINER service functions.
-- ---------------------------------------------------------
alter table public.users enable row level security;
alter table public.user_identities enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.jobs enable row level security;
alter table public.job_media enable row level security;
alter table public.applications enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_hidden_for enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.boosts enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.job_events enable row level security;
alter table public.employer_quality_stats enable row level security;
alter table public.job_quality_stats enable row level security;
alter table public.subscriptions enable row level security;
alter table public.plan_catalog enable row level security;

-- ---------------------------------------------------------
-- 2. Revoke the Supabase-default broad grants from the client roles.
--    anon: no table access at all (public browsing is served by the
--          service-role edge function).
--    authenticated: table access is (re)granted minimally below.
-- ---------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- ---------------------------------------------------------
-- 3. Minimal regrants for the RN client.
--    Realtime postgres_changes subscripres as `authenticated` and
--    evaluates the RLS SELECT policies, which read each other's rows
--    via subqueries and homlo_current_user_id().
-- ---------------------------------------------------------
grant select on public.conversations, public.conversation_members, public.messages, public.message_hidden_for to authenticated;

-- homlo_current_user_id() is the ONLY function the RLS policies (and
-- therefore realtime reads) depend on. Revoke the PUBLIC default so
-- anon cannot execute it directly, then regrant authenticated.
revoke all on function public.homlo_current_user_id() from public, anon;
grant execute on function public.homlo_current_user_id() to authenticated;

-- ---------------------------------------------------------
-- 4. service_role keeps full server-side access (the tRPC gateway
--    and edge functions call the SECURITY DEFINER RPCs with it).
--    Re-asserted here so the state is reproducible in one file.
-- ---------------------------------------------------------
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------
-- 5. Scope the messaging SELECT policies to `authenticated` only
--    (anon must not evaluate them), keeping their exact quals.
-- ---------------------------------------------------------
drop policy if exists "conversation is visible to members" on public.conversations;
create policy "conversation is visible to members"
  on public.conversations for select to authenticated
  using (
    exists (
      select 1 from conversation_members cm
      where cm.conversation_id = conversations.id
        and cm.user_id = public.homlo_current_user_id()
        and cm.blocked_at is null
    )
  );

drop policy if exists "member row visible to the member" on public.conversation_members;
create policy "member row visible to the member"
  on public.conversation_members for select to authenticated
  using (user_id = public.homlo_current_user_id());

drop policy if exists "message visible to members" on public.messages;
create policy "message visible to members"
  on public.messages for select to authenticated
  using (
    not exists (
      select 1 from conversation_members cm
      where cm.conversation_id = messages.conversation_id
        and cm.user_id = public.homlo_current_user_id()
        and cm.blocked_at is not null
    )
    and exists (
      select 1 from conversation_members cm
      where cm.conversation_id = messages.conversation_id
        and cm.user_id = public.homlo_current_user_id()
    )
    and (
      messages.deleted_at is null
      or not exists (
        select 1 from message_hidden_for mh
        where mh.message_id = messages.id
          and mh.user_id = public.homlo_current_user_id()
      )
    )
  );

-- ---------------------------------------------------------
-- 6. Fix "hide message for me": the messages policy above can only
--    apply its message_hidden_for filter if the current reader may
--    SELECT their OWN hide rows. (Before this, message_hidden_for
--    had no policies -> deny-all -> the filter never matched.)
--    The policy is own-rows only; INSERT/UPDATE/DELETE on the table
--    stay deny-by-default for clients (the service RPC handles it).
-- ---------------------------------------------------------
drop policy if exists "own hide marks visible to the hider" on public.message_hidden_for;
create policy "own hide marks visible to the hider"
  on public.message_hidden_for for select to authenticated
  using (user_id = public.homlo_current_user_id());

-- ---------------------------------------------------------
-- 7. Close the IDOR / Client-side-function exposures.
--    homlo_is_conversation_member / homlo_is_blocked take an
--    ARBITRARY user_id (SECURITY DEFINER) and were callable by any
--    anon or authenticated client to enumerate anyone's conversation
--    membership / block state through the Data API. homlo_sync_jobs_
--    location is a trigger-only helper. All are now service_role
--    (owner) only; the policies never invoke them.
-- ---------------------------------------------------------
revoke all on function public.homlo_is_conversation_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.homlo_is_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function public.homlo_sync_jobs_location() from public, anon, authenticated;
grant execute on function public.homlo_is_conversation_member(uuid, uuid) to service_role;
grant execute on function public.homlo_is_blocked(uuid, uuid) to service_role;
grant execute on function public.homlo_sync_jobs_location() to service_role;