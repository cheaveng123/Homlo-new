-- 001_auto_close_and_notifications.sql
--
-- Adds auto-close behavior and the three application notifications
-- (accepted / declined / job filled) on top of the EXISTING jobs,
-- applications, and notifications tables. Written as a version-controlled
-- migration per the project's schema convention — do not apply by hand
-- in the dashboard.
--
-- ASSUMPTIONS — adjust column/table names to match the real schema before
-- applying:
--   jobs(id, employer_id, title, positions_available int, status text,
--        auto_close_enabled boolean)
--   applications(id, job_id, applicant_id, status text)
--     status values: applied | reviewed | interview | hired | declined | withdrawn
--   notifications(id, user_id, type text, job_id uuid, application_id uuid,
--                  read_at timestamptz, created_at timestamptz default now())
--
-- If auto_close_enabled or a "filled" job status don't exist yet, add them
-- here. If they already exist under different names, delete these two
-- ALTER statements and adjust the function bodies instead of creating
-- duplicate columns.

alter table jobs
  add column if not exists auto_close_enabled boolean not null default true;

-- Only add a 'filled' status value if the existing status check doesn't
-- already cover it (e.g. via a 'closed' status that already means this).
-- Confirm before running:
-- alter table jobs drop constraint if exists jobs_status_check;
-- alter table jobs add constraint jobs_status_check
--   check (status in ('draft','review','open','filled','closed'));

create or replace function notify_user(
  p_user_id uuid,
  p_type text,
  p_job_id uuid,
  p_application_id uuid
) returns void as $$
begin
  insert into notifications (user_id, type, job_id, application_id)
  values (p_user_id, p_type, p_job_id, p_application_id);
end;
$$ language plpgsql;

-- Checks whether a job should auto-close, and if so, flips its status and
-- notifies every applicant who still has a pending application.
create or replace function maybe_auto_close_job(p_job_id uuid) returns void as $$
declare
  v_job jobs%rowtype;
  v_hired_count int;
begin
  select * into v_job from jobs where id = p_job_id for update;

  if v_job.status <> 'open' or not v_job.auto_close_enabled then
    return;
  end if;

  select count(*) into v_hired_count
  from applications
  where job_id = p_job_id and status = 'hired';

  if v_hired_count >= v_job.positions_available then
    update jobs set status = 'filled' where id = p_job_id;

    -- notify applicants who are still pending (not hired/declined/withdrawn)
    insert into notifications (user_id, type, job_id, application_id)
    select applicant_id, 'job_filled', job_id, id
    from applications
    where job_id = p_job_id
      and status in ('applied', 'reviewed', 'interview');
  end if;
end;
$$ language plpgsql;

-- Fires on any application status change; handles the applicant-facing
-- accepted/declined notifications and triggers the auto-close check.
create or replace function handle_application_status_change() returns trigger as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'hired' then
      perform notify_user(new.applicant_id, 'application_accepted', new.job_id, new.id);
      perform maybe_auto_close_job(new.job_id);
    elsif new.status = 'declined' then
      perform notify_user(new.applicant_id, 'application_declined', new.job_id, new.id);
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_application_status_change on applications;

create trigger trg_application_status_change
  after update of status on applications
  for each row
  execute function handle_application_status_change();
