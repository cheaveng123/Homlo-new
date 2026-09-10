-- =========================================================
-- 012_direct_service_gateway.sql
-- Narrow service-role-only commands used by the server-mediated
-- Supabase Edge Function gateway. The mobile client never accesses
-- tables or RPCs directly.
-- =========================================================

create or replace function public.homlo_resolve_authenticated_user(
  p_provider text,
  p_provider_user_id text
)
returns table (
  user_id uuid,
  user_status text,
  profile_complete boolean,
  profile_role text,
  profile_full_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_profile profiles%rowtype;
begin
  if coalesce(trim(p_provider), '') = '' or coalesce(trim(p_provider_user_id), '') = '' then
    raise exception 'A verified provider identity is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(trim(p_provider) || ':' || trim(p_provider_user_id), 0));

  select ui.user_id
    into v_user_id
  from user_identities ui
  where ui.provider = trim(p_provider)
    and ui.provider_user_id = trim(p_provider_user_id)
    and ui.deleted_at is null;

  if v_user_id is null then
    insert into users default values returning id into v_user_id;
    insert into user_identities (user_id, provider, provider_user_id)
      values (v_user_id, trim(p_provider), trim(p_provider_user_id));
  end if;

  select p.* into v_profile
  from profiles p
  where p.user_id = v_user_id and p.deleted_at is null;

  return query
  select
    u.id,
    u.status,
    v_profile.user_id is not null,
    v_profile.role,
    v_profile.full_name
  from users u
  where u.id = v_user_id and u.deleted_at is null;
end;
$$;

create or replace function public.homlo_upsert_profile(
  p_user_id uuid,
  p_role text,
  p_full_name text,
  p_phone text default null,
  p_bio text default null,
  p_location_text text default null,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile profiles%rowtype;
begin
  if p_role not in ('worker', 'employer', 'both') then
    raise exception 'Profile role must be worker, employer, or both';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Full name is required';
  end if;
  if not exists (select 1 from users where id = p_user_id and deleted_at is null and status = 'active') then
    raise exception 'Active canonical user not found';
  end if;

  insert into profiles (user_id, role, full_name, phone, bio, location_text, latitude, longitude)
  values (
    p_user_id,
    p_role,
    trim(p_full_name),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_bio, '')), ''),
    nullif(trim(coalesce(p_location_text, '')), ''),
    p_latitude,
    p_longitude
  )
  on conflict (user_id) do update set
    role = excluded.role,
    full_name = excluded.full_name,
    phone = excluded.phone,
    bio = excluded.bio,
    location_text = excluded.location_text,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    deleted_at = null
  returning * into v_profile;

  return v_profile;
end;
$$;

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
begin
  -- Ensure a profile exists for this worker (FK: applications.worker_id -> profiles.user_id)
  -- If missing, create a minimal 'worker' profile so the FK passes.
  -- Role validation still runs below.
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

  if v_application.status = 'applied' then
    insert into notifications (user_id, type, title, body)
    values (v_job.employer_id, 'new_application', 'New application', 'A worker applied to your job.');
  end if;

  return v_application;
end;
$$;

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
  v_updated_job jobs%rowtype;
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
    if v_application.status <> 'interview' then
      raise exception 'Only interviewed applicants can be hired';
    end if;
    if v_job.workers_hired >= v_job.workers_needed then
      raise exception 'This job is already filled';
    end if;

    update applications set status = 'hired' where id = v_application.id returning * into v_application;
    update jobs
      set workers_hired = workers_hired + 1,
          status = case when workers_hired + 1 >= workers_needed then 'filled' else status end
      where id = v_job.id
      returning * into v_updated_job;
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
    if p_target_status = 'declined' then
      insert into notifications (user_id, type, title, body)
      values (v_application.worker_id, 'application_status_change', 'Application updated', 'Your application was declined.');
    end if;
    return v_application;
  end if;

  raise exception 'This application status change is not permitted';
end;
$$;

create or replace function public.homlo_save_job(
  p_employer_id uuid,
  p_job_id uuid,
  p_category_id uuid,
  p_title text,
  p_description text,
  p_pay_amount numeric,
  p_pay_currency text,
  p_pay_type text,
  p_location_text text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_workers_needed integer default 1,
  p_status text default 'draft'
)
returns jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job jobs%rowtype;
  v_employer_role text;
