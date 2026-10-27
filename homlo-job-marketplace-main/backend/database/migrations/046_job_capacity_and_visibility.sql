-- 046_job_capacity_and_visibility.sql
-- Phase 1 repair for job capacity, expiry, and public discovery.
--
-- Scope:
--   * reconcile jobs.workers_hired with the number of hired applications;
--   * repair existing expired/full/open status drift;
--   * always close a job when capacity reaches zero (auto_close_enabled only
--     controls the job_filled notifications);
--   * reopen only filled, non-expired jobs when a hire is reverted;
--   * filter expired/full jobs in the read queries themselves;
--   * add a pg_cron cleanup sweep for expired jobs.
--
-- Transaction: apply with
--   node scripts/apply-migrations.mjs backend/database/migrations/046_job_capacity_and_visibility.sql
-- The script wraps every statement in one transaction. Back up first.
--
-- This migration is intentionally self-contained. It does not depend on 039,
-- 044, or 045 being applied.

-- =========================================================
-- 1. Repair existing data (idempotent; one DO block = one statement)
-- =========================================================
do $$
declare
  v_row record;
  v_mismatches int := 0;
  v_reconciled int := 0;
  v_expired int := 0;
  v_filled int := 0;
  v_reopened int := 0;
begin
  raise notice '046: workers_hired mismatches before repair:';

  for v_row in
    select j.id, j.title, j.workers_hired,
           coalesce(c.hired_count, 0) as hired_count
    from jobs j
    left join lateral (
      select count(*) filter (where a.status = 'hired')::int as hired_count
      from applications a
      where a.job_id = j.id
    ) c on true
    where j.workers_hired is distinct from coalesce(c.hired_count, 0)
    order by j.created_at
  loop
    raise notice '  job=% title=% workers_hired=% hired_applications=%',
      v_row.id, v_row.title, v_row.workers_hired, v_row.hired_count;
    v_mismatches := v_mismatches + 1;
  end loop;

  if v_mismatches = 0 then
    raise notice '  (none)';
  end if;

  with counts as (
    select j.id,
           count(a.id) filter (where a.status = 'hired')::int as hired_count
    from jobs j
    left join applications a on a.job_id = j.id
    group by j.id
  )
  update jobs j
  set workers_hired = counts.hired_count
  from counts
  where j.id = counts.id
    and j.workers_hired is distinct from counts.hired_count;
  get diagnostics v_reconciled = row_count;

  update jobs
  set status = 'expired'
  where deleted_at is null
    and status in ('open', 'filled')
    and end_date is not null
    and end_date < current_date;
  get diagnostics v_expired = row_count;

  update jobs
  set status = 'filled'
  where deleted_at is null
    and status = 'open'
    and workers_needed > 0
    and workers_hired >= workers_needed;
  get diagnostics v_filled = row_count;

  update jobs
  set status = 'open'
  where deleted_at is null
    and status = 'filled'
    and workers_needed > 0
    and workers_hired < workers_needed
    and (end_date is null or end_date >= current_date);
  get diagnostics v_reopened = row_count;

  raise notice '046: reconciled=% expired=% filled=% reopened=%',
    v_reconciled, v_expired, v_filled, v_reopened;
end;
$$;

-- =========================================================
-- 2. Capacity/expiry invariant for every job write
-- =========================================================
create or replace function public.enforce_job_capacity_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

  if new.status in ('open', 'filled')
     and new.end_date is not null
     and new.end_date < current_date then
    new.status := 'expired';
  elsif new.status = 'open'
        and new.workers_needed > 0
        and new.workers_hired >= new.workers_needed then
    new.status := 'filled';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobs_capacity_status on public.jobs;
create trigger trg_jobs_capacity_status
  before insert or update of status, workers_hired, workers_needed, end_date, deleted_at
  on public.jobs
  for each row execute function public.enforce_job_capacity_status();

-- =========================================================
-- 3. Cleanup sweep for jobs whose end date has passed
-- =========================================================
create or replace function public.homlo_expire_past_jobs()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  update jobs
  set status = 'expired'
  where deleted_at is null
    and status in ('open', 'filled')
    and end_date is not null
    and end_date < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.homlo_expire_past_jobs() from public, anon, authenticated;
