alter table public.jobs
  add column if not exists work_arrangement text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jobs_work_arrangement_values_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_work_arrangement_values_check
      check (work_arrangement is null or work_arrangement in ('On-site', 'Hybrid', 'Remote'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jobs_remote_has_no_coordinates_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_remote_has_no_coordinates_check
      check (
        work_arrangement is distinct from 'Remote'
        or (latitude is null and longitude is null)
      );
  end if;
end;
$$;

create index if not exists idx_jobs_work_arrangement
  on public.jobs (work_arrangement)
  where deleted_at is null and status = 'open';

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
  v_employer_role text;
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
begin
  select role into v_employer_role from profiles where user_id = p_employer_id and deleted_at is null;
  if v_employer_role not in ('employer', 'both') then
    raise exception 'An employer profile is required to manage jobs';
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

  perform public.homlo_update_subscription_limits(p_employer_id);
  select plan, coalesce(active_jobs_limit, 2), coalesce(monthly_posts, 5)
    into v_plan, v_plan_limit, v_post_limit
  from subscriptions where user_id = p_employer_id;

  if p_status = 'open' then
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

drop function if exists public.homlo_list_public_published_jobs();

create or replace function public.homlo_list_public_published_jobs()
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
  created_at timestamptz,
  category text,
  employer_name text,
  employer_photo_key text,
  banner_image text,
  status text,
  workers_hired integer,
  work_arrangement text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    j.id,
    j.title,
    j.description,
    j.pay_amount,
    j.pay_currency,
    j.pay_type,
    j.location_text,
    j.latitude,
    j.longitude,
    j.workers_needed,
    j.created_at,
    coalesce(c.name, 'Other') as category,
    p.full_name as employer_name,
    p.profile_photo_key as employer_photo_key,
    j.banner_image,
    j.status,
    j.workers_hired,
    j.work_arrangement
  from jobs j
  left join categories c on c.id = j.category_id
  left join profiles p on p.user_id = j.employer_id and p.deleted_at is null
  where j.deleted_at is null
    and j.status = 'open'
  order by j.created_at desc
  limit 200;
$$;

revoke all on function public.homlo_list_public_published_jobs() from public, anon, authenticated;
grant execute on function public.homlo_list_public_published_jobs() to service_role;

drop function if exists public.homlo_search_public_jobs(text, text, text, text, text, text, numeric, numeric, text, double precision, double precision, double precision, text, int, int, text);

create or replace function public.homlo_search_public_jobs(
  p_query text default '',
  p_category text default '',
  p_location text default '',
  p_employment_type text default '',
  p_arrangement text default '',
  p_experience text default '',
  p_salary_min numeric default null,
  p_salary_max numeric default null,
  p_posted text default '',
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_radius_km double precision default null,
  p_sort text default 'recommended',
  p_limit int default 20,
  p_offset int default 0,
  p_bbox text default ''
)
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
  created_at timestamptz,
  category text,
  employer_name text,
  employer_photo_key text,
  banner_image text,
  relevance_score numeric,
  work_arrangement text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_terms text[];
  v_term text;
  v_or_query text := '';
  v_where_clauses text[] := array['j.deleted_at is null', 'j.status = ''open'''];
  v_order_by text;
  v_limit int := least(greatest(p_limit, 1), 50);
  v_offset int := greatest(p_offset, 0);
  v_relevance_expr text;
  v_title_rank text := '';
  v_desc_rank text := '';
  v_fts_where text := '';
  v_related_expr text;
  v_location_normalized text;
  v_employment_type_normalized text;
  v_arrangement_canonical text;
  v_bbox_min_lat double precision;
  v_bbox_min_lng double precision;
  v_bbox_max_lat double precision;
  v_bbox_max_lng double precision;
  v_bbox_ok boolean := false;
begin
  if trim(coalesce(p_query, '')) <> '' then
    select array_agg(t) into v_terms
      from regexp_split_to_table(lower(trim(p_query)), '[^a-z0-9_]+') as t
      where t <> '';

    foreach v_term in array v_terms loop
      if trim(coalesce(v_term, '')) = '' then
        continue;
      end if;

      v_or_query := v_or_query || (case when v_or_query = '' then '' else ' || ' end)
                    || format('to_tsquery(''simple'', %L)', v_term);

      v_title_rank := v_title_rank || (case when v_title_rank = '' then '' else ' + ' end)
                      || format('coalesce(ts_rank_cd(to_tsvector(''simple'', coalesce(j.title, '''')), to_tsquery(''simple'', %L), 32), 0)', v_term);
      v_desc_rank := v_desc_rank || (case when v_desc_rank = '' then '' else ' + ' end)
                     || format('coalesce(ts_rank_cd(to_tsvector(''simple'', coalesce(j.description, '''')), to_tsquery(''simple'', %L), 32), 0)', v_term);
    end loop;

    if v_or_query <> '' then
      v_fts_where := format(
        'to_tsvector(''simple'', coalesce(j.title, '''') || '' '' || coalesce(j.description, '''') || '' '' || coalesce(j.location_text, '''')) @@ (%s)',
        v_or_query
      );
      v_where_clauses := v_where_clauses || v_fts_where;
    end if;

    v_related_expr := format(
      'similarity(coalesce(j.title, '''') || '' '' || coalesce(j.description, '''') || '' '' || coalesce(j.location_text, ''''), %L)',
      trim(p_query)
    );
    if v_fts_where = '' then
      v_where_clauses := v_where_clauses || format('(%s) >= 0.25', v_related_expr);
      v_relevance_expr := format('(%s) * 0.6', v_related_expr);
    else
      v_where_clauses := v_where_clauses || format('((%s) or (%s) >= 0.25)', v_fts_where, v_related_expr);
      v_relevance_expr := format(
        '((%s) * 1.5 + (%s)) + (%s) * 0.6',
        v_title_rank, v_desc_rank, v_related_expr
      );
    end if;
  else
    v_relevance_expr := '0';
  end if;

  if trim(coalesce(p_category, '')) <> '' and trim(p_category) <> 'All' then
    v_where_clauses := v_where_clauses || format('c.name = %L', trim(p_category));
    v_relevance_expr := v_relevance_expr || ' + 0.4';
  end if;

  if trim(coalesce(p_location, '')) <> '' then
    v_location_normalized := trim(p_location);
    v_where_clauses := v_where_clauses || format('j.location_text %% %L', v_location_normalized);
    v_relevance_expr := v_relevance_expr || format(' + similarity(j.location_text, %L) * 0.5', v_location_normalized);
  end if;

  if trim(coalesce(p_employment_type, '')) <> '' and trim(p_employment_type) <> 'Any' then
    v_employment_type_normalized := trim(p_employment_type);
    if v_employment_type_normalized = 'Part-time' then
      v_where_clauses := v_where_clauses || '(j.pay_type = ''hourly'' or j.title ilike ''%part%time%'' or j.description ilike ''%part%time%'')'::text;
    elsif v_employment_type_normalized = 'Full-time' then
      v_where_clauses := v_where_clauses || '(j.pay_type = ''fixed'' or j.pay_type = ''daily'' or j.title ilike ''%full%time%'' or j.description ilike ''%full%time%'')'::text;
    elsif v_employment_type_normalized = 'Contract' then
      v_where_clauses := v_where_clauses || '(j.pay_type = ''fixed'' or j.title ilike ''%contract%'' or j.description ilike ''%contract%'')'::text;
    elsif v_employment_type_normalized = 'Temporary' then
      v_where_clauses := v_where_clauses || '(j.title ilike ''%temporary%'' or j.description ilike ''%temporary%'' or j.title ilike ''%temp%'' or j.description ilike ''%temp%'')'::text;
    elsif v_employment_type_normalized = 'Internship' then
      v_where_clauses := v_where_clauses || '(j.title ilike ''%intern%'' or j.description ilike ''%intern%'')'::text;
    elsif v_employment_type_normalized = 'Weekend' then
      v_where_clauses := v_where_clauses || '(j.title ilike ''%weekend%'' or j.description ilike ''%weekend%'' or j.title ilike ''%saturday%'' or j.description ilike ''%saturday%'' or j.title ilike ''%sunday%'' or j.description ilike ''%sunday%'')'::text;
    end if;
    v_relevance_expr := v_relevance_expr || ' + 0.3';
  end if;

  v_arrangement_canonical := case lower(trim(coalesce(p_arrangement, '')))
    when 'remote' then 'Remote'
    when 'on-site' then 'On-site'
    when 'onsite' then 'On-site'
    when 'on site' then 'On-site'
    when 'hybrid' then 'Hybrid'
    else null
  end;
  if v_arrangement_canonical is not null and trim(coalesce(p_arrangement, '')) <> 'Any' then
    v_where_clauses := v_where_clauses || format('j.work_arrangement = %L', v_arrangement_canonical);
  end if;

  if trim(coalesce(p_experience, '')) <> '' and trim(p_experience) <> 'Any' then
    if trim(p_experience) = 'No experience' then
      v_where_clauses := v_where_clauses || '(j.description ilike ''%no experience%'' or j.description ilike ''%no prior experience%'' or j.description ilike ''%entry level%'' or j.title ilike ''%junior%'' or j.description ilike ''%fresh graduate%'' or j.description ilike ''%student%'')'::text;
    elsif trim(p_experience) = 'Entry level' then
      v_where_clauses := v_where_clauses || '(j.description ilike ''%entry level%'' or j.title ilike ''%junior%'' or j.description ilike ''%fresh graduate%'')'::text;
    elsif trim(p_experience) = '1–2 years' then
      v_where_clauses := v_where_clauses || '(j.description ilike ''%1 year%'' or j.description ilike ''%1-2 year%'' or j.description ilike ''%2 year%'')'::text;
    elsif trim(p_experience) = '2–3 years' then
      v_where_clauses := v_where_clauses || '(j.description ilike ''%2 year%'' or j.description ilike ''%2-3 year%'' or j.description ilike ''%3 year%'')'::text;
    elsif trim(p_experience) = 'Internship' then
      v_where_clauses := v_where_clauses || '(j.description ilike ''%intern%'' or j.title ilike ''%intern%'')'::text;
    end if;
  end if;

  if p_salary_min is not null and p_salary_min > 0 then
    v_where_clauses := v_where_clauses || format('j.pay_amount >= %L', p_salary_min);
  end if;
  if p_salary_max is not null and p_salary_max > 0 then
    v_where_clauses := v_where_clauses || format('j.pay_amount <= %L', p_salary_max);
  end if;

  if trim(coalesce(p_posted, '')) <> '' and trim(p_posted) <> 'Any time' then
    if trim(p_posted) = 'Today' then
      v_where_clauses := v_where_clauses || 'j.created_at >= now() - interval ''24 hours'''::text;
    elsif trim(p_posted) = 'This week' then
      v_where_clauses := v_where_clauses || 'j.created_at >= now() - interval ''7 days'''::text;
    elsif trim(p_posted) = 'This month' then
      v_where_clauses := v_where_clauses || 'j.created_at >= now() - interval ''30 days'''::text;
    end if;
  end if;

  if p_latitude is not null and p_longitude is not null and p_radius_km is not null and p_radius_km > 0 then
    v_where_clauses := v_where_clauses || format(
      'j.latitude is not null and j.longitude is not null and
       (6371 * acos(
         cos(radians(%L)) * cos(radians(j.latitude)) * cos(radians(j.longitude) - radians(%L)) +
         sin(radians(%L)) * sin(radians(j.latitude))
       )) <= %L',
      p_latitude, p_longitude, p_latitude, p_radius_km
    );
  end if;

  if trim(coalesce(p_bbox, '')) <> '' then
    begin
      select split_part(p_bbox, ',', 1)::double precision,
             split_part(p_bbox, ',', 2)::double precision,
             split_part(p_bbox, ',', 3)::double precision,
             split_part(p_bbox, ',', 4)::double precision
        into v_bbox_min_lat, v_bbox_min_lng, v_bbox_max_lat, v_bbox_max_lng;
      v_bbox_ok := (v_bbox_min_lat is not null and v_bbox_min_lng is not null
                    and v_bbox_max_lat is not null and v_bbox_max_lng is not null);
    exception when others then
      v_bbox_ok := false;
    end;

    if v_bbox_ok then
      v_where_clauses := v_where_clauses || format(
        'j.latitude is not null and j.longitude is not null
         and j.latitude >= %L and j.latitude <= %L
         and j.longitude >= %L and j.longitude <= %L',
        v_bbox_min_lat, v_bbox_max_lat, v_bbox_min_lng, v_bbox_max_lng
      );
    end if;
  end if;

  if trim(p_sort) = 'newest' then
    v_order_by := 'j.created_at desc';
  elsif trim(p_sort) = 'salary_high_to_low' then
    v_order_by := 'j.pay_amount desc, j.created_at desc';
  elsif trim(p_sort) = 'closest' and p_latitude is not null and p_longitude is not null then
    v_order_by := format(
      '(6371 * acos(
         cos(radians(%L)) * cos(radians(j.latitude)) * cos(radians(j.longitude) - radians(%L)) +
         sin(radians(%L)) * sin(radians(j.latitude))
       )) asc, j.created_at desc',
      p_latitude, p_longitude, p_latitude
    );
  else
    v_order_by := 'relevance_score desc, j.created_at desc';
  end if;

  return query execute format(
    $$
    select
      j.id,
      j.title,
      j.description,
      j.pay_amount,
      j.pay_currency,
      j.pay_type,
      j.location_text,
      j.latitude,
      j.longitude,
      j.workers_needed,
      j.created_at,
      coalesce(c.name, 'Other') as category,
      p.full_name as employer_name,
      p.profile_photo_key as employer_photo_key,
      coalesce(j.banner_image, jm.storage_key) as banner_image,
      (%s)::numeric as relevance_score,
      j.work_arrangement
    from jobs j
    left join categories c on c.id = j.category_id
    left join profiles p on p.user_id = j.employer_id and p.deleted_at is null
    left join lateral (
      select storage_key from job_media
      where job_id = j.id
      order by position asc
      limit 1
    ) jm on true
    where %s
    order by %s
    limit %s offset %s
    $$,
    v_relevance_expr,
    array_to_string(v_where_clauses, ' and '),
    v_order_by,
    v_limit,
    v_offset
  );
end;
$function$;

revoke all on function public.homlo_search_public_jobs(text, text, text, text, text, text, numeric, numeric, text, double precision, double precision, double precision, text, int, int, text) from public, anon, authenticated;
grant execute on function public.homlo_search_public_jobs(text, text, text, text, text, text, numeric, numeric, text, double precision, double precision, double precision, text, int, int, text) to service_role;

drop function if exists public.homlo_list_employer_jobs_with_boosts(uuid);

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
  views_count bigint,
  work_arrangement text
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
    (select count(*) from job_events e where e.job_id = j.id and e.event_type = 'view') as views_count,
    j.work_arrangement
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
