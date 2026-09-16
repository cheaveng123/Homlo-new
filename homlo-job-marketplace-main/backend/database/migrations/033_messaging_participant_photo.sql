-- =========================================================
-- 033_messaging_participant_photo.sql
-- Include the conversation partner's profile photo so the
-- inbox list and the message thread can render the account
-- owner's avatar instead of a bare initials circle.
-- Recreated homlo_list_conversations from 030 with the added
-- other_user_photo column; grants are re-asserted below.
-- =========================================================

drop function if exists public.homlo_list_conversations(uuid);

create or replace function public.homlo_list_conversations(
  p_user_id uuid
)
returns table (
  conversation_id uuid,
  application_id uuid,
  job_id uuid,
  job_title text,
  other_user_id uuid,
  other_user_name text,
  other_user_photo text,
  last_message_at timestamptz,
  last_message text,
  last_message_author uuid,
  unread_count bigint,
  application_status text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select
    c.id,
    c.application_id,
    c.job_id,
    coalesce(j.title, '')::text,
    om.user_id,
    coalesce(p.full_name, 'Homlo user')::text,
    coalesce(p.profile_photo_key, null)::text,
    c.last_message_at,
    lm.message,
    lm.sender_id,
    (
      select count(*)
      from messages xm
      join conversation_members xc
        on xc.conversation_id = xm.conversation_id
       and xc.user_id = p_user_id
      where xm.conversation_id = c.id
        and xm.sender_id <> p_user_id
        and (xc.last_read_at is null or xm.created_at > xc.last_read_at)
        and not exists (
          select 1 from message_hidden_for xh
          where xh.message_id = xm.id and xh.user_id = p_user_id
        )
    )::bigint,
    app.status::text
  from conversations c
  join conversation_members me
    on me.conversation_id = c.id
   and me.user_id = p_user_id
  left join conversation_members om
    on om.conversation_id = c.id
   and om.user_id <> p_user_id
  left join profiles p on p.user_id = om.user_id
  left join jobs j on j.id = c.job_id
  left join applications app on app.id = c.application_id
  left join lateral (
    select m.message, m.sender_id
    from messages m
    where m.conversation_id = c.id
      and m.deleted_at is null
      and not exists (
        select 1 from message_hidden_for hh
        where hh.message_id = m.id and hh.user_id = p_user_id
      )
    order by m.created_at desc
    limit 1
  ) lm on true
  where c.deleted_at is null
    and (me.blocked_at is null or om.user_id is null)
  order by (c.last_message_at is null) asc, c.last_message_at desc;
end;
$$;

revoke all on function public.homlo_list_conversations(uuid) from public, anon, authenticated;
grant execute on function public.homlo_list_conversations(uuid) to service_role;