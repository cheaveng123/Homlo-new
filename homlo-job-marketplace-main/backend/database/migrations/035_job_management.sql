-- =========================================================
-- 035_job_management.sql
-- Employer job-management support for the job detail / edit
-- flow (JobManagementDetailScreen + EditJobScreen + Job
-- Options menu):
--
--   * jobs.requirements — free-text requirements column shown
--     on the Edit screen. Read/written through homlo_save_job
--     and homlo_list_employer_jobs_with_boosts only.
--
--   * homlo_soft_delete_job — ownership-scoped soft delete
--     (sets deleted_at = now()). The existing homlo_delete_job
--     (014) stays for hard deletes; UI "Delete" now soft-deletes
--     so candidates keep the job title on their own history.
--
--   * homlo_list_employer_jobs_with_boosts — returns the job's
--     requirements, category name and a REAL views_count derived
--     from job_events (event_type = 'view'). New columns are
--     appended after the existing ones so positional consumers
--     keep working.
--
--   * job-images storage bucket object-level RLS (the shared
--     Supabase Storage backend requires the bucket itself to be
--     provisioned through the Storage API, never a raw insert):
--         node scripts/provision-job-images-bucket.mjs
-- =========================================================

-- ---------------------------------------------------------
-- 1. jobs.requirements
-- ---------------------------------------------------------
alter table public.jobs
  add column if not exists requirements text;

-- ---------------------------------------------------------
-- 2. homlo_soft_delete_job — soft delete (deleted_at).
-- ---------------------------------------------------------
create or replace function public.homlo_soft_delete_job(p_employer_id uuid, p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
begin
  update jobs
    set deleted_at = now(),
        updated_at = now()
  where id = p_job_id
    and employer_id = p_employer_id
    and deleted_at is null
  returning id into v_job_id;

  if not found then
    raise exception 'Only the listing employer can delete this job';
  end if;

  return v_job_id;
end;
$$;

revoke all on function public.homlo_soft_delete_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.homlo_soft_delete_job(uuid, uuid) to service_role;

-- ---------------------------------------------------------
-- 3. homlo_save_job — adds p_requirements (appended after
--    p_banner_image so existing callers are unaffected).
--    Preserves every behavioural guarantee from 025/027:
--    employer-role check, draft vs published validation and
--    the account-plan active-job / monthly-post limits.
-- ---------------------------------------------------------
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
  p_status text default 'draft',
  p_address_line text default null,
  p_city text default null,
  p_district text default null,
  p_province text default null,
  p_country text default null,
  p_postal_code text default null,
  p_banner_image text default null,
  p_requirements text default null
)
returns jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job jobs%rowtype;
  v_employer_role text;
  v_title text;
  v_description text;
  v_pay_amount numeric;
  v_workers_needed integer;
  v_pay_type text;
  v_plan text;
  v_plan_limit int;
  v_post_limit int;
  v_active_count bigint;
  v_monthly_posts bigint;
begin
  select role into v_employer_role from profiles where user_id = p_employer_id and deleted_at is null;
  if v_employer_role not in ('employer', 'both') then
    raise exception 'An employer profile is required to manage jobs';
  end if;
  if p_status not in ('draft', 'open', 'closed', 'cancelled') then
    raise exception 'Job status is invalid';
  end if;

  -- Strict validation only applies to published/closed jobs. Drafts may be
  -- persisted with an incomplete form so "Save draft" is reliable at any step.
  if p_status <> 'draft' then
    if coalesce(trim(p_title), '') = '' or coalesce(trim(p_description), '') = '' then
      raise exception 'Job title and description are required';
    end if;
    if p_pay_amount is null or p_pay_amount < 0 or p_workers_needed is null or p_workers_needed < 1 then
      raise exception 'Job pay and worker capacity must be valid';
    end if;
    if p_pay_type not in ('hourly', 'daily', 'fixed') then
      raise exception 'Job pay type is invalid';
    end if;
  end if;

  -- Ensure a subscription row exists (defaults to Free) and read the limits.
  perform public.homlo_update_subscription_limits(p_employer_id);
  select plan, coalesce(active_jobs_limit, 2), coalesce(monthly_posts, 5)
    into v_plan, v_plan_limit, v_post_limit
  from subscriptions where user_id = p_employer_id;

  if p_status = 'open' then
    select count(*) into v_active_count
      from jobs
      where employer_id = p_employer_id
        and status in ('open', 'filled')
        and deleted_at is null
        and id is distinct from p_job_id;

    if v_active_count >= v_plan_limit then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Your %s plan allows %s active jobs. Open additional listings by upgrading your plan.',
          v_plan, v_plan_limit
        );
    end if;

    select count(*) into v_monthly_posts
      from jobs
      where employer_id = p_employer_id
        and deleted_at is null
        and created_at >= date_trunc('month', now());

    if p_job_id is null and v_monthly_posts >= v_post_limit then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Your %s plan allows %s published posts per month. Upgrade to publish more.',
          v_plan, v_post_limit
        );
    end if;
  end if;

  v_title := coalesce(trim(p_title), '');
  v_description := coalesce(trim(p_description), '');
  v_pay_amount := coalesce(p_pay_amount, 0);
  v_workers_needed := greatest(coalesce(p_workers_needed, 1), 1);
  v_pay_type := coalesce(p_pay_type, 'fixed');

  if p_job_id is null then
    insert into jobs (employer_id, category_id, title, description, pay_amount, pay_currency, pay_type, location_text, latitude, longitude, workers_needed, status, address_line, city, district, province, country, postal_code, banner_image, requirements)
    values (p_employer_id, p_category_id, v_title, v_description, v_pay_amount, coalesce(nullif(trim(p_pay_currency), ''), 'USD'), v_pay_type, nullif(trim(coalesce(p_location_text, '')), ''), p_latitude, p_longitude, v_workers_needed, p_status, nullif(trim(coalesce(p_address_line, '')), ''), nullif(trim(coalesce(p_city, '')), ''), nullif(trim(coalesce(p_district, '')), ''), nullif(trim(coalesce(p_province, '')), ''), nullif(trim(coalesce(p_country, '')), ''), nullif(trim(coalesce(p_postal_code, '')), ''), nullif(trim(coalesce(p_banner_image, '')), ''), nullif(trim(coalesce(p_requirements, '')), ''))
    returning * into v_job;
  else
    update jobs set
      category_id = p_category_id,
      title = v_title,
      description = v_description,
      pay_amount = v_pay_amount,
      pay_currency = coalesce(nullif(trim(p_pay_currency), ''), 'USD'),
      pay_type = v_pay_type,
      location_text = nullif(trim(coalesce(p_location_text, '')), ''),
      latitude = p_latitude,
      longitude = p_longitude,
      address_line = nullif(trim(coalesce(p_address_line, '')), ''),
      city = nullif(trim(coalesce(p_city, '')), ''),
      district = nullif(trim(coalesce(p_district, '')), ''),
      province = nullif(trim(coalesce(p_province, '')), ''),
      country = nullif(trim(coalesce(p_country, '')), ''),
      postal_code = nullif(trim(coalesce(p_postal_code, '')), ''),
      banner_image = nullif(trim(coalesce(p_banner_image, '')), ''),
      requirements = nullif(trim(coalesce(p_requirements, '')), ''),
      workers_needed = greatest(v_workers_needed, workers_hired),
      status = case when workers_hired >= greatest(v_workers_needed, workers_hired) then 'filled' else p_status end
    where id = p_job_id and employer_id = p_employer_id and deleted_at is null
    returning * into v_job;
    if not found then
      raise exception 'Only the listing employer can update this job';
    end if;
  end if;
  return v_job;
