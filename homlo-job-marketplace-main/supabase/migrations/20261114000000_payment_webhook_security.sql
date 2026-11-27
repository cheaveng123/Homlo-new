-- Payment webhook security hardening
-- Revokes direct access to homlo_record_payment_webhook from non-service roles,
-- ensuring webhook processing can only be triggered through the authenticated
-- Edge Function gateway (homlo-service-gateway) which performs its own
-- authentication and authorization checks.
--
-- Do not apply to production until the Edge Function webhook endpoint is
-- deployed and tested against staging.

-- Revoke direct EXECUTE on homlo_record_payment_webhook from non-service roles.
-- The function remains executable by service_role (used by the Edge Function).
REVOKE ALL ON FUNCTION public.homlo_record_payment_webhook(
    p_provider text,
    p_provider_event_id text,
    p_provider_transaction_id text,
    p_payment_id uuid,
    p_result text
) FROM PUBLIC, anon, authenticated;

-- Grant EXECUTE only to service_role so the Edge Function can call it.
GRANT EXECUTE ON FUNCTION public.homlo_record_payment_webhook(
    p_provider text,
    p_provider_event_id text,
    p_provider_transaction_id text,
    p_payment_id uuid,
    p_result text
) TO service_role;

-- Also revoke direct access to homlo_create_boost to ensure all boost creation
-- goes through the Edge Function which performs ownership and pricing checks.
REVOKE ALL ON FUNCTION public.homlo_create_boost(
    p_employer_id uuid,
    p_job_id uuid,
    p_package text,
    p_amount numeric,
    p_currency text,
    p_provider text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.homlo_create_boost(
    p_employer_id uuid,
    p_job_id uuid,
    p_package text,
    p_amount numeric,
    p_currency text,
    p_provider text
) TO service_role;

-- Add comment documenting the security requirement
COMMENT ON FUNCTION public.homlo_record_payment_webhook(
    p_provider text,
    p_provider_event_id text,
    p_provider_transaction_id text,
    p_payment_id uuid,
    p_result text
) IS 'Direct execution revoked. Only service_role (Edge Function) may call. Webhook signature verification must be implemented at the Edge Function layer before this function is called directly from external sources.';

COMMENT ON FUNCTION public.homlo_create_boost(
    p_employer_id uuid,
    p_job_id uuid,
    p_package text,
    p_amount numeric,
    p_currency text,
    p_provider text
) IS 'Direct execution revoked. Only service_role (Edge Function) may call. Server-side price enforcement and ownership checks are performed in the Edge Function.';
