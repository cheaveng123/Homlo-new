-- ---------------------------------------------------------
-- homlo_list_worker_applications_detailed — worker "My applications"
--
-- Extends the worker read model with the job context the application
-- cards and detail page need: banner image, pay, and work arrangement.
-- Postgres cannot change a function's return type with CREATE OR REPLACE,
-- so the function is dropped and recreated, then its grants are restored.
-- ---------------------------------------------------------
drop function if exists public.homlo_list_worker_applications_detailed(uuid);

create function public.homlo_list_worker_applications_detailed(p_worker_id uuid)
returns table (
  id uuid,
  job_id uuid,
  status text,
  message text,
  created_at timestamptz,
  updated_at timestamptz,
  job_title text,
  job_location_text text,
  employer_id uuid,
  employer_name text,
  banner_image text,
  pay_amount numeric,
  pay_currency text,
  pay_type text,
  work_arrangement text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    a.id, a.job_id, a.status, a.message, a.created_at, a.updated_at,
    j.title, j.location_text, j.employer_id, ep.full_name as employer_name,
    j.banner_image, j.pay_amount, j.pay_currency, j.pay_type, j.work_arrangement
  from applications a
  join jobs j on j.id = a.job_id and j.deleted_at is null
  left join profiles ep on ep.user_id = j.employer_id and ep.deleted_at is null
  where a.worker_id = p_worker_id
  order by a.updated_at desc;
$$;

revoke all on function public.homlo_list_worker_applications_detailed(uuid) from public, anon, authenticated;
grant execute on function public.homlo_list_worker_applications_detailed(uuid) to service_role;
