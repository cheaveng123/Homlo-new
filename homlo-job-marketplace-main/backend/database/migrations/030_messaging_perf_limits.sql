-- =========================================================
-- 030_messaging_perf_limits.sql
-- Performance + connection-status message limits for messaging.
--
-- Three changes:
--  * homlo_list_conversations now also returns application_status
--    (one LEFT JOIN on applications) so the client can show the
--    connection state / enforce message limits without an extra
--    round-trip. The RETURNS TABLE gained a column, so the old
--    function is DROPPED and recreated (create-or-replace cannot
--    change a return type).
--  * homlo_list_messages gained a p_limit argument (default 500).
--    It returns the LATEST p_limit messages that satisfy the
--    before/hidden filters, still ordered oldest->newest, so the
--    chat screen can paginate instead of downloading the entire
--    history every time. p_limit changes the argument list, so the
--    old 3-arg overload is DROPPED first (no ambiguous overloads).
--  * homlo_send_message enforces connection-based limits: an
--    application with status = 'hired' is a confirmed connection and
--    allows full 4000-character messages; anything else is limited
--    to 160 characters until the connection is confirmed. The
--    signature is unchanged, so create or replace is safe here.
-- =========================================================

-- ---------------------------------------------------------
-- 1. List conversations now carries application_status.
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- 2. List messages now accepts a page limit (latest N first).
-- ---------------------------------------------------------
drop function if exists public.homlo_list_messages(uuid, uuid, timestamptz);

create or replace function public.homlo_list_messages(
  p_conversation_id uuid,
  p_user_id uuid,
  p_before timestamptz default null,
  p_limit int default 500
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  message text,
  message_type text,
  read_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.homlo_is_conversation_member(p_conversation_id, p_user_id) then
    return;
  end if;

  return query
  select * from (
    select m.id, m.conversation_id, m.sender_id, m.message, m.message_type,
           m.read_at, m.created_at, m.updated_at, m.deleted_at
    from messages m
    where m.conversation_id = p_conversation_id
      and (p_before is null or m.created_at < p_before)
      and m.deleted_at is null
      and not exists (
        select 1 from message_hidden_for mh
        where mh.message_id = m.id and mh.user_id = p_user_id
      )
    order by m.created_at desc
    limit p_limit
  ) t
  order by t.created_at asc;
end;
$$;

-- ---------------------------------------------------------
-- 3. Send message enforces connection-status message limits.
--    A hired application = confirmed connection = full 4000 chars.
--    Otherwise limited to 160 chars until confirmed.
-- ---------------------------------------------------------
create or replace function public.homlo_send_message(
  p_conversation_id uuid,
  p_sender_id uuid,
  p_message text
)
returns messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conversation conversations%rowtype;
  v_recipient uuid;
  v_message messages%rowtype;
  v_text text;
  v_app_status text;
begin
  select * into v_conversation
  from conversations
  where id = p_conversation_id and deleted_at is null
  for update;
  if not found then
    raise exception 'Conversation not found';
  end if;

  if not public.homlo_is_conversation_member(v_conversation.id, p_sender_id) then
    raise exception 'You are not a member of this conversation';
  end if;
  if public.homlo_is_blocked(v_conversation.id, p_sender_id) then
    raise exception 'You cannot send messages in this conversation';
  end if;

  v_text := nullif(trim(p_message), '');
  if v_text is null then
    raise exception 'Message cannot be empty';
  end if;

  select a.status into v_app_status
  from applications a
  join conversations c on c.id = v_conversation.id
  where a.id = c.application_id;

  -- Confirmed connection (application hired) unlocks full-length
  -- messages; otherwise the pre-confirmation cap is 160 characters.
  if coalesce(v_app_status, '') = 'hired' then
    if length(v_text) > 4000 then
      raise exception 'Message is too long';
    end if;
  elsif length(v_text) > 160 then
    raise exception 'Messages are limited to 160 characters until the application is confirmed';
  end if;

  insert into messages (conversation_id, sender_id, message, message_type, updated_at)
  values (v_conversation.id, p_sender_id, v_text, 'text', now())
  returning * into v_message;

  update conversations
    set last_message_at = now()
  where id = v_conversation.id;

  -- Notify the other participant (only if not blocked by them).
  select cm.user_id into v_recipient
  from conversation_members cm
  where cm.conversation_id = v_conversation.id
    and cm.user_id <> p_sender_id
    and cm.blocked_at is null
  limit 1;

  if v_recipient is not null then
    insert into notifications (user_id, type, title, body)
    values (v_recipient, 'message', 'New message', 'You have a new message.');
  end if;

  return v_message;
end;
$$;

-- ---------------------------------------------------------
-- Grants — service role only, matching 028. Drop/recreate
-- wipes prior grants, so they are re-asserted for the new
-- signatures here.
-- ---------------------------------------------------------
revoke all on function public.homlo_list_conversations(uuid) from public, anon, authenticated;
grant execute on function public.homlo_list_conversations(uuid) to service_role;

revoke all on function public.homlo_list_messages(uuid, uuid, timestamptz, int) from public, anon, authenticated;
grant execute on function public.homlo_list_messages(uuid, uuid, timestamptz, int) to service_role;

revoke all on function public.homlo_send_message(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.homlo_send_message(uuid, uuid, text) to service_role;