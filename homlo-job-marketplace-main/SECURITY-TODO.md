# Security TODO

If a web build is ever deployed, do CSRF protection (Origin checks, JSON-only content type, SameSite review) and browser security headers (HSTS, X-Frame-Options, CSP) first.

## Open items

- Sign-up enumeration: 201 vs 400 still distinguishes registered emails. Fix after email confirmation is enabled in the Supabase dashboard; sign-up should then return one uniform "check your email" response.
- Sign-up rate limit handling: Supabase 429 ("email rate limit exceeded") currently becomes a vague 400 "Unable to create account". SupabaseAdapter.ts wraps the error in `new Error(message)`, which drops the status before the route sees it. Map it to 429 "Please try again later".
- Dead code to review: server/storage.ts (storagePut/storageGet return /manus-storage/ URLs that no longer resolve), server/_core/imageGeneration.ts (no importers found), and app.config.ts logoUrl (unused template field pointing at /manus-storage/). Only server/, lib/, app/, components/, hooks/, tests/ and shared/ were searched; backend/, supabase/ and scripts were not.
- Flaky test: tests/recommendation-feed.test.ts timed out at 5000ms in one full vitest run but passed alone in about 1.1s. Cause not proven; possibly load from the slow Postgres connection test.
- Untracked or uncommitted work not part of the security fixes, left alone on purpose: server/_core/errors.ts and tests/api-error-handler.test.ts (not wired into the server, author unknown) and the type-only change to server/_core/context.ts.
