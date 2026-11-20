# Trust & Safety and Legal Protection

What was added, where it lives, and what still needs a decision from the owner.
None of this is legal advice. Have a local lawyer review the legal pages and every item in "Decisions you need to make" before launch.

## Stack (as found in this repo)

| Part | What it is |
|---|---|
| App | Expo Router / React Native (iOS, Android and a web build from the same `app/` routes) |
| API | Express + tRPC server in `server/` (`pnpm dev:server`) |
| Database / auth | Supabase Postgres and Supabase Auth (bcrypt password hashing is done by Supabase Auth) |
| Edge function | `supabase/functions/homlo-service-gateway`, which saves jobs and payments through SQL functions |
| Payments | RevenueCat (App Store / Google Play own the checkout) for boosts, plus the older simulated ABA PayWay path for plans |
| Email / SMS | **None existed.** A pluggable sender was added (see below). Picking a provider is your decision. |

**Why the rules live in the database:** a client can call the edge gateway directly with its own token and skip the Express server. So every rule that must be enforced server-side is a Postgres trigger, which holds for every write path. The Express server adds the request details (IP, user agent, device) and readable error messages.

## Setup

1. Back up the database, then apply `backend/database/migrations/057_trust_safety.sql`. The same file is at `supabase/migrations/20261120120000_trust_safety.sql`.
2. Set `FIELD_ENCRYPTION_KEY` and `HOMLO_IDENTIFIER_HASH_SECRET` (32+ random characters each). In production the server refuses to start without them.
3. Choose providers: `EMAIL_PROVIDER=resend` and `SMS_PROVIDER=twilio`, with keys. Until then emails and SMS codes are printed to the server log in development, and refused in production. Phone verification therefore cannot complete in production until SMS is set up.
4. Make yourself a moderator: `insert into admin_users (user_id) values ('<your users.id>');`
5. After editing `legal/terms.md` or `legal/privacy.md`, run `node scripts/build-legal-content.mjs`. If the change is material, also bump the version in the file and in the database: `update trust_settings set value = '1.1' where key = 'terms_version';`. Everyone then re-accepts before their next post.

All limits are rows in `trust_settings` and can be changed without a deploy.

## Features and where they live

### Legal pages
- `legal/terms.md` (Part 1) and `legal/privacy.md` (Part 2), copied verbatim. The template's opening note ("Replace every [BRACKETED] item…") was left out because it is an instruction to you, not page text.
- They are built into `lib/legal/legal-docs.generated.ts` by `scripts/build-legal-content.mjs`.
- `/terms` and `/privacy`: `app/terms.tsx` and `app/privacy.tsx`. The version and effective date are shown at the top.
- Footer links:
  - Web: on every page, via `components/legal/WebLegalChrome.tsx`, mounted in `app/_layout.tsx`.
  - Native: shown on sign-up, the legal, account and appeal screens, and in Profile. A footer on every native screen is not a normal mobile pattern.
- The old placeholder pages under Profile now redirect to the real ones. `lib/legal-content.ts` is unused and can be deleted.

### Consent checkboxes (required, never pre-ticked, enforced server-side)
- Exact Part 3 wording: `lib/legal/consent-wording.ts`. Checkbox component: `components/legal/LegalUI.tsx` (`ConsentCheckbox`).
- **Sign-up:** `app/login.tsx`.
  - The server refuses sign-up without `acceptTerms: true` (`server/_core/supabase-auth.ts`).
  - Existing users, and everyone after a version bump, re-accept on `/account/verify`.
- **Every job post:** `components/legal/PublishDeclarationSheet.tsx`, shown from `app/employer/post-job.tsx`.
  - The server writes one `job_posting` row tied to the listing (`server/routers.ts`, `saveJobWithPlanEnforcement`).
  - The database refuses to publish without a row from the last 30 minutes.
- **Checkout:** `app/boost/payment.tsx` and `app/checkout.tsx`.
  - The app calls `trust.acceptPaymentTerms` first.
  - The database refuses to create a new payment or RevenueCat intent without that row (`homlo_assert_payment_allowed`).
- **Marketing:** a separate, optional, unticked checkbox on sign-up and in `/account/settings`. Opting in and out are both logged.

### Consent log
- Table `consent_log` (migration section 3) has: id, user_id, consent_type, terms_version, privacy_version, created_at (UTC), ip_address, user_agent, listing_id, and metadata (product, amount and listing title for purchases).
- Append-only:
  - A trigger refuses every UPDATE, and every DELETE except the retention purge of rows past the retention period.
  - UPDATE, DELETE and TRUNCATE are revoked from the API roles.
- IP address and user agent are encrypted with AES-256-GCM by the server (`server/trust/crypto.ts`).
- Writes go through `server/trust/consent.ts`.

### Account verification
- `/account/verify` (`app/account/verify.tsx`) and `server/trust/accounts.ts`:
  - The email confirmation link is our own: a hashed token, valid 48h, opened at `GET /api/trust/verify-email` (`server/trust/routes.ts`). Supabase's own confirmation was not used, because accounts are created already confirmed for instant login.
  - SMS codes: 6 digits, hashed, 10 minutes, 5 attempts, 5 sends per hour. One verified phone number per account.
