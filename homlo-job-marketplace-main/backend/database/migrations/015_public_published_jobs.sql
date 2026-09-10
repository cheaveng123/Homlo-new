-- 015_public_published_jobs.sql
-- Public discovery read model. Client apps never receive table access or
-- service credentials; the server calls this function through a public feed
-- Edge Function.

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
  employer_photo_key text
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
    p.profile_photo_key as employer_photo_key
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

