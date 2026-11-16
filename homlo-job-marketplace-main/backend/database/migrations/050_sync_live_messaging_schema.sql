-- =========================================================
-- 050_sync_live_messaging_schema.sql
--
-- Syncs the repository messaging schema to the live database.
-- Production already enforces one canonical live conversation
-- per employer-worker pair via conversations.user_low / user_high
-- and a unique index on the non-deleted pair, and
-- homlo_get_or_create_conversation reuses an existing pair
-- conversation instead of inserting a duplicate.
--
-- The repository migrations (004-049) never created
-- messages.application_id, yet 048's message-list function reads
-- m.application_id at run time (plpgsql defers column validation).
-- This migration adds that column so 048's function is consistent
-- with the schema, and adds the pair columns + unique index so the
-- repo matches live.
--
-- What it does NOT do:
--   * does not delete or merge any existing row (no conversation
--     dedup here; duplicates remain until a later step);
--   * does not redefine the inbox or message-list functions;
--   * does not change RLS or authorization;
--   * leaves the existing per-application uniqueness index intact;
--   * does not add a DELETE trigger on applications.
--
-- Apply order: after 049_worker_application_job_context.sql.
-- Idempotent: add column if not exists, create index if not exists,
-- create or replace function, harmless backfills. Wrapped in a
-- transaction so a failure changes nothing.
--
-- WARNING: before applying, back up the four messaging tables
-- (conversations, conversation_members, messages, message_hidden_for)
-- and compare the live definitions of homlo_get_or_create_conversation
-- and homlo_send_message (pg_get_functiondef) with 028/030; merge any
-- differences before running.
-- =========================================================

begin;

-- ------------------------------------------------------------------
-- 1. messages.application_id -- referenced by 048's
--    message-list function (048:21) but never created by any repo
--    migration. Adding it makes the repo consistent with live and
--    is a no-op if the column already exists.
-- ------------------------------------------------------------------
alter table public.messages
  add column if not exists application_id uuid
    references public.applications(id) on delete set null;

create index if not exists idx_messages_application_id
  on public.messages (application_id);

-- ------------------------------------------------------------------
-- 2. conversations.user_low / user_high -- sorted pair of the two
--    member ids, unordered so the same two users match regardless of
--    who applied to which job. Mirrors the live schema.
-- ------------------------------------------------------------------
alter table public.conversations
  add column if not exists user_low uuid;

alter table public.conversations
  add column if not exists user_high uuid;

-- ------------------------------------------------------------------
-- 3. Unique index on the live pair for non-deleted conversations --
--    Matches production index name: conversations_pair_unique.
--    one canonical live conversation per employer-worker pair.
-- ------------------------------------------------------------------
create unique index if not exists conversations_pair_unique
  on public.conversations (user_low, user_high)
  where deleted_at is null
    and user_low is not null
    and user_high is not null;

-- ------------------------------------------------------------------
-- 4. Backfill user_low / user_high for existing conversations that
--    have exactly two members. Harmless to re-run (null guard).
-- ------------------------------------------------------------------
update public.conversations c
set user_low = pc.user_low,
    user_high = pc.user_high
from (
  select distinct cm.conversation_id,
         least(cm.user_id, cm2.user_id) as user_low,
         greatest(cm.user_id, cm2.user_id) as user_high
  from public.conversation_members cm
  join public.conversation_members cm2
    on cm2.conversation_id = cm.conversation_id
   and cm2.user_id > cm.user_id
  where (
    select count(*) from public.conversation_members cm3
    where cm3.conversation_id = cm.conversation_id
  ) = 2
) pc
where c.id = pc.conversation_id
  and (c.user_low is null or c.user_high is null);

-- ------------------------------------------------------------------
-- 5. Backfill messages.application_id from the conversation's
--    application_id where the message's is null. Never overwrite a
--    non-null value, so existing message context is preserved.
-- ------------------------------------------------------------------
update public.messages m
set application_id = c.application_id
from public.conversations c
where c.id = m.conversation_id
  and m.application_id is null;

-- ------------------------------------------------------------------
-- 6. homlo_get_or_create_conversation -- same signature and
--    authorization checks as 028:199-248. Now looks up an existing
--    non-deleted conversation by pair (user_low/user_high, most
--    recent last_message_at wins) and reuses it; only inserts when
--    none exists. Advisory lock keyed on the pair prevents
--    concurrent duplicate inserts. The existing per-application
--    uniqueness index is left intact.
-- ------------------------------------------------------------------
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
  v_user_low uuid;
  v_user_high uuid;
  v_existing_id uuid;
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

  v_user_low := least(v_app.worker_id, v_job.employer_id);
  v_user_high := greatest(v_app.worker_id, v_job.employer_id);

  -- Advisory lock keyed on the pair serializes concurrent callers so
  -- only one can insert a new conversation for the pair.
  perform pg_advisory_xact_lock(
    ('x' || substr(md5(v_user_low::text || ':' || v_user_high::text), 1, 15))::bit(60)::bigint
  );

  -- Reuse an existing non-deleted conversation for the pair.
  select c.id into v_existing_id
  from conversations c
  where c.user_low = v_user_low
    and c.user_high = v_user_high
    and c.deleted_at is null
  order by c.last_message_at desc nulls last
  limit 1;

  if v_existing_id is not null then
    select * into v_conversation
    from conversations
    where id = v_existing_id;
    return v_conversation;
  end if;

  insert into conversations (
    application_id, job_id, last_message_at, user_low, user_high
  )
  values (v_app.id, v_app.job_id, now(), v_user_low, v_user_high)
  returning * into v_conversation;

  -- Ensure both members exist (idempotent).
  insert into conversation_members (conversation_id, user_id)
  values (v_conversation.id, v_app.worker_id), (v_conversation.id, v_job.employer_id)
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation;
end;
$$;

-- ------------------------------------------------------------------
-- 7. homlo_send_message -- same signature and membership/blocked
--    checks as 030:162-237 (preserves the hired-connection length
--    limit). Only change: writes messages.application_id from the
--    conversation's application_id so job context survives reuse.
-- ------------------------------------------------------------------
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
  where a.id = v_conversation.application_id;

  if coalesce(v_app_status, '') = 'hired' then
    if length(v_text) > 4000 then
      raise exception 'Message is too long';
    end if;
  elsif length(v_text) > 160 then
    raise exception 'Messages are limited to 160 characters until the application is confirmed';
  end if;

  insert into messages (
    conversation_id, sender_id, message, message_type, updated_at, application_id
  )
  values (
    v_conversation.id, p_sender_id, v_text, 'text', now(),
    v_conversation.application_id
  )
  returning * into v_message;

  update conversations
    set last_message_at = now()
  where id = v_conversation.id;

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

-- ------------------------------------------------------------------
-- 8. Re-assert grants for the two redefined functions (create or
--    replace wipes prior grants), matching 028/030 convention.
-- ------------------------------------------------------------------
revoke all on function public.homlo_get_or_create_conversation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.homlo_get_or_create_conversation(uuid, uuid) to service_role;

revoke all on function public.homlo_send_message(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.homlo_send_message(uuid, uuid, text) to service_role;

commit;
