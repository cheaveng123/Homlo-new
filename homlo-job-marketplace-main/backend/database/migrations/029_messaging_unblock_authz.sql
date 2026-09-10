-- ═══════════════════════════════════════════════════════════════════════════
-- 029 — messaging: authorize unblock by conversation membership
--
-- Fixes an authorization gap in 028: homlo_unblock_user accepted only
-- (conversation_id, target_id) and never confirmed the *caller* is a member
-- of the conversation (or that they are not unblocking themselves). Every
-- messaging RPC goes through the gateway (service role), so a service-role
-- caller must carry the authenticated actor id; harden the RPC the same way
-- homlo_block_user already does.
-- ═══════════════════════════════════════════════════════════════════════════

-- 028 released a two-argument homlo_unblock_user(conversation_id, target_id)
-- that never checked the caller. CREATE OR REPLACE cannot rewrite an argument
-- list, so we drop the old overload first, then install the hardened one.
drop function if exists public.homlo_unblock_user(uuid, uuid);

create or replace function public.homlo_unblock_user(
  p_conversation_id uuid,
  p_user_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id = p_target_id then
    raise exception 'You cannot unblock yourself';
  end if;
  if not public.homlo_is_conversation_member(p_conversation_id, p_user_id) then
    raise exception 'You are not a member of this conversation';
  end if;
  if not exists (
    select 1 from conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = p_target_id
      and cm.blocked_at is not null
  ) then
    raise exception 'Target is not blocked in this conversation';
  end if;

  update conversation_members
    set blocked_at = null
  where conversation_id = p_conversation_id
    and user_id = p_target_id;
end;
$$;

revoke all on function public.homlo_unblock_user(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.homlo_unblock_user(uuid, uuid, uuid) to service_role;