-- =========================================================
-- 028_messaging_direct.sql
-- Adapts the existing messaging schema (004) into a complete,
-- authorization-enforced conversation system for Homlo.
--
-- Design principles:
--  * One canonical conversation per application: conversations.application_id
--    is UNIQUE, so a worker can never open two threads for the same
--    (job, worker) application, and idempotent get-or-create is guaranteed
--    at the database level.
--  * Participants are enforced (no strangers, no self-messaging). Only the
--    job's employer and the applying worker may be members of the canonical
--    conversation for an application. Message send + membership are checked
--    in SECURITY DEFINER RPCs that the service-role gateway calls — the
--    sender identity is ALWAYS derived server-side and never accepted from
--    the request body.
--  * Per-user hide (message_hidden_for) stays the delete model; we add
--    blocked_at on members so a user can stop receiving from the other
--    participant without mutating anyone else's view.
--  * RLS + Realtime: the client subscribes with the anon key + access
--    token; policies map auth.uid() -> users.id -> profiles.user_id via
--    user_identities so the client can read exactly its own
--    conversations/messages and receive live inserts.
-- =========================================================

-- ---------------------------------------------------------
-- 1. conversations: canonical per application
-- ---------------------------------------------------------
alter table conversations
  add column application_id uuid;

alter table conversations
  add constraint conversations_application_id_fkey
    foreign key (application_id) references applications(id) on delete set null;

-- One canonical conversation per application -> db-level idempotency.
create unique index uq_conversations_application
  on conversations (application_id)
  where application_id is not null;

create index idx_conversations_member_lookup
  on conversation_members (user_id);

-- ---------------------------------------------------------
-- 2. conversation_members: last_read_at + blocked_at
-- ---------------------------------------------------------
alter table conversation_members
  add column last_read_at timestamptz;

alter table conversation_members
  add column blocked_at timestamptz;

create index idx_members_last_read
  on conversation_members (conversation_id) where last_read_at is null;

-- ---------------------------------------------------------
-- 3. messages: message_type + updated_at + deleted_at
-- ---------------------------------------------------------
alter table messages
  add column message_type text not null default 'text'
    check (message_type in ('text', 'application', 'status_change'));

alter table messages
  add column updated_at timestamptz;

alter table messages
  add column deleted_at timestamptz;

-- RLS + Realtime need the full old row to compare author/membership.
alter table messages replica identity full;
alter table conversations replica identity full;

-- ---------------------------------------------------------
-- 4. Realtime publication (INSERT/UPDATE/DELETE on messages +
--    conversations, so the client can live-update both the thread
--    and the inbox last_message_at).
-- ---------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'homlo_messaging') then
    create publication homlo_messaging for table messages, conversations;
  end if;
end $$;

-- ---------------------------------------------------------
-- 5. RLS. Policies map the Supabase JWT identity (auth.uid()) to
--    the Homlo canonical user id via user_identities(provider='supabase').
--    This is the only user-controlled surface; the gateway's
--    SECURITY DEFINER RPCs bypass RLS by design (service role).
-- ---------------------------------------------------------
create or replace function public.homlo_current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ui.user_id
  from user_identities ui
  where ui.provider = 'supabase'
    and ui.provider_user_id = auth.uid()::text
    and ui.deleted_at is null
  limit 1;
$$;

alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;
alter table message_hidden_for enable row level security;

drop policy if exists "conversation is visible to members" on conversations;
create policy "conversation is visible to members"
  on conversations for select
  using (
    exists (
      select 1 from conversation_members cm
      where cm.conversation_id = conversations.id
        and cm.user_id = public.homlo_current_user_id()
        and cm.blocked_at is null
    )
  );

drop policy if exists "member row visible to the member" on conversation_members;
create policy "member row visible to the member"
  on conversation_members for select
  using (user_id = public.homlo_current_user_id());

