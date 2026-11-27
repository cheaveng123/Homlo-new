-- =========================================================
-- 036_auto_close_and_notifications.sql
-- Auto-close behavior + the three applicant notifications
-- (application_accepted / application_declined / job_filled).
--
-- Adapted from the attached feature spec to the REAL schema:
--   * jobs already has workers_needed + workers_hired (no
--     positions_available column) and the status enum already
--     includes 'filled' — only jobs.auto_close_enabled is new.
--   * applications uses worker_id (not applicant_id).
--   * notifications has `read boolean` (not read_at) and no
--     job_id/application_id columns — those two are added.
--
-- The auto-close DECISION (count hired vs needed, flip to
-- 'filled', fire notifications) lives in a trigger so it stays
-- atomic and correct even when two applications are accepted at
-- nearly the same time. The app only reads/writes the toggle and
-- reads the resulting status.
-- =========================================================

-- ---------------------------------------------------------
-- 1. jobs.auto_close_enabled (default true == existing behavior)
-- ---------------------------------------------------------
alter table public.jobs
  add column if not exists auto_close_enabled boolean not null default true;

-- ---------------------------------------------------------
-- 2. notifications: carry the job/application references so the
--    client can map a row to the job-detail / application-detail
--    screens. Unread state stays on the existing `read` column.
-- ---------------------------------------------------------
alter table public.notifications
  add column if not exists job_id uuid references public.jobs (id) on delete cascade;

alter table public.notifications
  add column if not exists application_id uuid references public.applications (id) on delete cascade;

create index if not exists idx_notifications_user_type_created
  on public.notifications (user_id, type, created_at desc);

-- ---------------------------------------------------------
-- 3. notify_user
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- 4. maybe_auto_close_job — checks whether the job should
--    auto-close, and if so flips it to 'filled' and notifies
--    every applicant who still has a pending application.
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- 5. handle_application_status_change — fires on any application
--    status update; emits the applicant-facing notifications and
--    runs the auto-close check.
-- ---------------------------------------------------------
create or replace function public.handle_application_status_change() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
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

drop trigger if exists trg_application_status_change on public.applications;

create trigger trg_application_status_change
  after update of status on public.applications
  for each row
  execute function public.handle_application_status_change();

-- ---------------------------------------------------------
-- 6. homlo_change_application_status (012) — recreated so the
--    status flip + notifications are owned by the trigger, not
--    this function:
--      * the unconditional "jobs.status = 'filled'" flip is
--        removed (maybe_auto_close_job only flips when
--        auto_close_enabled is on),
--      * the capacity guard is gated on auto_close_enabled,
--      * the manual decline notification insert is removed (the
--        trigger emits application_declined), so a decline only
--        ever notifies ONCE.
-- ---------------------------------------------------------
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
    if v_application.status <> 'interview' then
      raise exception 'Only interviewed applicants can be hired';
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

-- ---------------------------------------------------------
-- 7. homlo_submit_application (031) — the apply-guard only
--    rejects over-capacity jobs when auto-close is enabled. When
--    auto-close is off the job stays open regardless of the hired
--    count, matching the featured setting copy.
-- ---------------------------------------------------------
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
  v_app_id uuid;
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
  if not found
     or v_job.status <> 'open'
     or (coalesce(v_job.auto_close_enabled, true) and v_job.workers_hired >= v_job.workers_needed) then
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