- The database will not let a listing go live until the email is confirmed, the phone is verified and the current Terms are accepted.
- New accounts can submit at most `new_account_max_listings` (3) listings in their first `new_account_days` (7). Deleted listings still count.
- Ban evasion:
  - When a user is banned, keyed hashes of their email, phone and device id are stored in `banned_identifiers`.
  - Sign-up is refused when the email or device matches. A phone number that matches is refused at verification.
  - IP matches are only logged (`audit_logs`) and never block sign-up, because shared Wi-Fi and mobile networks make IP blocking unreliable.
  - The device id is a random per-install id (`lib/device-id.ts`), sent as `X-Homlo-Device-Id`. It is not an advertising id.

### Listing safety
- Trigger `jobs_trust_safety_gate` in the migration runs when a listing is submitted and when a live listing's text changes.
- **Required fields:** employer name (falls back to the profile name), location, pay type, and contact method (`in_app`, `email` or `phone`, plus the value). New columns: `jobs.employer_name`, `contact_method`, `contact_value`.
- **Scam filter:**
  - Patterns are in the `listing_safety_rules` table and admins can add more: registration fee, fees or deposits, send money, wire transfer, Western Union, guaranteed income, gift cards, crypto, bank details, passwords, pay to start.
  - A match sends the listing to `status = 'pending_review'`.
- **Every account's first listing** goes to review.
- **Discrimination by age, gender, race or religion** is refused with a message telling the poster to edit.
- **Minors in hazardous or adult work** is refused when wording that targets under-18s appears next to hazardous or adult work.
- The app shows the same checks live before publishing (`trust.checkListing` calls the same SQL function).
- **Expiry:** `expires_at` is set to `listing_expiry_days` (30) days after going live. The sweeper sets expired listings to `expired` every 5 minutes.
- Public feeds already only show `status = 'open'`, so listings in review or removed never appear.

### Reporting and moderation
- A Report button on:
  - every listing (`app/job/[id].tsx`)
  - employer profiles (`NewEmployerProfile.tsx`)
  - applicant profiles (`app/employer/application/[id].tsx`)
- All of them use `components/legal/ReportSheet.tsx`, which also works on web. Categories: scam, underage user, discrimination, illegal, other. Reports are stored in `reports.category`.
- The owner is emailed when a report comes in (trigger `reports_notify_owner`), without naming the reporter.
- Admin dashboard `/admin` (`app/admin/index.tsx`, server `server/trust/moderation.ts`):
  - Tabs: review queue, reports, appeals, chargeback evidence.
  - Actions: approve, remove, warn, suspend, ban, reinstate, dismiss.
  - Every action needs a written reason and is stored in append-only `moderation_actions` with who, what, when and why.
  - Removing a listing (or suspending or banning its owner) stores the full listing in `snapshot`.
- Appeal form `/appeal` (`app/appeal.tsx`). It works without signing in, because banned users cannot sign in. Appeals are decided in the dashboard and the user is emailed the result.

### Applicant protection
- The Part 3 warning is shown on every apply screen (`src/new/screens/ApplyScreenNew.tsx`).

### Payments
- The store or provider checkout is used. **The in-app card number, expiry and CVC fields on the boost checkout were removed.** They were not sent anywhere, but the app should never collect them.
- Only status, amount and provider transaction id are stored, as before.
- **Receipt email** after every completed payment, from any path (triggers `payments_send_receipt` and `rc_purchases_send_receipt`).
- **Subscriptions** (`/account/settings`):
  - Shows the renewal date. Cancel is one click and takes effect at the end of the period; you can undo it.
  - A reminder email is sent `renewal_reminder_days` (3) before renewal.
  - App Store / Google Play subscriptions can only be cancelled in the store, so the button links there.
- **New-account spend cap:** `new_account_spend_cap_cents`. It is **NULL (off)** until you choose `[$X]`.
- **Chargeback evidence:** `homlo_chargeback_evidence(payment_ref)`, shown in the dashboard. It returns the payment, every consent with time, IP and device, the listing, the boost delivered with its dates, and the account's verification timestamps.

### Privacy
- `/account/settings` (`app/account/settings.tsx`): edit profile, delete account, download my data (JSON, `server/trust/privacy.ts` `exportUserData`), marketing preference.
- Retention job (`runRetention`, every 6 hours):
  - Closed accounts are anonymized after `closed_account_purge_days` (90). The existing delete already wipes the profile immediately.
  - Inactive accounts get a warning email at 24 months minus 30 days, and are deleted after `inactive_account_months` (24) if the person did not come back.
  - Consent and moderation records are purged after `consent_retention_years` / `moderation_retention_years` (5).
- **Cookie banner** (web): `components/legal/WebLegalChrome.tsx` and `lib/cookie-consent.ts`.
  - The app has **no** analytics or marketing cookies today. Any you add later must be loaded through `whenConsented("analytics", …)`.
  - The choice is stored on the device only.