drop policy if exists "message visible to members" on messages;
create policy "message visible to members"
  on messages for select
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
-- 6. A single helper answers "is this user a member (not blocked)"
--    so the gateway RPCs don't duplicate the check.
-- ---------------------------------------------------------
create or replace function public.homlo_is_conversation_member(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = p_user_id
      and cm.blocked_at is null
  );
$$;

create or replace function public.homlo_is_blocked(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = p_user_id
      and cm.blocked_at is not null
  );
$$;

-- ---------------------------------------------------------
-- 7. Get-or-create the canonical conversation for an application.
--    Idempotent: unique(application_id) + on conflict returns the
--    existing conversation. Authorization: the caller must be either
--    the applying worker or the job's employer, and cannot message self.
-- ---------------------------------------------------------
create or replace function public.homlo_get_or_create_conversation(
  p_actor_id uuid,
  p_application_id uuid
)
returns conversations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app applications%rowtype;
  v_job jobs%rowtype;
  v_conversation conversations%rowtype;
begin
  select * into v_app
  from applications
  where id = p_application_id
  for update;
  if not found then
    raise exception 'Application not found';
  end if;

  select * into v_job
  from jobs
  where id = v_app.job_id and deleted_at is null;
  if not found then
    raise exception 'Job not found';
  end if;

  if p_actor_id not in (v_app.worker_id, v_job.employer_id) then
    raise exception 'Only the applicant or the employer can open this conversation';
  end if;
  if v_job.employer_id = v_app.worker_id then
    raise exception 'A user cannot message themself';
  end if;

  insert into conversations (application_id, job_id, last_message_at)
  values (v_app.id, v_app.job_id, now())
  on conflict (application_id) where application_id is not null
  do update set last_message_at = conversations.last_message_at
  returning * into v_conversation;

  -- Ensure both members exist (idempotent).
  insert into conversation_members (conversation_id, user_id)
  values (v_conversation.id, v_app.worker_id), (v_conversation.id, v_job.employer_id)
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation;
end;
$$;

