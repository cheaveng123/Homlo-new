-- =========================================================
-- 009_performance_security_hardening.sql
-- Follow-on operational hardening. Existing 001–008 migrations
-- remain immutable; this migration addresses production-readiness
-- findings discovered after the initial schema was applied.
-- =========================================================

-- Pin the trigger function's lookup path to eliminate role-dependent
-- name resolution without changing its application behavior.
alter function public.set_updated_at() set search_path = public;

-- Cover foreign keys used by operational reads and cascade checks.
create index idx_boosts_employer on boosts (employer_id);
create index idx_message_hidden_for_user on message_hidden_for (user_id);
create index idx_messages_sender on messages (sender_id);
create index idx_payments_boost on payments (boost_id);
create index idx_payments_job on payments (job_id);
create index idx_reports_reporter on reports (reporter_id);
create index idx_reviews_reviewer on reviews (reviewer_id) where deleted_at is null;
create index idx_saved_jobs_job on saved_jobs (job_id);

-- RLS is enabled on all public tables. No client-facing policies are
-- added here because the Expo app only reaches the server API; access
-- is authorized in the service layer and service-role adapter.
