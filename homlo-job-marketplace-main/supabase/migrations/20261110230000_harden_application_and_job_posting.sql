-- Harden application submission, blocking, trigger permissions,
-- and monthly job-post enforcement.
-- Prepared locally for review. Do not apply without a database backup.

BEGIN;

-- Backfill missing publication events for jobs published during the
-- current UTC calendar month. Do not duplicate existing events.
WITH current_period AS (
  SELECT date_trunc('month', timezone('UTC', now()))::date AS period_start
)
INSERT INTO public.job_post_events (
  employer_id,
  job_id,
  event_type,
  billing_period_start
)
SELECT
  j.employer_id,
  j.id,
  'published',
  cp.period_start
FROM public.jobs j
CROSS JOIN current_period cp
WHERE j.published_at >= (cp.period_start::timestamp AT TIME ZONE 'UTC')
  AND j.published_at < ((cp.period_start + interval '1 month')::timestamp AT TIME ZONE 'UTC')
  AND NOT EXISTS (
    SELECT 1
    FROM public.job_post_events e
    WHERE e.job_id = j.id
      AND e.billing_period_start = cp.period_start
  );

-- Prevent duplicate application notifications and enforce blocking
-- in the database, independently of client-side checks.
CREATE OR REPLACE FUNCTION public.homlo_submit_application(
  p_worker_id uuid,
  p_job_id uuid,
  p_message text DEFAULT NULL
)
RETURNS applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_job jobs%rowtype;
  v_application applications%rowtype;
  v_worker_role text;
  v_conversation conversations%rowtype;
  v_worker_name text;
  v_previous_status text;
  v_should_notify boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = p_worker_id AND deleted_at IS NULL
  ) THEN
    INSERT INTO profiles (user_id, role, full_name)
    VALUES (p_worker_id, 'worker', 'Worker')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  SELECT role INTO v_worker_role
  FROM profiles
  WHERE user_id = p_worker_id AND deleted_at IS NULL;

  IF v_worker_role IS NULL OR v_worker_role NOT IN ('worker', 'both') THEN
    RAISE EXCEPTION 'A worker profile is required to apply';
  END IF;

  SELECT * INTO v_job
  FROM jobs
  WHERE id = p_job_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This job is no longer accepting applications';
  END IF;

  IF v_job.status <> 'open' THEN
    RAISE EXCEPTION 'This job is no longer accepting applications';
  END IF;

  IF v_job.end_date IS NOT NULL AND v_job.end_date < current_date THEN
    RAISE EXCEPTION 'This job has expired';
  END IF;

  IF v_job.workers_needed > 0
     AND v_job.workers_hired >= v_job.workers_needed THEN
    RAISE EXCEPTION 'This job is already filled';
  END IF;

  IF v_job.employer_id = p_worker_id THEN
    RAISE EXCEPTION 'Employers cannot apply to their own jobs';
  END IF;

  -- Lock existing membership rows so a concurrent block operation
  -- cannot race past the application check.
  PERFORM 1
  FROM conversations c
  JOIN conversation_members cm ON cm.conversation_id = c.id
  WHERE c.user_low = LEAST(p_worker_id, v_job.employer_id)
    AND c.user_high = GREATEST(p_worker_id, v_job.employer_id)
    AND c.deleted_at IS NULL
  FOR UPDATE OF cm;

  -- Either participant blocking the other prevents this application.
  IF EXISTS (
    SELECT 1
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id = c.id
    WHERE c.user_low = LEAST(p_worker_id, v_job.employer_id)
      AND c.user_high = GREATEST(p_worker_id, v_job.employer_id)
      AND c.deleted_at IS NULL
      AND cm.user_id IN (p_worker_id, v_job.employer_id)
      AND cm.blocked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'You cannot apply because one of the participants has blocked the other';
  END IF;

  -- Determine whether this is a new application or a valid reapplication.
  SELECT status INTO v_previous_status
  FROM applications
  WHERE job_id = p_job_id AND worker_id = p_worker_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_should_notify := true;
  ELSIF v_previous_status IN ('withdrawn', 'declined') THEN
    v_should_notify := true;
  END IF;

  INSERT INTO applications (job_id, worker_id, status, message)
  VALUES (
    p_job_id,
    p_worker_id,
    'applied',
    NULLIF(TRIM(COALESCE(p_message, '')), '')
  )
  ON CONFLICT (job_id, worker_id) DO UPDATE SET
    status = CASE
      WHEN applications.status IN ('withdrawn', 'declined')
        THEN 'applied'
      ELSE applications.status
    END,
    message = CASE
      WHEN applications.status IN ('withdrawn', 'declined')
        THEN EXCLUDED.message
      ELSE applications.message
    END
  RETURNING * INTO v_application;

  SELECT * INTO v_conversation
  FROM public.homlo_get_or_create_conversation(
    p_worker_id,
    v_application.id
  );

  IF v_should_notify AND v_application.status = 'applied' THEN
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (
      v_job.employer_id,
      'new_application',
      'New application',
      'A worker applied to your job.'
    );

    SELECT COALESCE(p.full_name, 'A worker')
    INTO v_worker_name
    FROM profiles p
    WHERE p.user_id = p_worker_id AND p.deleted_at IS NULL;

    INSERT INTO messages (
      conversation_id, sender_id, message,
      message_type, updated_at, application_id
    )
    VALUES (
      v_conversation.id,
      p_worker_id,
      COALESCE(v_worker_name, 'A worker') || ' applied to your job.',
      'application',
      now(),
      v_application.id
    )
    ON CONFLICT DO NOTHING;

    UPDATE conversations
    SET last_message_at = now()
    WHERE id = v_conversation.id;
  END IF;

  RETURN v_application;
END;
$function$;

-- Enforce monthly posting limits for every publication path, including
-- direct calls to homlo_save_job through the service gateway.
CREATE OR REPLACE FUNCTION public.homlo_save_job(
  p_employer_id uuid,
  p_job_id uuid,
  p_category_id uuid,
  p_title text,
  p_description text,
  p_pay_amount numeric,
  p_pay_currency text,
  p_pay_type text,
  p_location_text text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_workers_needed integer DEFAULT 1,
  p_status text DEFAULT 'draft',
  p_address_line text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_district text DEFAULT NULL,
  p_province text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_banner_image text DEFAULT NULL,
  p_requirements text DEFAULT NULL,
  p_auto_close_enabled boolean DEFAULT true,
  p_work_arrangement text DEFAULT NULL
)
RETURNS jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_job jobs%rowtype;
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
  v_existing_status text;
  v_existing_limit_exempt boolean;
  v_existing_published_at timestamptz;
  v_is_publish_transition boolean := false;
  v_grandfathered_draft boolean := false;
  v_consumes_post boolean := false;
  v_billing_period_start date;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = p_employer_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'An active Homlo profile is required to manage jobs';
  END IF;

  IF p_status NOT IN ('draft', 'open', 'closed', 'cancelled') THEN
    RAISE EXCEPTION 'Job status is invalid';
  END IF;

  v_work_arrangement := NULLIF(TRIM(COALESCE(p_work_arrangement, '')), '');

  IF v_work_arrangement IS NOT NULL
     AND v_work_arrangement NOT IN ('On-site', 'Hybrid', 'Remote') THEN
    RAISE EXCEPTION 'Job work arrangement is invalid';
  END IF;

  IF p_status <> 'draft' THEN
    IF COALESCE(TRIM(p_title), '') = ''
       OR COALESCE(TRIM(p_description), '') = '' THEN
      RAISE EXCEPTION 'Job title and description are required';
    END IF;

    IF p_pay_amount IS NULL
       OR p_pay_amount < 0
       OR p_workers_needed IS NULL
       OR p_workers_needed < 1 THEN
      RAISE EXCEPTION 'Job pay and worker capacity must be valid';
    END IF;

    IF p_pay_type NOT IN ('hourly', 'daily', 'fixed') THEN
      RAISE EXCEPTION 'Job pay type is invalid';
    END IF;
  END IF;

  -- Lock the job being edited and retain its original publication state.
  IF p_job_id IS NOT NULL THEN
    SELECT status, COALESCE(limit_exempt, false), published_at
    INTO v_existing_status, v_existing_limit_exempt, v_existing_published_at
    FROM jobs
    WHERE id = p_job_id
      AND employer_id = p_employer_id
      AND deleted_at IS NULL
    FOR UPDATE;
  END IF;

  v_is_publish_transition :=
    p_status = 'open'
    AND COALESCE(v_existing_status, '') <> 'open';

  -- Preserve the one-time exemption for grandfathered existing drafts.
  v_grandfathered_draft :=
    p_job_id IS NOT NULL
    AND v_existing_status = 'draft'
    AND COALESCE(v_existing_limit_exempt, false)
    AND v_existing_published_at IS NULL;

  v_consumes_post :=
    v_is_publish_transition
    AND NOT v_grandfathered_draft;

  v_billing_period_start :=
    date_trunc('month', timezone('UTC', now()))::date;

  -- Serialize publishing by employer to prevent concurrent quota bypass.
  IF v_is_publish_transition THEN
    PERFORM pg_advisory_xact_lock(
      ('x' || substr(md5('homlo-job-post:' || p_employer_id::text), 1, 15))::bit(60)::bigint
    );
  END IF;

  PERFORM public.homlo_update_subscription_limits(p_employer_id);

  SELECT plan, COALESCE(active_jobs_limit, 2), COALESCE(monthly_posts, 5)
  INTO v_plan, v_plan_limit, v_post_limit
  FROM subscriptions
  WHERE user_id = p_employer_id;

  IF v_is_publish_transition
     AND v_plan IS DISTINCT FROM 'enterprise' THEN

    -- Preserve the existing active-job limit behavior.
    SELECT COUNT(*) INTO v_active_count
    FROM jobs
    WHERE employer_id = p_employer_id
      AND status IN ('open', 'filled')
      AND deleted_at IS NULL
      AND id IS DISTINCT FROM p_job_id;

    IF v_active_count >= v_plan_limit THEN
      RAISE EXCEPTION USING
        errcode = 'P0001',
        message = format(
          'Your %s plan allows %s active jobs. Open additional listings by upgrading your plan.',
          v_plan, v_plan_limit
        );
    END IF;

    IF v_consumes_post THEN
      SELECT COUNT(*) INTO v_monthly_posts
      FROM job_post_events
      WHERE employer_id = p_employer_id
        AND billing_period_start = v_billing_period_start;

      IF v_monthly_posts >= v_post_limit THEN
        RAISE EXCEPTION USING
          errcode = 'P0001',
          message = format(
            'Your %s plan allows %s published posts per month. Upgrade to publish more.',
            v_plan, v_post_limit
          );
      END IF;
    END IF;
  END IF;

  v_title := COALESCE(TRIM(p_title), '');
  v_description := COALESCE(TRIM(p_description), '');
  v_pay_amount := COALESCE(p_pay_amount, 0);
  v_workers_needed := GREATEST(COALESCE(p_workers_needed, 1), 1);
  v_pay_type := COALESCE(p_pay_type, 'fixed');

  IF p_job_id IS NULL THEN
    INSERT INTO jobs (
      employer_id, category_id, title, description,
      pay_amount, pay_currency, pay_type, location_text,
      latitude, longitude, workers_needed, status,
      address_line, city, district, province, country,
      postal_code, banner_image, requirements,
      auto_close_enabled, work_arrangement, published_at, limit_exempt
    )
    VALUES (
      p_employer_id,
      p_category_id,
      v_title,
      v_description,
      v_pay_amount,
      COALESCE(NULLIF(TRIM(p_pay_currency), ''), 'USD'),
      v_pay_type,
      NULLIF(TRIM(COALESCE(p_location_text, '')), ''),
      CASE WHEN v_work_arrangement = 'Remote' THEN NULL ELSE p_latitude END,
      CASE WHEN v_work_arrangement = 'Remote' THEN NULL ELSE p_longitude END,
      v_workers_needed,
      p_status,
      NULLIF(TRIM(COALESCE(p_address_line, '')), ''),
      NULLIF(TRIM(COALESCE(p_city, '')), ''),
      NULLIF(TRIM(COALESCE(p_district, '')), ''),
      NULLIF(TRIM(COALESCE(p_province, '')), ''),
      NULLIF(TRIM(COALESCE(p_country, '')), ''),
      NULLIF(TRIM(COALESCE(p_postal_code, '')), ''),
      NULLIF(TRIM(COALESCE(p_banner_image, '')), ''),
      NULLIF(TRIM(COALESCE(p_requirements, '')), ''),
      COALESCE(p_auto_close_enabled, true),
      v_work_arrangement,
      CASE WHEN p_status = 'open' THEN now() ELSE NULL END,
      false
    )
    RETURNING * INTO v_job;
  ELSE
    UPDATE jobs SET
      category_id = p_category_id,
      title = v_title,
      description = v_description,
      pay_amount = v_pay_amount,
      pay_currency = COALESCE(NULLIF(TRIM(p_pay_currency), ''), 'USD'),
      pay_type = v_pay_type,
      location_text = NULLIF(TRIM(COALESCE(p_location_text, '')), ''),
      work_arrangement = COALESCE(v_work_arrangement, work_arrangement),
      latitude = CASE
        WHEN COALESCE(v_work_arrangement, work_arrangement) = 'Remote' THEN NULL
        ELSE p_latitude
      END,
      longitude = CASE
        WHEN COALESCE(v_work_arrangement, work_arrangement) = 'Remote' THEN NULL
        ELSE p_longitude
      END,
      address_line = NULLIF(TRIM(COALESCE(p_address_line, '')), ''),
      city = NULLIF(TRIM(COALESCE(p_city, '')), ''),
      district = NULLIF(TRIM(COALESCE(p_district, '')), ''),
      province = NULLIF(TRIM(COALESCE(p_province, '')), ''),
      country = NULLIF(TRIM(COALESCE(p_country, '')), ''),
      postal_code = NULLIF(TRIM(COALESCE(p_postal_code, '')), ''),
      banner_image = NULLIF(TRIM(COALESCE(p_banner_image, '')), ''),
      requirements = NULLIF(TRIM(COALESCE(p_requirements, '')), ''),
      auto_close_enabled = CASE
        WHEN p_auto_close_enabled IS NULL THEN auto_close_enabled
        ELSE p_auto_close_enabled
      END,
      workers_needed = GREATEST(v_workers_needed, workers_hired),
      status = CASE
        WHEN COALESCE(auto_close_enabled, true)
             AND workers_hired >= GREATEST(v_workers_needed, workers_hired)
          THEN 'filled'
        ELSE p_status
      END,
      published_at = CASE
        WHEN p_status = 'open' THEN COALESCE(published_at, now())
        ELSE published_at
      END,
      limit_exempt = CASE
        WHEN v_is_publish_transition THEN false
        ELSE limit_exempt
      END
    WHERE id = p_job_id
      AND employer_id = p_employer_id
      AND deleted_at IS NULL
    RETURNING * INTO v_job;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Only the listing employer can update this job';
    END IF;
  END IF;

  -- Record quota-consuming publications for all plans. Enterprise
  -- enforcement remains in the existing usage-based billing system.
  IF v_consumes_post THEN
    INSERT INTO job_post_events (
      employer_id, job_id, event_type, billing_period_start
    )
    VALUES (
      p_employer_id,
      v_job.id,
      CASE
        WHEN v_existing_published_at IS NOT NULL
          OR (p_job_id IS NOT NULL AND v_existing_status <> 'draft')
          THEN 'republished'
        ELSE 'published'
      END,
      v_billing_period_start
    );
  END IF;

  RETURN v_job;
END;
$function$;

-- Preserve service-role-only access to job saving.
REVOKE ALL ON FUNCTION public.homlo_save_job(
  uuid, uuid, uuid, text, text, numeric, text, text, text,
  double precision, double precision, integer, text, text,
  text, text, text, text, text, text, text, boolean, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.homlo_save_job(
  uuid, uuid, uuid, text, text, numeric, text, text, text,
  double precision, double precision, integer, text, text,
  text, text, text, text, text, text, text, boolean, text
) TO service_role;

-- Trigger functions are invoked by PostgreSQL triggers, not API callers.
REVOKE EXECUTE ON FUNCTION public.enforce_job_capacity_status()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_application_status_change()
  FROM PUBLIC, anon, authenticated;

COMMIT;
