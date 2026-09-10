-- =========================================================
-- 013_direct_service_gateway_reads.sql
-- Service-role-only authenticated read models for the direct
-- Homlo gateway. These functions carry actor identity explicitly
-- and never grant anon/authenticated clients table access.
-- =========================================================

create or replace function public.homlo_get_profile(p_user_id uuid)
returns profiles
language sql
security definer
set search_path = public, pg_temp
as $$
  select p.* from profiles p where p.user_id = p_user_id and p.deleted_at is null;
$$;

create or replace function public.homlo_get_application_for_worker(p_worker_id uuid, p_job_id uuid)
returns applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result applications;
begin
  select a.* into result from applications a where a.worker_id = p_worker_id and a.job_id = p_job_id;
  if result.id is null then
    return null;
  end if;
  return result;
end;
$$;

create or replace function public.homlo_list_worker_applications(p_worker_id uuid)
returns table (
  id uuid,
  job_id uuid,
  worker_id uuid,
  status text,
  message text,
  created_at timestamptz,
  updated_at timestamptz,
  job_title text,
  job_location_text text,
  employer_id uuid
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select a.id, a.job_id, a.worker_id, a.status, a.message, a.created_at, a.updated_at, j.title, j.location_text, j.employer_id
  from applications a
  join jobs j on j.id = a.job_id and j.deleted_at is null
  where a.worker_id = p_worker_id
  order by a.updated_at desc;
$$;

revoke all on function public.homlo_get_profile(uuid) from public, anon, authenticated;
revoke all on function public.homlo_get_application_for_worker(uuid, uuid) from public, anon, authenticated;
revoke all on function public.homlo_list_worker_applications(uuid) from public, anon, authenticated;

grant execute on function public.homlo_get_profile(uuid) to service_role;
grant execute on function public.homlo_get_application_for_worker(uuid, uuid) to service_role;
grant execute on function public.homlo_list_worker_applications(uuid) to service_role;
