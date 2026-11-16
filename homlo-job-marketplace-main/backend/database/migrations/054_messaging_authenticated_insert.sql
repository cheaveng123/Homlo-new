-- 054_messaging_authenticated_insert.sql
-- Allow signed-in members to insert plain-text messages through the Data API.
--
-- 038_rls_hardening intentionally left messaging writes to the service-role
-- gateway, so `authenticated` only had SELECT grants/policies. This migration
-- adds the narrow client write path requested for the Messages screen while
-- keeping every row scoped to the caller and their conversation membership.
--
-- The gateway remains the primary write path. This policy is a defense-in-depth
-- fallback and is intentionally limited to text messages.

grant insert (conversation_id, sender_id, message, message_type, application_id)
  on table public.messages to authenticated;

drop policy if exists "members can insert their own messages" on public.messages;
create policy "members can insert their own messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = public.homlo_current_user_id()
    and message_type = 'text'
    and exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id
        and cm.user_id = public.homlo_current_user_id()
        and cm.blocked_at is null
    )
  );
