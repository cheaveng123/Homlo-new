-- =========================================================
-- 031_messaging_application_inbox_message.sql
-- When a worker applies for a job, drop a message into the
-- canonical application conversation so the job owner receives
-- an inbox notification they can act on. message_type
-- 'application' lets the client render a "View job" button in
-- the thread that opens the employer's job-management detail
-- page for exactly this posting.
--
-- homlo_submit_application already creates the conversation
-- (028, section 17). This adds the notification message right
-- after, inside the same transaction, so the owner sees both:
--   * the existing notifications-row entry, and
--   * a real inbox message that appears at the top of their
--     Messages list with a preview of the applicant.
-- =========================================================

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
  v_conversation conversations%rowtype;
  v_worker_name text;
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

  select * into v_conversation
  from public.homlo_get_or_create_conversation(p_worker_id, v_application.id);

  if v_application.status = 'applied' then
    insert into notifications (user_id, type, title, body)
    values (v_job.employer_id, 'new_application', 'New application', 'A worker applied to your job.');

    -- Inbox notification for the owner: a real message on the canonical
    -- conversation, authored by the applicant. The client renders a
    -- "View job" button for this message_type and opens /employer/job/[id].
    select coalesce(p.full_name, 'A worker') into v_worker_name
    from profiles p
    where p.user_id = p_worker_id and p.deleted_at is null;

    insert into messages (conversation_id, sender_id, message, message_type, updated_at)
    values (v_conversation.id, p_worker_id,
            coalesce(v_worker_name, 'A worker') || ' applied to your job.', 'application', now())
    on conflict do nothing;

    update conversations
      set last_message_at = now()
    where id = v_conversation.id;
  end if;

  return v_application;
end;
$$;

-- ---------------------------------------------------------
-- Grants: keep the existing service_role-only contract from
-- 012/028 for the recreated function.
-- ---------------------------------------------------------
revoke all on function public.homlo_submit_application(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.homlo_submit_application(uuid, uuid, text) to service_role;