-- Editing an existing listing must never be blocked by the active-job plan
-- limit. The old check excluded the job being edited from the count, but an
-- employer who is already at (or grandfathered above) their limit still failed
-- because the remaining active jobs alone met the limit. Only enforce the limit
-- when a job is actually transitioning into `open` (new job or re-publish).

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
  p_requirements text default null,
  p_auto_close_enabled boolean default true,
  p_work_arrangement text default null
)
returns jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job jobs%rowtype;
  v_title text;
  v_description text;
  v_pay_amount numeric;
  v_workers_needed integer;
  v_pay_type text;
  v_work_arrangement text;
  v_plan text;
  v_plan_limit int;
  v_post_limit int;
  v_active_count bigint;
  v_monthly_posts bigint;
  v_existing_status text;
begin
  -- Any active Homlo account may post a job. Plan limits still apply.
  if not exists (
    select 1 from profiles where user_id = p_employer_id and deleted_at is null
  ) then
    raise exception 'An active Homlo profile is required to manage jobs';
  end if;
  if p_status not in ('draft', 'open', 'closed', 'cancelled') then
    raise exception 'Job status is invalid';
  end if;

  v_work_arrangement := nullif(trim(coalesce(p_work_arrangement, '')), '');
  if v_work_arrangement is not null and v_work_arrangement not in ('On-site', 'Hybrid', 'Remote') then
    raise exception 'Job work arrangement is invalid';
  end if;

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

  -- Remember whether this is an edit of an already-open listing. Such edits
  -- update the existing active job and do not consume an extra active slot.
  if p_job_id is not null then
    select status into v_existing_status
      from jobs
      where id = p_job_id
        and employer_id = p_employer_id
        and deleted_at is null;
  end if;

  perform public.homlo_update_subscription_limits(p_employer_id);
  select plan, coalesce(active_jobs_limit, 2), coalesce(monthly_posts, 5)
    into v_plan, v_plan_limit, v_post_limit
  from subscriptions where user_id = p_employer_id;

  if p_status = 'open' and coalesce(v_existing_status, '') <> 'open' then
    -- Skip limit enforcement for enterprise plan (usage-based billing)
    if v_plan <> 'enterprise' then
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
end if;

  v_title := coalesce(trim(p_title), '');
  v_description := coalesce(trim(p_description), '');
  v_pay_amount := coalesce(p_pay_amount, 0);
  v_workers_needed := greatest(coalesce(p_workers_needed, 1), 1);
  v_pay_type := coalesce(p_pay_type, 'fixed');

  if p_job_id is null then
    insert into jobs (employer_id, category_id, title, description, pay_amount, pay_currency, pay_type, location_text, latitude, longitude, workers_needed, status, address_line, city, district, province, country, postal_code, banner_image, requirements, auto_close_enabled, work_arrangement)
    values (p_employer_id, p_category_id, v_title, v_description, v_pay_amount, coalesce(nullif(trim(p_pay_currency), ''), 'USD'), v_pay_type, nullif(trim(coalesce(p_location_text, '')), ''), case when v_work_arrangement = 'Remote' then null else p_latitude end, case when v_work_arrangement = 'Remote' then null else p_longitude end, v_workers_needed, p_status, nullif(trim(coalesce(p_address_line, '')), ''), nullif(trim(coalesce(p_city, '')), ''), nullif(trim(coalesce(p_district, '')), ''), nullif(trim(coalesce(p_province, '')), ''), nullif(trim(coalesce(p_country, '')), ''), nullif(trim(coalesce(p_postal_code, '')), ''), nullif(trim(coalesce(p_banner_image, '')), ''), nullif(trim(coalesce(p_requirements, '')), ''), coalesce(p_auto_close_enabled, true), v_work_arrangement)
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
      work_arrangement = coalesce(v_work_arrangement, work_arrangement),
      latitude = case when coalesce(v_work_arrangement, work_arrangement) = 'Remote' then null else p_latitude end,
      longitude = case when coalesce(v_work_arrangement, work_arrangement) = 'Remote' then null else p_longitude end,
      address_line = nullif(trim(coalesce(p_address_line, '')), ''),
      city = nullif(trim(coalesce(p_city, '')), ''),
      district = nullif(trim(coalesce(p_district, '')), ''),
      province = nullif(trim(coalesce(p_province, '')), ''),
      country = nullif(trim(coalesce(p_country, '')), ''),
      postal_code = nullif(trim(coalesce(p_postal_code, '')), ''),
      banner_image = nullif(trim(coalesce(p_banner_image, '')), ''),
      requirements = nullif(trim(coalesce(p_requirements, '')), ''),
      auto_close_enabled = case when p_auto_close_enabled is null then auto_close_enabled else p_auto_close_enabled end,
      workers_needed = greatest(v_workers_needed, workers_hired),
      status = case when coalesce(auto_close_enabled, true) and workers_hired >= greatest(v_workers_needed, workers_hired) then 'filled' else p_status end
    where id = p_job_id and employer_id = p_employer_id and deleted_at is null
    returning * into v_job;
    if not found then
      raise exception 'Only the listing employer can update this job';
    end if;
  end if;
  return v_job;
end;
$$;

revoke all on function public.homlo_save_job(uuid, uuid, uuid, text, text, numeric, text, text, text, double precision, double precision, integer, text, text, text, text, text, text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.homlo_save_job(uuid, uuid, uuid, text, text, numeric, text, text, text, double precision, double precision, integer, text, text, text, text, text, text, text, text, text, boolean, text) to service_role;
