-- =========================================================
-- 037_fix_notification_title_not_null.sql
-- Repair: 036's notify_user / maybe_auto_close_job inserted into
-- notifications (user_id, type, job_id, application_id) WITHOUT a
-- title, but the table (005) declares title NOT NULL. That raised a
-- not-null violation inside the trg_application_status_change trigger,
-- so accepted/declined/job-fill notifications were never written (and
-- the status change itself rolled back).
--
-- This migration only recreates the two broken functions with a
-- non-null title (and null body, since the client formats fallbacks).
-- It is idempotent: running it again after 036 is already applied
-- is a no-op change.
-- =========================================================

create or replace function public.notify_user(
  p_user_id uuid,
  p_type text,
  p_job_id uuid,
  p_application_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into notifications (user_id, type, title, body, job_id, application_id)
  values (
    p_user_id,
    p_type,
    case p_type
      when 'application_accepted' then 'Application accepted'
      when 'application_declined' then 'Application update'
      when 'job_filled' then 'Job filled'
      else 'Application update'
    end,
    null,
    p_job_id,
    p_application_id
  );
end;
$$;

revoke all on function public.notify_user(uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.notify_user(uuid, text, uuid, uuid) to service_role;

create or replace function public.maybe_auto_close_job(p_job_id uuid) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job jobs%rowtype;
  v_hired_count int;
begin
  select * into v_job
  from jobs
  where id = p_job_id
  for update;

  if v_job.status is null or v_job.status <> 'open' or not coalesce(v_job.auto_close_enabled, true) then
    return;
  end if;

  select count(*) into v_hired_count
  from applications
  where job_id = p_job_id and status = 'hired';

  if v_hired_count >= v_job.workers_needed then
    update jobs set status = 'filled' where id = p_job_id;

    insert into notifications (user_id, type, title, body, job_id, application_id)
    select worker_id, 'job_filled', 'Job filled', null, job_id, id
    from applications
    where job_id = p_job_id
      and status in ('applied', 'reviewed', 'interview');
  end if;
end;
$$;

revoke all on function public.maybe_auto_close_job(uuid) from public, anon, authenticated;
grant execute on function public.maybe_auto_close_job(uuid) to service_role;