begin
  select role into v_employer_role from profiles where user_id = p_employer_id and deleted_at is null;
  if v_employer_role not in ('employer', 'both') then
    raise exception 'An employer profile is required to manage jobs';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_description), '') = '' then
    raise exception 'Job title and description are required';
  end if;
  if p_pay_amount is null or p_pay_amount < 0 or p_workers_needed is null or p_workers_needed < 1 then
    raise exception 'Job pay and worker capacity must be valid';
  end if;
  if p_pay_type not in ('hourly', 'daily', 'fixed') or p_status not in ('draft', 'open', 'closed', 'cancelled') then
    raise exception 'Job pay type or status is invalid';
  end if;

  if p_job_id is null then
    insert into jobs (employer_id, category_id, title, description, pay_amount, pay_currency, pay_type, location_text, latitude, longitude, workers_needed, status)
    values (p_employer_id, p_category_id, trim(p_title), trim(p_description), p_pay_amount, coalesce(nullif(trim(p_pay_currency), ''), 'USD'), p_pay_type, nullif(trim(coalesce(p_location_text, '')), ''), p_latitude, p_longitude, p_workers_needed, p_status)
    returning * into v_job;
  else
    update jobs set
      category_id = p_category_id,
      title = trim(p_title),
      description = trim(p_description),
      pay_amount = p_pay_amount,
      pay_currency = coalesce(nullif(trim(p_pay_currency), ''), 'USD'),
      pay_type = p_pay_type,
      location_text = nullif(trim(coalesce(p_location_text, '')), ''),
      latitude = p_latitude,
      longitude = p_longitude,
      workers_needed = greatest(p_workers_needed, workers_hired),
      status = case when workers_hired >= greatest(p_workers_needed, workers_hired) then 'filled' else p_status end
    where id = p_job_id and employer_id = p_employer_id and deleted_at is null
    returning * into v_job;
    if not found then
      raise exception 'Only the listing employer can update this job';
    end if;
  end if;
  return v_job;
end;
$$;

create or replace function public.homlo_list_employer_jobs(p_employer_id uuid)
returns setof jobs
language sql
security definer
set search_path = public, pg_temp
as $$
  select j.*
  from jobs j
  where j.employer_id = p_employer_id and j.deleted_at is null
  order by j.updated_at desc;
$$;

create or replace function public.homlo_list_employer_applications(p_employer_id uuid, p_job_id uuid)
returns table (
  id uuid,
  job_id uuid,
  worker_id uuid,
  status text,
  message text,
  created_at timestamptz,
  updated_at timestamptz,
  worker_full_name text,
  worker_location text,
  worker_bio text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select a.id, a.job_id, a.worker_id, a.status, a.message, a.created_at, a.updated_at, p.full_name, p.location_text, p.bio
  from applications a
  join jobs j on j.id = a.job_id and j.deleted_at is null
  join profiles p on p.user_id = a.worker_id and p.deleted_at is null
  where j.employer_id = p_employer_id and a.job_id = p_job_id
  order by a.created_at desc;
$$;

revoke all on function public.homlo_resolve_authenticated_user(text, text) from public, anon, authenticated;
revoke all on function public.homlo_upsert_profile(uuid, text, text, text, text, text, double precision, double precision) from public, anon, authenticated;
revoke all on function public.homlo_submit_application(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.homlo_change_application_status(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.homlo_save_job(uuid, uuid, uuid, text, text, numeric, text, text, text, double precision, double precision, integer, text) from public, anon, authenticated;
revoke all on function public.homlo_list_employer_jobs(uuid) from public, anon, authenticated;
revoke all on function public.homlo_list_employer_applications(uuid, uuid) from public, anon, authenticated;

grant execute on function public.homlo_resolve_authenticated_user(text, text) to service_role;
grant execute on function public.homlo_upsert_profile(uuid, text, text, text, text, text, double precision, double precision) to service_role;
grant execute on function public.homlo_submit_application(uuid, uuid, text) to service_role;
grant execute on function public.homlo_change_application_status(uuid, uuid, text) to service_role;
grant execute on function public.homlo_save_job(uuid, uuid, uuid, text, text, numeric, text, text, text, double precision, double precision, integer, text) to service_role;
grant execute on function public.homlo_list_employer_jobs(uuid) to service_role;
grant execute on function public.homlo_list_employer_applications(uuid, uuid) to service_role;