-- ---------------------------------------------------------
-- 8. Send a message. Authorization enforced here: sender must be a
--    non-blocked member; sender_id always from the p_actor_id argument
--    (which the gateway derives from the verified session). first message
--    seeds last_message_at; creates the unread notification for the
--    recipient.
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
  if length(v_text) > 4000 then
    raise exception 'Message is too long';
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
-- 9. Mark conversation as read (bump last_read_at to now()).
-- ---------------------------------------------------------
create or replace function public.homlo_mark_conversation_read(
  p_conversation_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update conversation_members
    set last_read_at = now()
  where conversation_id = p_conversation_id
    and user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------
-- 10. Mark a single message as read by its recipient.
-- ---------------------------------------------------------
create or replace function public.homlo_mark_message_read(
  p_message_id uuid,
  p_reader_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update messages m
    set read_at = now()
  where m.id = p_message_id
    and exists (
      select 1 from conversation_members cm
      where cm.conversation_id = m.conversation_id
        and cm.user_id = p_reader_id
    );
end;
$$;

-- ---------------------------------------------------------
-- 11. Unread count for the inbox badge (unread messages where the
--     reader is a member and has read_at before created_at).
-- ---------------------------------------------------------
create or replace function public.homlo_get_unread_count(
  p_user_id uuid
)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)
  from messages m
  join conversation_members cm
    on cm.conversation_id = m.conversation_id
   and cm.user_id = p_user_id
   and cm.blocked_at is null
  where m.conversation_id in (
    select conversation_id from conversation_members
    where user_id = p_user_id
  )
  and m.sender_id <> p_user_id
  and (
    cm.last_read_at is null
    or m.created_at > cm.last_read_at
  )
  and not exists (
    select 1 from message_hidden_for mh
    where mh.message_id = m.id and mh.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------
-- 12. List conversations (inbox) for a user, with the other
--     participant's identity, the job title, last message snippet and
--     unread count. Returned as a table (empty result = empty array).
-- ---------------------------------------------------------
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
  unread_count bigint
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
    )::bigint
  from conversations c
  join conversation_members me
    on me.conversation_id = c.id
   and me.user_id = p_user_id
  left join conversation_members om
    on om.conversation_id = c.id
   and om.user_id <> p_user_id
  left join profiles p on p.user_id = om.user_id
  left join jobs j on j.id = c.job_id
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
-- 13. List messages in a conversation for a member, newest last.
--     Hid (message_hidden_for) rows are excluded per-user.
-- ---------------------------------------------------------
create or replace function public.homlo_list_messages(
  p_conversation_id uuid,
  p_user_id uuid,
  p_before timestamptz default null
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
  order by m.created_at asc;
end;
$$;

-- ---------------------------------------------------------
-- 14. Block / unblock another member of a conversation.
-- ---------------------------------------------------------
create or replace function public.homlo_block_user(
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
    raise exception 'You cannot block yourself';
  end if;
  if not public.homlo_is_conversation_member(p_conversation_id, p_user_id) then
    raise exception 'You are not a member of this conversation';
  end if;
  if not public.homlo_is_conversation_member(p_conversation_id, p_target_id) then
    raise exception 'Target is not a member of this conversation';
  end if;

  update conversation_members
    set blocked_at = now()
  where conversation_id = p_conversation_id
    and user_id = p_target_id;
end;
$$;

create or replace function public.homlo_unblock_user(
  p_conversation_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update conversation_members
    set blocked_at = null
  where conversation_id = p_conversation_id
    and user_id = p_target_id;
end;
$$;

-- ---------------------------------------------------------
-- 15. Report a conversation or a message (reuse reports table 008).
-- ---------------------------------------------------------
create or replace function public.homlo_report_conversation(
  p_conversation_id uuid,
  p_reporter_id uuid,
  p_reason text,
  p_details text default null
)
returns reports
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report reports%rowtype;
begin
  if not public.homlo_is_conversation_member(p_conversation_id, p_reporter_id) then
    raise exception 'You are not a member of this conversation';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;

  insert into reports (reporter_id, target_type, target_id, reason, details)
  values (p_reporter_id, 'message', p_conversation_id, trim(p_reason),
          nullif(trim(coalesce(p_details, '')), ''))
  returning * into v_report;
  return v_report;
end;
$$;

create or replace function public.homlo_report_message(
  p_message_id uuid,
  p_reporter_id uuid,
  p_reason text,
  p_details text default null
)
returns reports
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report reports%rowtype;
  v_conversation_id uuid;
begin
  select m.conversation_id into v_conversation_id
  from messages m where m.id = p_message_id;
  if v_conversation_id is null then
    raise exception 'Message not found';
  end if;
  if not public.homlo_is_conversation_member(v_conversation_id, p_reporter_id) then
    raise exception 'You are not a member of this conversation';
  end if;

  insert into reports (reporter_id, target_type, target_id, reason, details)
  values (p_reporter_id, 'message', p_message_id, trim(p_reason),
          nullif(trim(coalesce(p_details, '')), ''))
  returning * into v_report;
  return v_report;
end;
$$;

-- ---------------------------------------------------------
-- 16. Per-user hide of a message ("delete for me").
-- ---------------------------------------------------------
create or replace function public.homlo_hide_message(
  p_message_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conversation_id uuid;
begin
  select m.conversation_id into v_conversation_id
  from messages m where m.id = p_message_id;
  if v_conversation_id is null then
    raise exception 'Message not found';
  end if;
  if not public.homlo_is_conversation_member(v_conversation_id, p_user_id) then
    raise exception 'You are not a member of this conversation';
  end if;

  insert into message_hidden_for (message_id, user_id)
  values (p_message_id, p_user_id)
  on conflict (message_id, user_id) do nothing;
end;
$$;

-- ---------------------------------------------------------
-- 17. Wire canonical-conversation creation into application submit so
--     the canvas/thread is ready as soon as a worker applies. Reuses
--     homlo_get_or_create_conversation inside the same transaction.
-- ---------------------------------------------------------
create or replace function public.homlo_submit_application(
  p_worker_id uuid,
  p_job_id uuid,
  p_message text default null
)
returns applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job jobs%rowtype;
  v_application applications%rowtype;
  v_worker_role text;
  v_app_id uuid;
begin
  if not exists (select 1 from profiles where user_id = p_worker_id and deleted_at is null) then
    insert into profiles (user_id, role, full_name)
    values (p_worker_id, 'worker', 'Worker')
    on conflict (user_id) do nothing;
  end if;

  select role into v_worker_role
  from profiles
  where user_id = p_worker_id and deleted_at is null;
  if v_worker_role not in ('worker', 'both') then
    raise exception 'A worker profile is required to apply';
  end if;

  select * into v_job
  from jobs
  where id = p_job_id and deleted_at is null
  for update;
  if not found or v_job.status <> 'open' or v_job.workers_hired >= v_job.workers_needed then
    raise exception 'This job is no longer accepting applications';
  end if;
  if v_job.employer_id = p_worker_id then
    raise exception 'Employers cannot apply to their own jobs';
  end if;

  insert into applications (job_id, worker_id, status, message)
  values (p_job_id, p_worker_id, 'applied', nullif(trim(coalesce(p_message, '')), ''))
  on conflict (job_id, worker_id) do update set
    status = case when applications.status in ('withdrawn', 'declined') then 'applied' else applications.status end,
    message = case when applications.status in ('withdrawn', 'declined') then excluded.message else applications.message end
  returning * into v_application;

  perform public.homlo_get_or_create_conversation(p_worker_id, v_application.id);

  if v_application.status = 'applied' then
    insert into notifications (user_id, type, title, body)
    values (v_job.employer_id, 'new_application', 'New application', 'A worker applied to your job.');
  end if;

  return v_application;
end;
$$;

-- ---------------------------------------------------------
-- 18. Grants — the service role (gateway) executes all messaging
--     RPCs; the anon/authenticated roles can only run the reconnect
--     helper + rely on RLS for reads. Client never calls the mutating
--     RPCs directly (sender identity is server-derived).
-- ---------------------------------------------------------
revoke all on function public.homlo_get_or_create_conversation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.homlo_get_or_create_conversation(uuid, uuid) to service_role;

revoke all on function public.homlo_send_message(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.homlo_send_message(uuid, uuid, text) to service_role;

revoke all on function public.homlo_mark_conversation_read(uuid, uuid) from public, anon, authenticated;
grant execute on function public.homlo_mark_conversation_read(uuid, uuid) to service_role;

revoke all on function public.homlo_mark_message_read(uuid, uuid) from public, anon, authenticated;
grant execute on function public.homlo_mark_message_read(uuid, uuid) to service_role;

revoke all on function public.homlo_get_unread_count(uuid) from public, anon, authenticated;
grant execute on function public.homlo_get_unread_count(uuid) to service_role;

revoke all on function public.homlo_list_conversations(uuid) from public, anon, authenticated;
grant execute on function public.homlo_list_conversations(uuid) to service_role;

revoke all on function public.homlo_list_messages(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.homlo_list_messages(uuid, uuid, timestamptz) to service_role;

revoke all on function public.homlo_block_user(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.homlo_block_user(uuid, uuid, uuid) to service_role;

revoke all on function public.homlo_unblock_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.homlo_unblock_user(uuid, uuid) to service_role;

revoke all on function public.homlo_report_conversation(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.homlo_report_conversation(uuid, uuid, text, text) to service_role;

revoke all on function public.homlo_report_message(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.homlo_report_message(uuid, uuid, text, text) to service_role;

revoke all on function public.homlo_hide_message(uuid, uuid) from public, anon, authenticated;
grant execute on function public.homlo_hide_message(uuid, uuid) to service_role;