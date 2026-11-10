# Security TODO

If a web build is ever deployed, do CSRF protection (Origin checks, JSON-only content type, SameSite review) and browser security headers (HSTS, X-Frame-Options, CSP) first.

## Open items

- Sign-up enumeration: 201 vs 400 still distinguishes registered emails. Fix after email confirmation is enabled in the Supabase dashboard; sign-up should then return one uniform "check your email" response.
- Sign-up rate limit handling: Supabase 429 ("email rate limit exceeded") currently becomes a vague 400 "Unable to create account". SupabaseAdapter.ts wraps the error in `new Error(message)`, which drops the status before the route sees it. Map it to 429 "Please try again later".
- Dead code to review: server/storage.ts (storagePut/storageGet return /manus-storage/ URLs that no longer resolve), server/_core/imageGeneration.ts (no importers found), and app.config.ts logoUrl (unused template field pointing at /manus-storage/). Only server/, lib/, app/, components/, hooks/, tests/ and shared/ were searched; backend/, supabase/ and scripts were not.
- Flaky test: tests/recommendation-feed.test.ts timed out at 5000ms in one full vitest run but passed alone in about 1.1s. Cause not proven; possibly load from the slow Postgres connection test.
- Untracked or uncommitted work not part of the security fixes, left alone on purpose: server/_core/errors.ts and tests/api-error-handler.test.ts (not wired into the server, author unknown) and the type-only change to server/_core/context.ts.
- homlo.employerProfile exists only as uncommitted work in server/routers.ts and server/homlo-direct-service.ts. The working tree already omits userId and coarsens coordinates to 2 decimals. When that feature is committed, keep both, and commit tests/employer-profile-privacy.test.ts with it.
- employerProfile prefix name probing can still enumerate profile names, and locationText is free text that may contain a full address. Audit the public_profiles view for user_id and exact coordinates. Backend/, constants/ and scripts were not searched for other callers.
- Gateway error passthrough (1860162) only returns database messages with SQLSTATE P0001. After deploying, confirm in the function logs that real errors carry code P0001. The live-DB check of raise exception messages was incomplete: one row returned null (statements my pattern missed, possibly format() messages or uppercase RAISE EXCEPTION) and was not reviewed.
- The SQL function refresh_job_stats raises a message naming an internal function and file (marmot_tuning_knobs.ts). No gateway action calls it, so it does not reach clients today. Reword it if it is ever exposed.
- Gateway still returns status 400 for all non-payment failures. Mapping unexpected errors to 500 is a separate decision.