end;
$$;

revoke all on function public.homlo_save_job(uuid, uuid, uuid, text, text, numeric, text, text, text, double precision, double precision, integer, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.homlo_save_job(uuid, uuid, uuid, text, text, numeric, text, text, text, double precision, double precision, integer, text, text, text, text, text, text, text, text, text) to service_role;

-- ---------------------------------------------------------
-- 4. homlo_list_employer_jobs_with_boosts — appends
--    requirements, category name and views_count so the job
--    management detail / edit screens show real data.
-- ---------------------------------------------------------
create or replace function public.homlo_list_employer_jobs_with_boosts(p_employer_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  pay_amount numeric,
  pay_currency text,
  pay_type text,
  location_text text,
  latitude double precision,
  longitude double precision,
  workers_needed integer,
  workers_hired integer,
  address_line text,
  city text,
  district text,
  province text,
  country text,
  postal_code text,
  banner_image text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  boost_id uuid,
  boost_package text,
  boost_expires_at timestamptz,
  requirements text,
  category text,
  views_count bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    j.id, j.title, j.description, j.pay_amount, j.pay_currency, j.pay_type,
    j.location_text, j.latitude, j.longitude, j.workers_needed, j.workers_hired,
    j.address_line, j.city, j.district, j.province, j.country, j.postal_code,
    j.banner_image, j.status, j.created_at, j.updated_at,
    b.id as boost_id, b.package as boost_package, b.expires_at as boost_expires_at,
    j.requirements,
    c.name as category,
    (select count(*) from job_events e where e.job_id = j.id and e.event_type = 'view') as views_count
  from jobs j
  left join categories c on c.id = j.category_id
  left join lateral (
    select b.id, b.package, b.expires_at
    from boosts b
    where b.job_id = j.id
      and b.status = 'active'
      and b.expires_at > now()
    order by b.created_at desc
    limit 1
  ) b on true
  where j.employer_id = p_employer_id and j.deleted_at is null
  order by j.updated_at desc;
$$;

revoke all on function public.homlo_list_employer_jobs_with_boosts(uuid) from public, anon, authenticated;
grant execute on function public.homlo_list_employer_jobs_with_boosts(uuid) to service_role;

-- ---------------------------------------------------------
-- 5. job-images storage bucket object-level RLS (defense in
--    depth). Bucket must be provisioned via the Storage API:
--        node scripts/provision-job-images-bucket.mjs
--    Uploads go through the server service-role adapter, which
--    already scopes keys to the owning employer's folder; these
--    policies additionally block anon-key clients from touching
--    any folder except their own.
-- ---------------------------------------------------------

drop policy if exists "job-images public read" on storage.objects;
create policy "job-images public read"
on storage.objects for select
using ( bucket_id = 'job-images' );

drop policy if exists "job-images own upload" on storage.objects;
create policy "job-images own upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'job-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "job-images own update" on storage.objects;
create policy "job-images own update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'job-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "job-images own delete" on storage.objects;
create policy "job-images own delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'job-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);