grant execute on function public.homlo_expire_past_jobs() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'homlo_expire_past_jobs') then
      perform cron.unschedule('homlo_expire_past_jobs');
    end if;
    perform cron.schedule(
      'homlo_expire_past_jobs',
      '*/15 * * * *',
      $cron$select public.homlo_expire_past_jobs();$cron$
    );
    raise notice '046: scheduled homlo_expire_past_jobs every 15 minutes';
  else
    raise notice '046: pg_cron is not installed; expiry still enforced by read queries and writes';
  end if;
exception when others then
  raise notice '046: could not schedule homlo_expire_past_jobs: %', sqlerrm;
end;
$$;

-- =========================================================
-- 4. Automatic close/reopen and notifications
-- =========================================================
create or replace function public.maybe_auto_close_job(p_job_id uuid)
returns void
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

  if not found or v_job.status <> 'open' then
    return;
  end if;

  if v_job.end_date is not null and v_job.end_date < current_date then
    update jobs set status = 'expired' where id = p_job_id and status = 'open';
    return;
  end if;

  if v_job.workers_needed <= 0 then
    return;
  end if;

  select count(*) into v_hired_count
  from applications
  where job_id = p_job_id and status = 'hired';

  if v_hired_count >= v_job.workers_needed then
    update jobs set status = 'filled' where id = p_job_id and status = 'open';

    if coalesce(v_job.auto_close_enabled, true) then
      insert into notifications (user_id, type, title, body, job_id, application_id)
      select worker_id, 'job_filled', 'Job filled', null, job_id, id
      from applications
      where job_id = p_job_id
        and status in ('applied', 'reviewed', 'interview');
    end if;
  end if;
end;
$$;

create or replace function public.handle_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    if old.status = 'hired' and new.status <> 'hired' then
      update jobs
      set workers_hired = greatest(workers_hired - 1, 0),
          status = case
            when status = 'filled'
                 and end_date is not null
                 and end_date < current_date then 'expired'
            when status = 'filled' then 'open'
            else status
          end
      where id = new.job_id;
    end if;

    if new.status = 'hired' then
      perform public.notify_user(new.worker_id, 'application_accepted', new.job_id, new.id);
      perform public.maybe_auto_close_job(new.job_id);
    elsif new.status = 'declined' then
      perform public.notify_user(new.worker_id, 'application_declined', new.job_id, new.id);
    end if;
  end if;
  return new;
end;
$$;

-- =========================================================
-- 5. Direct accept from applied/reviewed/interview + reopen support
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
    if v_job.end_date is not null and v_job.end_date < current_date then
      raise exception 'This job has expired';
    end if;
    if v_job.status <> 'open' then
      raise exception 'This job is not open';
    end if;
    if v_job.workers_needed > 0 and v_job.workers_hired >= v_job.workers_needed then
      raise exception 'This job is already filled';
    end if;

    update applications set status = 'hired' where id = v_application.id returning * into v_application;
    update jobs
    set workers_hired = workers_hired + 1,
        status = case
          when workers_needed > 0 and workers_hired + 1 >= workers_needed then 'filled'
          else status
        end
    where id = v_job.id;
    perform public.maybe_auto_close_job(v_job.id);
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

-- =========================================================
-- 6. Application submission uses the same expiry/capacity rules
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
  if not found then
    raise exception 'This job is no longer accepting applications';
  end if;
  if v_job.status <> 'open' then
    raise exception 'This job is no longer accepting applications';
  end if;
  if v_job.end_date is not null and v_job.end_date < current_date then

    raise exception 'This job has expired';
  end if;
  if v_job.workers_needed > 0 and v_job.workers_hired >= v_job.workers_needed then

    raise exception 'This job is already filled';
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

