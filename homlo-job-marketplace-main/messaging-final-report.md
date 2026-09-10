# Messaging + Homlo-Only Application Channel — Final Report

## 1. Summary

Production in-app messaging between workers and employers, plus the removal of
all external contact methods so every application is handled through Homlo.
Messaging is implemented as a provider-agnostic client domain driven by a tRPC
router (`homlo.messaging`), a Supabase edge-function gateway, and
service-role-only SQL functions. Two DB migrations were delivered: `028`
(messaging core) and `029` (hardened unblock authorization). Gateway deployed
twice; live-database probes and an end-to-end RPC smoke test confirm the wiring.

## 2. Files changed

### Database
- `backend/database/migrations/028_messaging_direct.sql` — new. conversations
  `application_id`, conversation_members `last_read_at`/`blocked_at`, messages
  `message_type`/`status`/`reactions`, `message_hidden_for`, aliases for
  #004's legacy `conversations`/`messages`/`conversation_members`, 12
  service-role-only RPCs, RLS policies, `homlo_messaging` publication.
- `backend/database/migrations/029_messaging_unblock_authz.sql` — new. Drops the
  insecure 2-arg `homlo_unblock_user` and installs a 3-arg version that requires
  the caller to be a non-blocked conversation member and the target to actually
  be blocked. Applied to the live project.

### App / server
- `server/routers.ts` — `homlo.messaging` router: conversations, conversation,
  messages, unreadCount, send, markRead, block, unblock, report, hide; actor id
  always derived server-side.
- `supabase/functions/homlo-service-gateway/index.ts` — 10 `messaging.*` actions
  (lines 253–345); `unblock` now passes `p_user_id=account.id`. Redeployed.
- `lib/trpc.ts` — extracted `buildTRPCLink()` (httpBatchLink + superjson, Bearer
  header, `credentials: 'include'`, one-shot refresh on 401); added
  `trpcDirect` plain proxy client for non-React callers.
- `lib/messaging/` (`types.ts`, `provider.ts`, `service.ts`, `index.ts`,
  `supabase-provider.ts`) — client domain (`MessagingService`,
  `MessagingProvider`, messages grouped by day, unread aggregation) and the
  Supabase provider that now calls `trpcDirect.homlo.messaging.*`.
- `app/(tabs)/inbox.tsx` — inbox list + realtime updates + error/empty/loading
  states.
- `app/conversations/[id].tsx` — chat screen: grouped bubbles, send, backfill,
  realtime subscription, mark-read, block/unblock, report, hide.
- `hooks/use-messaging-unread.ts`, `app/(tabs)/_layout.tsx` — unread badge.
- `app/applications/[id].tsx`, `app/employer/application/[id].tsx`,
  `app/job/[id]/apply.tsx` — "Message …" entry points (job message persists in
  the application form).

### External-contact removal (Homlo-only channel)
- `lib/job-posting.ts` — removed `ApplicationMethod` type,
  `applicationMethod`/`applicationUrl`/`contactEmail` fields + defaults and the
  step-5 URL/email validation (now intentionally empty).
- `app/post-job.tsx` — removed `ApplicationMethod` import; step 5 is a
  Homlo-only panel ("Applicants apply and chat in Homlo"); publish summary shows
  "Applications: Through Homlo"; removed the now-unused `ChoiceChip`.

### Tests
- `tests/messaging.test.ts` — 15 tests: provider contract via `FakeProvider`,
  input guards (empty/whitespace rejected "Message cannot be empty", 4000-char
  limit, trimming), realtime unsub cleanup, and `appRouter.homlo.messaging`
  wiring (procedures exposed, unauthenticated → `UNAUTHORIZED`, zod bounds →
  `BAD_REQUEST`, authenticated reaches service layer).
- `tests/homlo-application-channel.test.ts` — 4 tests: external fields absent
  from `defaultJobPosting`/`buildUserJobInput*`/`draftFromRemoteJob`,
  `validatePostingStep(5)` empty.