- **Security:**
  - Passwords are hashed with bcrypt by Supabase Auth.
  - HTTPS: Supabase is HTTPS only, and `npm run check:release` requires an https API URL.
  - IP and user agent in the consent log are encrypted. Identifiers are stored as keyed hashes. Verification codes are stored as hashes.

### Tests
- `tests/trust-safety.test.ts`:
  - wording is verbatim
  - the generated pages match the Markdown
  - checkboxes start unticked
  - no card fields remain
  - the append-only and gate triggers exist
  - cookie gating works
  - encryption round-trips
- `tests/auth-routes.test.ts`: sign-up without consent is refused before any account is created.

## Assumptions

- "Server-side" means Postgres triggers plus the Express server. No new backend was added.
- 18+ is self-declared through the sign-up checkbox (and the posting declaration). No ID checks, as requested.
- "Contact method" is a new required field. "Messages in Homlo" is one of the choices, but nothing is preselected.
- Consent for posting must be given within 30 minutes of submitting, and for paying within 30 minutes of checkout (configurable). Editing a live listing is not a new post, so it needs no new declaration, but its text is checked again.
- Existing accounts must confirm email and phone and accept the Terms before their next post. Existing live listings are not affected.
- Emails go through an outbox table (`email_outbox`) and are retried up to 5 times.

## Decisions you need to make (legal / business)

1. **Placeholders still in the legal text.**
   - Terms: [DATE], [COMPANY NAME], [a company registered in COUNTRY], [WEBSITE/APP NAME], [LEGAL EMAIL], [SUPPORT EMAIL], [14] (appeal window), [CURRENCY], [including/excluding], [14] (boost fault claims), [Adjust to local consumer law.], [USD 100], [Lawyer to confirm.] (twice), [Lawyer to confirm enforceability locally.], [COUNTRY/STATE], [the courts of CITY/COUNTRY], [or by binding arbitration under RULES in CITY], [30], [ADDRESS].
   - Privacy: [DATE], [COMPANY NAME], [WEBSITE/APP NAME], [PRIVACY EMAIL], [PROVIDER NAME], [VERIFICATION PROVIDER], [90], [the period required by law, for example 7 years], [2 to 5], [24], [30], [ADDRESS], [NAME/CONTACT].
   - Apply-screen warning: [Company name].
2. **Governing law and dispute forum** (Terms section 17), and whether arbitration is allowed where your users live.
3. **Retention periods.** Consent and moderation logs are set to 5 years (the policy says [2 to 5]). Payment and tax records follow your local law; nothing here deletes them. Closed accounts 90 days, inactive accounts 24 months. These must match what the Privacy Policy finally says.
4. **Refunds and consumer law.** "Non-refundable once started" may not be allowed everywhere (for example EU/UK withdrawal rights for digital services, or app-store refund rules). App Store and Google Play refunds are decided by Apple and Google.
5. **Spend cap [$X]** for new accounts: `update trust_settings set value = '<cents>' where key = 'new_account_spend_cap_cents';`.
6. **Device and IP matching.** Under GDPR-style laws, storing device and network identifiers to stop ban evasion needs a lawful basis (likely legitimate interest) and disclosure. The Privacy Policy mentions device identifiers and fraud prevention, but confirm it is enough where you operate. IP is never used to block, only logged.
7. **Email and SMS providers.** Both cost money and need accounts. They are not set up yet.
8. **Word lists.** The discrimination and minors lists are a starting point and can be wrong both ways. "Genuine occupational requirement" exceptions (Terms 5.5) need a moderator. Edit `listing_safety_rules` to fit your market and languages (Khmer wording is not covered).
9. **Renewal reminders** are sent "where the law requires" per the Terms. They are sent to everyone here, which is the safer choice.

## Known gaps / follow-ups

- The web build currently crashes on launch with `setRNConfiguration is not supported by the browser` (RevenueCat's native SDK on web). This was there before this work, and it blocked a visual check of the new screens in a browser.
- The edit-listing screen treats a listing in review as "open". The database keeps it in review whatever the screen sends, but the label is misleading.
- `components/boost/RevenueCatPaywall.tsx` (not used by any route) does not ask for payment consent, so the database will refuse its purchases until it does.
- The migration was tested on 2026-11-20 in an in-memory Postgres 16 (PGlite) built from this repo's migrations, with stand-ins for Supabase's `auth` schema and roles:
  - It applies cleanly, and running it twice also works.
  - 54 scenarios against the triggers passed: append-only logs, every posting rule, the review queue, the wording rules, the new-account cap, removal, expiry, payment consent, the spend cap, webhook rows never being refused, receipts, report emails and chargeback evidence.
  - 42 checks of the SQL in `server/trust/*` passed: verification link and SMS code, moderation actions with snapshots, banning and blocked re-registration, appeals, data export, renewal reminders and retention.
  - Not covered: PostGIS and Supabase storage, and real Supabase permissions. Still apply it to a staging copy first.
- `backend/database/migrations/044_drop_stale_save_job_overloads.sql` contains a shell command (`pbpaste > …`) instead of SQL. This was there before this work, and the file would fail if applied.