revoke all on function public.homlo_submit_application(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.homlo_submit_application(uuid, uuid, text) to service_role;

-- =========================================================
-- 7. Public feed: never return expired/full jobs
-- =========================================================
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
    and (j.workers_needed = 0 or j.workers_hired < j.workers_needed)
    and (j.end_date is null or j.end_date >= current_date)
  order by j.created_at desc
  limit 200;
$$;

revoke all on function public.homlo_list_public_published_jobs() from public, anon, authenticated;
grant execute on function public.homlo_list_public_published_jobs() to service_role;

-- =========================================================
-- 8. Search: never return expired/full jobs; expose workers_hired
-- =========================================================
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
  workers_hired integer,
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
  v_where_clauses text[] := array['j.deleted_at is null', 'j.status = ''open''', '(j.workers_needed = 0 or j.workers_hired < j.workers_needed)', '(j.end_date is null or j.end_date >= current_date)'];
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
      j.workers_hired,
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

-- =========================================================
-- 9. Feed ledger view: expiry + capacity at read time
-- =========================================================
create or replace view feed_eligible_jobs as
select
  j.id,
  j.employer_id,
  c.name as category,
  case j.work_arrangement
    when 'On-site' then 'on_site'
    when 'Hybrid' then 'hybrid'
    when 'Remote' then 'remote'
    else 'on_site'
  end as work_arrangement,
  case j.pay_type
    when 'hourly' then 'part_time'
    when 'daily' then 'full_time'
    when 'fixed' then 'weekends'
    else null
  end as job_type,
  j.pay_amount::float8 as pay_min,
  j.pay_amount::float8 as pay_max,
  j.pay_type as pay_period,
  j.created_at,
  greatest(j.workers_needed - j.workers_hired, 0) as positions_left,
  j.location,
  null::float8 as employer_quality
from jobs j
left join categories c on c.id = j.category_id
where j.deleted_at is null
  and j.status = 'open'
  and (j.workers_needed = 0 or j.workers_hired < j.workers_needed)
  and (j.end_date is null or j.end_date >= current_date);

-- =========================================================
-- 10. Recommendation candidate eligibility: expiry + capacity
-- =========================================================
create or replace function public.homlo_eligible_candidates(
  p_worker_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_hard_max_commute_km numeric,
  p_now timestamptz default null
)
returns table (
  id uuid,
  employer_id uuid,
  category_id uuid,
  created_at timestamptz,
  employer_active_jobs_count bigint,
  employer_created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    j.id,
    j.employer_id,
    j.category_id,
    j.created_at,
    (select count(*)::bigint
       from jobs jp
      where jp.employer_id = j.employer_id
        and jp.deleted_at is null) as employer_active_jobs_count,
    u.created_at as employer_created_at
  from jobs j
  join profiles emp
    on emp.user_id = j.employer_id
   and emp.deleted_at is null
  join users u
    on u.id = emp.user_id
  where j.deleted_at is null
    and j.status = 'open'
    and (j.workers_needed = 0 or j.workers_hired < j.workers_needed)
    and (j.end_date is null or j.end_date >= (coalesce(p_now, clock_timestamp()) at time zone 'UTC')::date)
    and u.status = 'active'
    and (p_worker_id is null
         or (j.employer_id is distinct from p_worker_id
             and not exists (
               select 1
               from applications a
               where a.job_id = j.id
                 and a.worker_id = p_worker_id
                 and a.status not in ('withdrawn', 'declined')
             )))
    and (j.start_date is null
         or j.start_date > (coalesce(p_now, clock_timestamp()) at time zone 'UTC')::date
         or (j.start_date = (coalesce(p_now, clock_timestamp()) at time zone 'UTC')::date
             and (j.start_time is null or j.start_time > (coalesce(p_now, clock_timestamp()) at time zone 'UTC')::time)))
    and (p_latitude is null
         or p_longitude is null
         or p_hard_max_commute_km is null
         or j.location is null
         or st_dwithin(
              j.location,
              st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
              (p_hard_max_commute_km * 1000)::double precision
            ))
$$;

revoke all on function public.homlo_eligible_candidates(uuid, double precision, double precision, numeric, timestamptz)
from public, anon, authenticated;

grant execute on function public.homlo_eligible_candidates(uuid, double precision, double precision, numeric, timestamptz)
to service_role;