-- ---------------------------------------------------------
-- 8. homlo_save_job (035) — adds p_auto_close_enabled (appended
--    after p_requirements so positional callers are unaffected),
--    persists it on insert/update, and only auto-flips to
--    'filled' when auto-close is enabled. Preserves every other
--    behavioural guarantee from 025/027/035.
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
  p_requirements text default null,
  p_auto_close_enabled boolean default true
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
    insert into jobs (employer_id, category_id, title, description, pay_amount, pay_currency, pay_type, location_text, latitude, longitude, workers_needed, status, address_line, city, district, province, country, postal_code, banner_image, requirements, auto_close_enabled)
    values (p_employer_id, p_category_id, v_title, v_description, v_pay_amount, coalesce(nullif(trim(p_pay_currency), ''), 'USD'), v_pay_type, nullif(trim(coalesce(p_location_text, '')), ''), p_latitude, p_longitude, v_workers_needed, p_status, nullif(trim(coalesce(p_address_line, '')), ''), nullif(trim(coalesce(p_city, '')), ''), nullif(trim(coalesce(p_district, '')), ''), nullif(trim(coalesce(p_province, '')), ''), nullif(trim(coalesce(p_country, '')), ''), nullif(trim(coalesce(p_postal_code, '')), ''), nullif(trim(coalesce(p_banner_image, '')), ''), nullif(trim(coalesce(p_requirements, '')), ''), coalesce(p_auto_close_enabled, true))
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

revoke all on function public.homlo_save_job(uuid, uuid, uuid, text, text, numeric, text, text, text, double precision, double precision, integer, text, text, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.homlo_save_job(uuid, uuid, uuid, text, text, numeric, text, text, text, double precision, double precision, integer, text, text, text, text, text, text, text, text, text, boolean) to service_role;

-- ---------------------------------------------------------
-- 9. homlo_set_job_auto_close — the repository helper for
--    toggling auto-close on an existing job (ownership-scoped).
-- ---------------------------------------------------------
create or replace function public.homlo_set_job_auto_close(
  p_employer_id uuid,
  p_job_id uuid,
  p_auto_close_enabled boolean
)
returns jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job jobs%rowtype;
begin
  update jobs
    set auto_close_enabled = p_auto_close_enabled,
        updated_at = now()
  where id = p_job_id
    and employer_id = p_employer_id
    and deleted_at is null
  returning * into v_job;

  if not found then
    raise exception 'Only the listing employer can change this setting';
  end if;

  return v_job;
end;
$$;

revoke all on function public.homlo_set_job_auto_close(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.homlo_set_job_auto_close(uuid, uuid, boolean) to service_role;

-- ---------------------------------------------------------
-- 10. Notifications read model + mark-read for the Alerts screen.
--     Only the three applicant-facing types are exposed; the
--     job title is joined so the row maps straight to the
--     existing list row / getNotificationTarget.
-- ---------------------------------------------------------
create or replace function public.homlo_list_user_notifications(p_user_id uuid)
returns table (
  id uuid,
  type text,
  title text,
  body text,
  read boolean,
  created_at timestamptz,
  job_id uuid,
  application_id uuid,
  job_title text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    n.id,
    n.type,
    n.title,
    n.body,
    n.read,
    n.created_at,
    n.job_id,
    n.application_id,
    j.title as job_title
  from notifications n
  left join jobs j on j.id = n.job_id
  where n.user_id = p_user_id
    and n.type in ('application_accepted', 'application_declined', 'job_filled')
  order by n.created_at desc
  limit 200;
$$;

revoke all on function public.homlo_list_user_notifications(uuid) from public, anon, authenticated;
grant execute on function public.homlo_list_user_notifications(uuid) to service_role;

create or replace function public.homlo_mark_notification_read(
  p_user_id uuid,
  p_notification_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update notifications
    set read = true
  where id = p_notification_id and user_id = p_user_id;
end;
$$;

revoke all on function public.homlo_mark_notification_read(uuid, uuid) from public, anon, authenticated;
grant execute on function public.homlo_mark_notification_read(uuid, uuid) to service_role;

-- ---------------------------------------------------------
-- 11. Public feed — append status + workers_hired so the Job
--     Detail screens and JobStatusPill read them from the SAME
--     usePublishedJobs data chain (no second fetch). Keeps the
--     open-only filter so browse/search are unaffected. Shape
--     changes, so the function is dropped and recreated exactly
--     like migration 026 did.
-- ---------------------------------------------------------
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
  workers_hired integer
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
    j.workers_hired
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