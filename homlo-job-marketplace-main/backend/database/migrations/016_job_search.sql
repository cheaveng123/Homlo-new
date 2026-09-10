-- =========================================================
-- 016_job_search.sql
-- Enable pg_trgm and create search indexes + RPC for natural-language job search
--
-- v2: relevance is now based on PARTIAL / multi-keyword matching:
--   - A job is eligible when it matches ANY keyword in the query (not all of
--     them) or shares meaningful trigram similarity (related/partial terms).
--   - Jobs are RANKED by how many / how strongly their fields match, with title
--     matches weighted above description matches.
--   - Added a p_bbox geographic filter so a drawn polygon area (sent as its
--     bounding box) narrows results to jobs whose coordinates fall inside it.
-- =========================================================

-- Enable pg_trgm extension for trigram similarity (typo tolerance)
create extension if not exists "pg_trgm";

-- =========================================================
-- Search indexes for full-text and trigram similarity
-- =========================================================

-- GIN index on jobs for full-text search across title, description, location_text
create index if not exists idx_jobs_search_fts on jobs
using gin (
  to_tsvector('simple',
    coalesce(title, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(location_text, '')
  )
) where deleted_at is null and status = 'open';

-- GIN trigram index on jobs.title for fuzzy matching
create index if not exists idx_jobs_title_trgm on jobs
using gin (title gin_trgm_ops) where deleted_at is null;

-- GIN trigram index on jobs.description for fuzzy matching
create index if not exists idx_jobs_description_trgm on jobs
using gin (description gin_trgm_ops) where deleted_at is null;

-- GIN trigram index on jobs.location_text for location fuzzy matching
create index if not exists idx_jobs_location_text_trgm on jobs
using gin (location_text gin_trgm_ops) where deleted_at is null;

-- GIN trigram index on categories.name for category fuzzy matching
create index if not exists idx_categories_name_trgm on categories
using gin (name gin_trgm_ops);

-- =========================================================
-- Search RPC function for public job search
-- =========================================================

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
  p_bbox text default ''  -- 'minLat,minLng,maxLat,maxLng' from a drawn polygon
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
  relevance_score numeric
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
  v_bbox_min_lat double precision;
  v_bbox_min_lng double precision;
  v_bbox_max_lat double precision;
  v_bbox_max_lng double precision;
  v_bbox_ok boolean := false;
begin
  -- ------------------------------------------------------------------
  -- Partial-match keyword relevance
  -- ------------------------------------------------------------------
  -- Split the query into individual lexemes so we can rank by "how many"
  -- keywords a job matches instead of requiring every keyword to be present.
  if trim(coalesce(p_query, '')) <> '' then
    -- Split the query into individual words (lowercased, matching the 'simple'
    -- text configuration) so we can rank by "how many keywords match".
    select array_agg(t) into v_terms
      from regexp_split_to_table(lower(trim(p_query)), '[^a-z0-9_]+') as t
      where t <> '';

    foreach v_term in array v_terms loop
      if trim(coalesce(v_term, '')) = '' then
        continue;
      end if;

      -- OR-query: match if ANY keyword appears in the combined text.
      v_or_query := v_or_query || (case when v_or_query = '' then '' else ' || ' end)
                    || format('to_tsquery(''simple'', %L)', v_term);

      -- Per-term rank against title and description so jobs matching more
      -- keywords (or matching them in the title) score higher.
      v_title_rank := v_title_rank || (case when v_title_rank = '' then '' else ' + ' end)
                      || format('coalesce(ts_rank_cd(to_tsvector(''simple'', coalesce(j.title, '''')), to_tsquery(''simple'', %L), 32), 0)', v_term);
      v_desc_rank := v_desc_rank || (case when v_desc_rank = '' then '' else ' + ' end)
                     || format('coalesce(ts_rank_cd(to_tsvector(''simple'', coalesce(j.description, '''')), to_tsquery(''simple'', %L), 32), 0)', v_term);
    end loop;

    if v_or_query <> '' then
      -- Eligibility: the job matches at least one keyword in the combined text.
      v_fts_where := format(
        'to_tsvector(''simple'', coalesce(j.title, '''') || '' '' || coalesce(j.description, '''') || '' '' || coalesce(j.location_text, '''')) @@ (%s)',
        v_or_query
      );
      v_where_clauses := v_where_clauses || v_fts_where;
    end if;

    -- Related / partial-term eligibility & boost via trigram similarity on the
    -- whole query, so a job that doesn't literally contain a keyword but is
    -- clearly related ("retail assistant" for "cashier") can still appear.
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

  -- Category filter (by name or slug)
  if trim(coalesce(p_category, '')) <> '' and trim(p_category) <> 'All' then
    v_where_clauses := v_where_clauses || format('c.name = %L', trim(p_category));
    v_relevance_expr := v_relevance_expr || ' + 0.4';
  end if;

  -- Location filter (fuzzy match on location_text using trigram)
  if trim(coalesce(p_location, '')) <> '' then
    v_location_normalized := trim(p_location);
    v_where_clauses := v_where_clauses || format('j.location_text %% %L', v_location_normalized);
    -- Boost relevance for location matches
    v_relevance_expr := v_relevance_expr || format(' + similarity(j.location_text, %L) * 0.5', v_location_normalized);
  end if;

  -- Employment type filter (match against pay_type and inferred from description)
  -- Note: Database doesn't have a dedicated employment_type column, so we infer from pay_type and keywords
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
    -- Boost relevance for employment type matches
    v_relevance_expr := v_relevance_expr || ' + 0.3';
  end if;

  -- Arrangement filter (remote/on-site/hybrid inferred from location_text)
  if trim(coalesce(p_arrangement, '')) <> '' and trim(p_arrangement) <> 'Any' then
    if trim(p_arrangement) = 'Remote' then
      v_where_clauses := v_where_clauses || '(j.location_text ilike ''%remote%'' or j.location_text ilike ''%cambodia%'' or j.location_text is null)'::text;
    elsif trim(p_arrangement) = 'On-site' then
      v_where_clauses := v_where_clauses || '(j.location_text not ilike ''%remote%'' and j.location_text not ilike ''%cambodia%'' and j.location_text is not null)'::text;
    elsif trim(p_arrangement) = 'Hybrid' then
      v_where_clauses := v_where_clauses || '(j.title ilike ''%hybrid%'' or j.description ilike ''%hybrid%'')'::text;
    end if;
  end if;

  -- Experience filter (inferred from description keywords)
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

  -- Salary range filter
  if p_salary_min is not null and p_salary_min > 0 then
    v_where_clauses := v_where_clauses || format('j.pay_amount >= %L', p_salary_min);
  end if;
  if p_salary_max is not null and p_salary_max > 0 then
    v_where_clauses := v_where_clauses || format('j.pay_amount <= %L', p_salary_max);
  end if;

  -- Posted date filter
  if trim(coalesce(p_posted, '')) <> '' and trim(p_posted) <> 'Any time' then
    if trim(p_posted) = 'Today' then
      v_where_clauses := v_where_clauses || 'j.created_at >= now() - interval ''24 hours'''::text;
    elsif trim(p_posted) = 'This week' then
      v_where_clauses := v_where_clauses || 'j.created_at >= now() - interval ''7 days'''::text;
    elsif trim(p_posted) = 'This month' then
      v_where_clauses := v_where_clauses || 'j.created_at >= now() - interval ''30 days'''::text;
    end if;
  end if;

  -- Geographic filter - radius search
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

  -- Geographic filter - bounding box of a drawn polygon ('minLat,minLng,maxLat,maxLng')
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

  -- Sort order
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
    -- Recommended: relevance first, then recency as tiebreaker.
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
      jm.storage_key as banner_image,
      (%s)::numeric as relevance_score
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

-- Revoke from public roles, grant only to service_role
revoke all on function public.homlo_search_public_jobs(text, text, text, text, text, text, numeric, numeric, text, double precision, double precision, double precision, text, int, int, text) from public, anon, authenticated;
grant execute on function public.homlo_search_public_jobs(text, text, text, text, text, text, numeric, numeric, text, double precision, double precision, double precision, text, int, int, text) to service_role;
