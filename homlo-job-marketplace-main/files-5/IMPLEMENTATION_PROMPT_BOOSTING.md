# Homlo Jobs: boosting (backend + indicators + inbox updates)

Mobile only (React Native / Expo). No web. Do NOT touch anything not listed here.
Files 01-09 are finished and were tested against a real Postgres. Copy them in, rename to fit the repo
(server files in server/boost/, UI files in components/boost/), and only adapt names that differ from the real schema.
Server files (01-05) must stay plain TypeScript with NO Expo/React Native imports.

## Step 0: inspect first, then report in 10 lines max before changing code
Find and report the real: (a) `boosts`, `notifications`, `jobs`, `payments` tables + columns; (b) the inbox screen and its
"Update" tab and what table/column feeds it; (c) server/feed-routes.ts queries for Recommended, Popular, Jobs near you, Explore;
(d) employer Live-tab job card + the employer job management page; (e) the shared job card used in the feeds;
(f) the payment-succeeded handler (webhook / success route) for boosts.

## Step 1: database
Adapt 01_boost_migration.sql to the real tables ONLY by renaming columns (jobs.user_id, jobs.status = 'open', jobs.deleted_at,
notifications.user_id/category/type/title/body/data). Keep the logic. Put it in supabase/migrations/ and run it.
Existing boosts rows: leave as they are (grandfathered); map their status to scheduled/active/expired.

## Step 2: payment success -> boost
In the payment-succeeded handler, after the existing webhook-idempotency check, call
`activateBoostForPayment(pool, { paymentId, jobId, employerUserId, planKey, pricePaidCents })` (03_boostService.ts).
planKey is one of starter | local | standard | urgent | strong | maximum. Remove any older code that flips boost flags elsewhere.
Pro's free monthly Standard Boost calls it with paymentId null and pricePaidCents 0.
Behavior to keep: a boost bought while one is running is queued right after it; it starts immediately otherwise.

## Step 3: sweeper
At server boot call `startBoostSweeper(pool)`. It runs `boost_tick()` every 60s: expires boosts, starts queued ones, and writes the
inbox notifications exactly once. The feeds also check ends_at themselves, so a late sweep never leaves a stale badge.

## Step 4: the home feeds actually rank boosted jobs higher
In every feed query add `BOOST_JOIN_SQL` after the jobs table (alias `j`) and `BOOST_SELECT_SQL` to the select list (04_boostFeedSql.ts).
Where the final score is computed, use `applyBoost(score, row.boost_multiplier, existingQualityTerm01)` (02_boostConfig.ts).
Multipliers live ONLY in 02_boostConfig.ts (cap 1.15). Filters/eligibility are unchanged: a boosted job that does not match, is closed,
filled or deleted must still not appear. Each feed row returns `boost: feedBoost(row)` and NEVER price, plan, or end time.

## Step 5: employer endpoints
Employer Live-tab list: add the same join and return `boost: ownerBoost(row)` per job.
Mount `boostRoutes(pool, requireAuth)` at /api/boosts (05_boostRoutes.ts, use the app's real auth middleware).
GET /api/boosts/job/:jobId feeds the job management page.

## Step 6: indicators (two different ones, never mixed)
Use 07_BoostBadge.tsx. Map `boostColors` to the existing Lagoon & Sunrise tokens (keep the key names).
- JOB SEEKER (home feeds, search/Explore, category pages): when `job.boost?.isSponsored`, show `<BoostBadge audience="employee" />`
  (small neutral "Ad" pill) on the job card's image, top-left (heart stays top-right). No countdown, no color accent.
- EMPLOYER (Live tab cards): when `job.boost` exists show `<BoostBadge audience="employer" endsAt serverNow onExpire={refetch} />`
  and spread `ownerBoostedCardStyle` on that card container.
- EMPLOYER job management page: render `<EmployerBoostPanel boost={data} onExpire={refetch} />` near the top (08_EmployerBoostPanel.tsx).
  It shows time left, a progress bar, Started and Ends date/time, and "N more boosts queued".
Never show "Ad" on employer screens and never show a countdown to job seekers. Match fonts/spacing of the existing cards. Do not redesign cards.

## Step 7: inbox "Update" tab
The notifications written by boost_tick() use category 'update' and type 'boost_started' | 'boost_ended' with
data { boost_id, job_id, starts_at, ends_at }. Make the Update tab list them with the existing row style (title + body + time),
count them in the unread badge, and on tap open that job's management page using data.job_id. If the tab filters by a different
category value, change the value in the migration (one place), not the screen.

## Step 8: verify (do not skip)
1. Run 09_boostLifecycle.test.ts against a local/dev Postgres (needs the stub jobs/notifications tables or the real ones). All 7 checks must pass.
2. Manual: buy a boost on a test job -> badge shows "Boosted · Xd Yh left" on the employer card, "Ad" on that job in the home feed, an
   "Your boost is live" item appears in Update. Set that boost's ends_at to a minute from now -> badge disappears from both sides and
   "Your boost has ended" appears in Update, exactly once.
3. Report what you changed per file and anything that did not match the plan.
