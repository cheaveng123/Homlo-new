-- 014_employer_job_deletion.sql
-- Permanent employer-owned listing deletion. Database foreign-key cascades
-- remove dependent job media and applications in the same transaction.

create or replace function public.homlo_delete_job(
  p_employer_id uuid,
  p_job_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted_job_id uuid;
begin
  delete from jobs
  where id = p_job_id
    and employer_id = p_employer_id
  returning id into v_deleted_job_id;

  if v_deleted_job_id is null then
    raise exception 'Only the listing employer can delete this job';
  end if;

  return v_deleted_job_id;
end;
$$;

revoke all on function public.homlo_delete_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.homlo_delete_job(uuid, uuid) to service_role;
