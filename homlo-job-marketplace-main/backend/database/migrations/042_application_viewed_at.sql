-- =========================================================
-- 042_application_viewed_at.sql
-- Give applications a real read receipt, so the employer side
-- can tell "this applicant I have not opened yet" from "this
-- applicant I have already looked at".
--
-- Until now `isNew` was derived from `status = 'applied'` on
-- the client, which overloaded pipeline state with read state:
-- opening an applicant had to mutate `status` to 'reviewed' to
-- look at it, that transition is irreversible (the tRPC enum has
-- no path back to 'applied'), and `updated_at` was the only
-- timestamp, indistinguishable from "the employer started
-- reviewing". Messages and notifications have had read receipts
-- all along (messages.read_at, notifications.read); applications
-- had none.
--
-- This migration:
--   1. adds applications.viewed_at,
--   2. backfills it so existing data keeps today's meaning,
--   3. adds homlo_mark_application_viewed, which authorises in
--      SQL because every gateway function runs as service_role
--      and therefore bypasses RLS,
--   4. recreates homlo_list_employer_applications_detailed to
--      return viewed_at. That needs a DROP first: Postgres refuses
--      `create or replace` when the return table changes, which
--      is why 034 dropped it the same way.
--
-- Nothing about application *status* changes here, and no
-- notification fires on a read receipt.
-- =========================================================

-- ---------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------
alter table applications
  add column if not exists viewed_at timestamptz;

comment on column applications.viewed_at is
  'When the listing employer first opened this application. Null means unread. Independent of pipeline status.';

-- Supports "how many applicants on this job are still new", which
-- every employer list screen and both counts on the dashboard
-- stat card now need.
create index if not exists applications_job_viewed_at_idx
  on applications (job_id, viewed_at);

-- ---------------------------------------------------------
-- 2. Backfill
--
-- Only rows still sitting in 'applied' are treated as unread.
-- Anything further along the funnel has demonstrably been seen,
-- so it is stamped with its own updated_at. This makes the
-- post-migration unread count identical to the pre-migration
-- `status = 'applied'` count instead of jumping to every
-- application ever submitted.
-- ---------------------------------------------------------
update applications
set viewed_at = updated_at
where viewed_at is null
  and status <> 'applied';

-- ---------------------------------------------------------
-- 3. homlo_mark_application_viewed
--
-- Idempotent and first-write-wins: `coalesce(viewed_at, now())`
-- means re-opening an applicant keeps the original read time.
-- Only the listing employer may mark it, mirroring the owner
-- check in homlo_change_application_status.
-- ---------------------------------------------------------
create or replace function public.homlo_mark_application_viewed(
  p_actor_id uuid,
  p_application_id uuid
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

  select * into v_job from jobs where id = v_application.job_id and deleted_at is null;
  if not found then
    raise exception 'Job not found';
  end if;

  if v_job.employer_id <> p_actor_id then
    raise exception 'Only the listing employer can mark an application as viewed';
  end if;

  if v_application.viewed_at is not null then
    return v_application;
  end if;

  -- Deliberately leaves updated_at alone: a read receipt is not
  -- an edit, and bumping it would reorder the applicant's list.
  update applications
    set viewed_at = now()
    where id = v_application.id
    returning * into v_application;

  return v_application;
end;
$$;

revoke all on function public.homlo_mark_application_viewed(uuid, uuid) from public, anon, authenticated;
grant execute on function public.homlo_mark_application_viewed(uuid, uuid) to service_role;

-- ---------------------------------------------------------
-- 4. Recreate the employer read model with viewed_at
-- ---------------------------------------------------------
drop function if exists public.homlo_list_employer_applications_detailed(uuid, uuid);

create or replace function public.homlo_list_employer_applications_detailed(p_employer_id uuid, p_job_id uuid)
returns table (
  id uuid,
  job_id uuid,
  worker_id uuid,
  status text,
  message text,
  created_at timestamptz,
  updated_at timestamptz,
  viewed_at timestamptz,
  worker_full_name text,
  worker_location text,
  worker_bio text,
  worker_photo_key text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select a.id, a.job_id, a.worker_id, a.status, a.message, a.created_at, a.updated_at, a.viewed_at, p.full_name, p.location_text, p.bio, p.profile_photo_key
  from applications a
  join jobs j on j.id = a.job_id and j.deleted_at is null
  join profiles p on p.user_id = a.worker_id and p.deleted_at is null
  where j.employer_id = p_employer_id and a.job_id = p_job_id
  order by a.created_at desc;
$$;

revoke all on function public.homlo_list_employer_applications_detailed(uuid, uuid) from public, anon, authenticated;
grant execute on function public.homlo_list_employer_applications_detailed(uuid, uuid) to service_role;