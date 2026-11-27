-- Public read policies
drop policy if exists "categories readable by everyone" on public.categories;
create policy "categories readable by everyone" on public.categories
for select to anon, authenticated using (true);

drop policy if exists "open jobs readable by everyone" on public.jobs;
create policy "open jobs readable by everyone" on public.jobs
for select to anon, authenticated
using (status = 'open' and deleted_at is null);

drop policy if exists "plans readable" on public.plan_catalog;
create policy "plans readable" on public.plan_catalog
for select to anon, authenticated using (true);

drop policy if exists "job stats readable" on public.job_stats;
create policy "job stats readable" on public.job_stats
for select to anon, authenticated using (true);

drop policy if exists "global stats readable" on public.job_stats_global;
create policy "global stats readable" on public.job_stats_global
for select to anon, authenticated using (true);

drop policy if exists "job quality readable" on public.job_quality_stats;
create policy "job quality readable" on public.job_quality_stats
for select to anon, authenticated using (true);

drop policy if exists "employer quality readable" on public.employer_quality_stats;
create policy "employer quality readable" on public.employer_quality_stats
for select to anon, authenticated using (true);

drop policy if exists "media of open jobs readable" on public.job_media;
create policy "media of open jobs readable" on public.job_media
for select to anon, authenticated
using (exists (
  select 1 from public.jobs j
  where j.id = job_media.job_id and j.status = 'open' and j.deleted_at is null
));

-- Safe public view of profiles (no phone or coordinates)
create or replace view public.public_profiles as
select user_id, role, full_name, profile_photo_key, banner_image, verified
from public.profiles
where deleted_at is null;

grant select on public.public_profiles to anon, authenticated;

-- Map the Supabase auth user to the app user id
create or replace function public.current_app_user_id()
returns public.user_identities.user_id%type
language sql
stable
security definer
set search_path = ''
as $$
  select ui.user_id
  from public.user_identities ui
  where ui.provider = 'supabase'
    and ui.provider_user_id::text = auth.uid()::text
    and ui.deleted_at is null
  limit 1
$$;

grant execute on function public.current_app_user_id() to authenticated;

-- Owner-only policies
drop policy if exists "own saved jobs" on public.saved_jobs;
create policy "own saved jobs" on public.saved_jobs
for all to authenticated
using (user_id = public.current_app_user_id())
with check (user_id = public.current_app_user_id());

drop policy if exists "worker reads own applications" on public.applications;
create policy "worker reads own applications" on public.applications
for select to authenticated
using (worker_id = public.current_app_user_id());

drop policy if exists "worker creates own applications" on public.applications;
create policy "worker creates own applications" on public.applications
for insert to authenticated
with check (worker_id = public.current_app_user_id());

drop policy if exists "employer reads own boosts" on public.boosts;
create policy "employer reads own boosts" on public.boosts
for select to authenticated
using (employer_id = public.current_app_user_id());
