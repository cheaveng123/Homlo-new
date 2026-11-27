# RevenueCat boost purchases — Part A

One-time RevenueCat consumables for Homlo job boosts. Part B (de-Expo migration)
has not been started.

## Files changed

- `lib/boost-products.ts` (new) — single source of truth for the six boost plan
  ids and their RevenueCat/App Store product ids; used by the app and webhook.
- `lib/purchases.ts` (new) — RevenueCat configure/getOfferings/purchase helpers,
  cancellation handling, entitlement lookup, and `logIn`/`logOut` identity
  helpers.
- `app/_layout.tsx` — configures RevenueCat once at app startup.
- `hooks/use-auth.ts` — links RevenueCat identity to the existing Homlo session
  lifecycle (`logIn` after sign-in/session restore, `logOut` on sign-out).
- `components/boost/RevenueCatPaywall.tsx` (new) — package list, localized price
  strings, buy buttons, loading/empty/error states, intent creation, polling
  until the webhook activates the boost.
- `app/boost/payment.tsx` — added the RevenueCat paywall above the existing
  wallet/card flow. Existing payment behavior is unchanged.
- `server/revenuecatWebhook.ts` (new) — authenticated boost-intent creation,
  purchase-status polling, and the idempotent RevenueCat webhook.
- `server/_core/index.ts` — registers the RevenueCat routes.
- `supabase/migrations/20261116120000_revenuecat_boost_purchases.sql` (new) —
  `public.revenuecat_boost_purchases` intent/event ledger with unique event and
  transaction ids, RLS enabled, service-role-only grants.
- `tests/revenuecat-webhook.test.ts` (new) — webhook activation dedupe,
  unmatched-event retention, and refund cancellation.
- `tests/auth-cache-isolation.test.ts` — mocks the new purchases identity helpers.
- `.env.example` — documents the client key and webhook auth variable.
- `.env` (local only, gitignored) — added empty RevenueCat placeholders.

## How activation works

1. Signed-in client validates the job and creates a pending intent via
   `POST /api/revenuecat/boost-intents`.
2. Client sets `homlo_boost_token` (plus job/plan ids) as RevenueCat subscriber
   attributes, then calls `Purchases.purchasePackage`.
3. RevenueCat calls `POST /api/webhooks/revenuecat` with the configured
   `Authorization` value.
4. The webhook matches the intent by token (fallback: newest recent pending
   intent for that user/product), then calls `activateBoostInTransaction` so the
   paid boost is written to the existing `public.boosts` lifecycle table.
5. Duplicate event/transaction ids are no-ops. Unmatched events are retained as
   `unmatched` for reconciliation. Refunds cancel the linked boost.

## Verification

- `pnpm check` — passes.
- `pnpm vitest run tests/revenuecat-webhook.test.ts` — 3/3 pass.
- `pnpm test` — 680 tests pass, 12 skipped.
- `pnpm lint` — still fails on existing repo-wide React Compiler/ESLint errors;
  ESLint on the changed files reports no new errors.
- Smoke checks: `GET /api/health` 200; webhook without secret 503; boost intent
  without auth 401; the iOS Metro bundle builds and contains the new modules.

## Required manual setup

- Apply the new Supabase migration.
- Create the six products above in RevenueCat, attach them to packages in the
  **current** offering, and set `EXPO_PUBLIC_RC_TEST_KEY`.
- Set `REVENUECAT_WEBHOOK_AUTH` on the server and use the same value as the
  RevenueCat webhook Authorization header.
- Rebuild the native app after installing/enabling the RevenueCat SDK; Expo Go
  cannot load this native module.
