create table if not exists public.job_events_anon (
  id bigint generated always as identity primary key,
  job_id uuid not null,
  event_type text not null,
  session_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists job_events_anon_job_type_idx
  on public.job_events_anon (job_id, event_type);

alter table public.job_events_anon enable row level security;

grant select, insert, update, delete on public.job_events_anon to service_role;

create or replace function public.enforce_job_capacity_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hired_count int;
begin
  if new.id is not null then
    select count(*)::int into v_hired_count
    from applications
    where job_id = new.id and status = 'hired';
    new.workers_hired := v_hired_count;
  end if;

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
  elsif new.status = 'filled'
        and (new.workers_needed <= 0 or new.workers_hired < new.workers_needed)
        and (new.end_date is null or new.end_date >= current_date) then
    new.status := 'open';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobs_capacity_status on public.jobs;
create trigger trg_jobs_capacity_status
  before insert or update of status, workers_hired, workers_needed, end_date, deleted_at
  on public.jobs
  for each row
  execute function public.enforce_job_capacity_status();

create or replace function public.handle_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
begin
  if tg_op = 'DELETE' then
    v_job_id := old.job_id;
  else
    v_job_id := new.job_id;
  end if;

  if tg_op = 'UPDATE' and new.job_id is distinct from old.job_id then
    update jobs set workers_hired = workers_hired where id = old.job_id;
  end if;

  if v_job_id is not null then
    update jobs set workers_hired = workers_hired where id = v_job_id;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'hired' then
      perform public.notify_user(new.worker_id, 'application_accepted', new.job_id, new.id);
      perform public.maybe_auto_close_job(new.job_id);
    elsif new.status = 'declined' then
      perform public.notify_user(new.worker_id, 'application_declined', new.job_id, new.id);
    end if;
  elsif tg_op = 'INSERT' and new.status = 'hired' then
    perform public.notify_user(new.worker_id, 'application_accepted', new.job_id, new.id);
    perform public.maybe_auto_close_job(new.job_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_application_status_change on public.applications;
create trigger trg_application_status_change
  after update of status, job_id on public.applications
  for each row
  execute function public.handle_application_status_change();

drop trigger if exists trg_application_capacity_ledger on public.applications;
create trigger trg_application_capacity_ledger
  after insert or delete on public.applications
  for each row
  execute function public.handle_application_status_change();

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
    b.id as boost_id, b.package_id as boost_package, b.ends_at as boost_expires_at,
    j.requirements,
    c.name as category,
    (
      select count(distinct e.session_id)::bigint
      from job_events_anon e
      where e.job_id = j.id and e.event_type = 'view'
    ) as views_count,
    j.work_arrangement
  from jobs j
  left join categories c on c.id = j.category_id
  left join lateral (
    select b.id, b.package_id, b.ends_at
    from job_boosts b
    where b.job_id = j.id
      and b.status = 'active'
      and b.ends_at > now()
    order by b.created_at desc
    limit 1
  ) b on true
  where j.employer_id = p_employer_id and j.deleted_at is null
  order by j.updated_at desc;
$$;

revoke all on function public.homlo_list_employer_jobs_with_boosts(uuid) from public, anon, authenticated;
grant execute on function public.homlo_list_employer_jobs_with_boosts(uuid) to service_role;

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
  and (j.workers_hired < j.workers_needed or j.workers_needed = 0)
  and (j.end_date is null or j.end_date >= current_date);
