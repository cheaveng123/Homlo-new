-- =========================================================
-- 050_conversation_pair_reuse.sql
--
-- Purpose: stop creating a new conversation when the same two
-- users already have one, even when the new conversation comes
-- from a different job/application. Existing duplicate
-- conversations are left untouched (no delete, no merge).
--
-- What it does NOT do:
--   * does not remove or consolidate any existing row;
--   * does not add a unique index on pair_key (duplicates still
--     exist in this step; pair dedup is a later step 051);
--   * does not redefine the inbox list or message list functions;
--   * does not change RLS or authorization;
--   * leaves the existing per-application uniqueness index intact.
--
-- Apply order: after 049_worker_application_job_context.sql,
-- before 051.
--
-- WARNING: before applying, compare the live definitions of
-- homlo_send_message and homlo_get_or_create_conversation
-- (pg_get_functiondef) with the versions this file replaces
-- (backend/database/migrations/028_messaging_direct.sql). If they
-- differ, merge the differences first.
-- =========================================================

begin;

-- ------------------------------------------------------------------
-- 1. messages.application_id -- referenced by 048 but never created
--    in the repo. Adding it makes the repo consistent and is a
--    no-op if the column already exists live.
-- ------------------------------------------------------------------
alter table public.messages
  add column if not exists application_id uuid
    references public.applications(id) on delete set null;

create index if not exists idx_messages_application_id
  on public.messages (application_id);

-- ------------------------------------------------------------------
-- 2. conversations.context_application_id (non-unique). Records
--    which application/job a reused pair conversation is currently
--    associated with, so messages can show the right job context.
-- ------------------------------------------------------------------
alter table public.conversations
  add column if not exists context_application_id uuid
    references public.applications(id) on delete set null;

-- ------------------------------------------------------------------
-- 3. Backfill messages.application_id from the conversation's
--    application_id where the message's is null. Never overwrite
--    a non-null value.
-- ------------------------------------------------------------------
update public.messages m
set application_id = c.application_id
from public.conversations c
where c.id = m.conversation_id
  and m.application_id is null;

-- ------------------------------------------------------------------
-- 4. conversations.pair_key — sorted pair of the two member ids
--    (least:greatest), unordered so the same two users match
--    even if their roles differ between jobs. Backfilled for
--    existing conversations with exactly two members. No unique
--    index here; duplicates still exist (dedup is step 051).
-- ------------------------------------------------------------------
alter table public.conversations
  add column if not exists pair_key text;

update public.conversations c
set pair_key = pc.pair_key
from (
  select distinct cm.conversation_id,
         least(cm.user_id::text, cm2.user_id::text) || ':' ||
         greatest(cm.user_id::text, cm2.user_id::text) as pair_key
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
  and c.pair_key is null;

-- ------------------------------------------------------------------
-- 5. homlo_get_or_create_conversation — same signature and
--    authorization checks as 028:199-248. Now looks up an
--    existing non-deleted conversation by pair_key (most recent
--    last_message_at wins) and reuses it; only inserts when none
--    exists. Advisory lock keyed on pair_key prevents concurrent
--    duplicate inserts. The existing per-application uniqueness
--    index is left intact.
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
  v_pair_key text;
  v_existing_conversation_id uuid;
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

  v_pair_key := least(v_app.worker_id::text, v_job.employer_id::text) || ':' ||
                greatest(v_app.worker_id::text, v_job.employer_id::text);

  -- Advisory lock keyed on pair_key serializes concurrent callers
  -- for the same pair so only one can insert.
  perform pg_advisory_xact_lock(hashtext(v_pair_key)::bigint);

  -- Reuse an existing non-deleted conversation for the pair.
  select c.id into v_existing_conversation_id
  from conversations c
  where c.pair_key = v_pair_key
    and c.deleted_at is null
  order by c.last_message_at desc nulls last
  limit 1;

  if v_existing_conversation_id is not null then
    update conversations
    set context_application_id = p_application_id,
        last_message_at = now()
    where id = v_existing_conversation_id
    returning * into v_conversation;
    return v_conversation;
  end if;

  insert into conversations (
    application_id, job_id, last_message_at, pair_key, context_application_id
  )
  values (v_app.id, v_app.job_id, now(), v_pair_key, p_application_id)
  returning * into v_conversation;

  -- Ensure both members exist (idempotent).
  insert into conversation_members (conversation_id, user_id)
  values (v_conversation.id, v_app.worker_id), (v_conversation.id, v_job.employer_id)
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation;
end;
$$;

-- ------------------------------------------------------------------
-- 6. homlo_send_message — same signature and membership/blocked
--    checks as 028:257-319. Only change: sets messages.application_id
--    from the conversation's context_application_id (falling back to
--    application_id) so job context survives a future merge.
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

  insert into messages (
    conversation_id, sender_id, message, message_type, updated_at,
    application_id
  )
  values (
    v_conversation.id, p_sender_id, v_text, 'text', now(),
    coalesce(v_conversation.context_application_id, v_conversation.application_id)
  )
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

commit;