### Tooling
- `scripts/verify-028.mjs` — retained structural verification (all checks true
  on the live DB, including RLS + publication). Temp apply/probe/smoke scripts
  removed after use.

## 3. Architecture

```
Inbox / Chat screens
   -> MessagingService (lib/messaging/service.ts)
   -> MessagingProvider (lib/messaging/provider.ts)
   -> SupabaseMessagingProvider (lib/messaging/supabase-provider.ts)
   -> tRPC router  homlo.messaging  (server/routers.ts)
   -> /api/trpc + direct HTTP client (lib/trpc.ts: trpcDirect)
   -> Supabase edge function homlo-service-gateway (messaging.* actions)
   -> service-role-only RPCs, e.g. homlo_send_message (security definer)
   -> realtime push on homlo_messaging publication (RLS-protected)
```

Supported on native and web. Realtime subscriptions live on the client and are
authorized by RLS.

## 4. Database changes (migration 028)

- `conversations.application_id` via unique-on-application helper — one canonical
  conversation per application (idempotent `homlo_get_or_create_conversation`).
- `conversation_members.last_read_at` (per-user read state) and `blocked_at`
  (block-to-stop-receiving).
- `messages.message_type` (`text|job_offer|attachment`), `status` (soft delete),
  `reactions`; `message_hidden_for` for per-user "delete for me".
- 12 functions, all service-role-execute, public revoke, security definer,
  search_path-locked; RLS enabled on conversations/messages.
- `homlo_messaging` publication for live presence.

## 5. Security

- User identity is always derived server-side (gateway account / tRPC session);
  never accepted from the client.
- All messaging RPCs are `revoke public/anon/authenticated`, `grant
  service_role` only. Client reaches them exclusively through the gateway.
- The canonical user id is `profiles.user_id` (Homlo `users.id`), not
  `auth.uid()`; `homlo_current_user_id()` resolves the Supabase identity via
  `user_identities`.
- Realtime is RLS-protected: a client only sees rows its policies grant.
- `029` closed an authorization gap: unblock now requires the caller to be a
  non-blocked member and the target to be actively blocked.
- Hardened helpers: `set search_path = public, pg_temp`, parameterized,
  `security definer` minimization.

## 6. Realtime & notifications

- Inbox and chat subscribe to realtime (author, message, application posts).
- `homlo_send_message` fires a Realtime message that all participants can
  receive; unread counts drive the tab badge.
- Notifications wiring stays intact: `homlo_submit_application` push-notifies
  the employer (`new_application`) and application status changes go to the
  worker.

## 7. Verification

- `npm run check` — clean.
- `npm run lint` — 0 errors; 3 pre-existing warnings in untouched files
  (`app/discover/[kind].tsx`, `app/onboarding/index.tsx`).
- `npm run test` — 374 passed across 27 files, including the new messaging
  (15) and Homlo-only channel (4) suites.
- Gateway redeployed (`supabase functions deploy homlo-service-gateway` on
  `gwzknvycbzloomxhvslo`).
- Live probes: all 12 RPCs present with service-role-only execute; migration
  `verify-028.mjs` all checks true; end-to-end smoke test via the live DB
  (get-or-create → send → list → mark-read/unread → block → unblock → hide)
  passed against a real application row.

## 8. Honest limitations

- Web realtime uses an httpOnly-cookie fallback for auth; native uses the
  anon-key Supabase client. Confirmed acceptable for this phase.
- `homlo_report_conversation` writes `target_type='message'` with
  `target_id = conversationId` (gateway passes the conversation id), inherited
  from the #008 reports schema; `homlo_report_message` targets the actual
  message id. Two calls exist — the app should eventually route message-level
  reports to `homlo_report_message`.
- `homlo_unblock_user` now requires an active block to clear (you cannot
  "unblock" someone who was never blocked).
- `.env`/`.env.example` carry `EXPO_PUBLIC_SUPABASE_URL` +
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`; server secrets remain server-only.