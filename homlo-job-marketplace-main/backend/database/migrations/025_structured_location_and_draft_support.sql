-- =========================================================
-- 025_structured_location_and_draft_support.sql
-- Adds structured location columns + banner_image to jobs, and
-- rewrites public.homlo_save_job so that:
--   * it accepts the p_banner_image argument the gateway always sends
--     (previously a PostgREST PGRST202 -> every save-job call failed),
--   * it accepts structured address components (address_line, city,
--     district, province, country, postal_code) so the map picker can
--     persist normalized location data instead of only a display string,
--   * it relaxes validation for status='draft' so a PARTIAL job form can
--     be saved reliably (title/description/pay optional while still a
--     draft), while keeping the strict checks for published jobs.
-- Ranking continues to use jobs.latitude/longitude (+ the geography
-- `location` column synced by trigger trg_homlo_jobs_location_sync): this
-- migration only widens what a job can store, it never changes the
-- geographic scoring/retrieval behaviour.
-- =========================================================

alter table jobs
  add column if not exists address_line text,
  add column if not exists city text,
  add column if not exists district text,
  add column if not exists province text,
  add column if not exists country text,
  add column if not exists postal_code text,
  add column if not exists banner_image text;

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
  p_banner_image text default null
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

  v_title := coalesce(trim(p_title), '');
  v_description := coalesce(trim(p_description), '');
  v_pay_amount := coalesce(p_pay_amount, 0);
  v_workers_needed := greatest(coalesce(p_workers_needed, 1), 1);
  v_pay_type := coalesce(p_pay_type, 'fixed');

  if p_job_id is null then
    insert into jobs (employer_id, category_id, title, description, pay_amount, pay_currency, pay_type, location_text, latitude, longitude, workers_needed, status, address_line, city, district, province, country, postal_code, banner_image)
    values (p_employer_id, p_category_id, v_title, v_description, v_pay_amount, coalesce(nullif(trim(p_pay_currency), ''), 'USD'), v_pay_type, nullif(trim(coalesce(p_location_text, '')), ''), p_latitude, p_longitude, v_workers_needed, p_status, nullif(trim(coalesce(p_address_line, '')), ''), nullif(trim(coalesce(p_city, '')), ''), nullif(trim(coalesce(p_district, '')), ''), nullif(trim(coalesce(p_province, '')), ''), nullif(trim(coalesce(p_country, '')), ''), nullif(trim(coalesce(p_postal_code, '')), ''), nullif(trim(coalesce(p_banner_image, '')), ''))
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