-- =========================================================
-- 039_direct_accept_from_applied.sql
-- Allow an employer to accept (hire) an applicant directly from
-- a "probably imported" status without forcing them through the
-- applied → reviewed → interview → hired funnel first.
--
-- The new Job Management screen's big mint "Accept" button maps
-- to applications.changeStatus({ status: 'hired' }). Accepted
-- applications arrive in the 'applied' state, so the previous
-- constraint (`status <> 'interview'`) rejected them server-side.
--
-- This recreates homlo_change_application_status (012 / 036)
-- with an expanded hired branch: 'applied', 'reviewed' and
-- 'interview' may all be accepted directly. Everything else
-- (owner check, capacity guard gated on auto_close_enabled,
-- decline/review/interview/withdraw transitions, and the
-- notification trigger that owns application_accepted /
-- application_declined) is unchanged.
-- =========================================================

create or replace function public.homlo_change_application_status(
  p_actor_id uuid,
  p_application_id uuid,
  p_target_status text
)
returns applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_application applications%rowtype;
  v_job jobs%rowtype;
begin
  select * into v_application from applications where id = p_application_id for update;
  if not found then
    raise exception 'Application not found';
  end if;
  select * into v_job from jobs where id = v_application.job_id and deleted_at is null for update;
  if not found then
    raise exception 'Job not found';
  end if;

  if p_target_status = 'hired' then
    if v_job.employer_id <> p_actor_id then
      raise exception 'Only the listing employer can hire an applicant';
    end if;
    if v_application.status not in ('applied', 'reviewed', 'interview') then
      raise exception 'Only candidates who have applied can be accepted';
    end if;
    if coalesce(v_job.auto_close_enabled, true) and v_job.workers_hired >= v_job.workers_needed then
      raise exception 'This job is already filled';
    end if;

    update applications set status = 'hired' where id = v_application.id returning * into v_application;
    update jobs
      set workers_hired = workers_hired + 1
      where id = v_job.id;
    return v_application;
  end if;

  if p_target_status = 'withdrawn'
    and p_actor_id = v_application.worker_id
    and v_application.status in ('applied', 'reviewed', 'interview') then
    update applications set status = 'withdrawn' where id = v_application.id returning * into v_application;
    return v_application;
  end if;

  if p_actor_id = v_job.employer_id and (
    (v_application.status = 'applied' and p_target_status in ('reviewed', 'declined'))
    or (v_application.status = 'reviewed' and p_target_status in ('interview', 'declined'))
    or (v_application.status = 'interview' and p_target_status = 'declined')
  ) then
    update applications set status = p_target_status where id = v_application.id returning * into v_application;
    return v_application;
  end if;

  raise exception 'This application status change is not permitted';
end;
$$;

revoke all on function public.homlo_change_application_status(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.homlo_change_application_status(uuid, uuid, text) to service_role;