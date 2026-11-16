# PROMPT FOR THE CODING AGENT: Homlo Jobs home-page backends (ALL sections)

You are implementing the **backend for every job section on the Homlo Jobs home page**:
**Recommended, Popular (home preview AND the Popular detail page), Jobs near you, and Explore.**
Everything is already written and tested in the attached files. Your job is to **install, adapt to our real schema, wire up, and verify**. It is not to redesign.

## Hard rules
1. **No UI changes.** Do not change layouts, styles, fonts, colors, or navigation.
2. **No new features.** In particular: **do not add any filter UI or search filters.** The only "filtering" in this system is internal backend logic (eligibility and region damping).
3. **Mobile is plain React Native. Do not introduce Expo-specific APIs** in anything you add. The client files below import nothing from `react-native` or `expo-*`. (We are migrating away from Expo.)
4. **Do not change any number in `marmot_tuning_knobs.ts`.** All tunable numbers live there. If something needs tuning, tell me instead.
5. **Do not edit the scoring logic** (`walrus_scoring_engine.ts`, `heron_feed_assembler.ts`). If you think there is a bug, run the tests, show me the failing case, and ask first.
6. **Keep the database swappable** (Supabase today, AWS RDS/Aurora later). SQL only lives in `quokka_ledger_schema.sql` and `badger_postgres_store.ts`.
7. **Privacy model: fully anonymous.** No user id, no profile, no device id, no history is used or stored for ranking. Do not add any. Never log events from the employer side.

## What this system does (so you understand the intent)
It is **not personalized**. Every viewer sees what the majority of users respond to, with light adjustments:
- Anonymous events (`impression, view, dwell_15s, save, apply`) are logged with a random, rotating session id.
- A scheduled SQL function turns events into time-decayed totals per job for three windows: **today / week / month**.
- Each request scores jobs by a **smoothed engagement rate** (engagement ÷ exposure, pulled toward the global average so a lucky job with 3 views cannot beat a proven one), times a small confidence, freshness and employer-quality factor. On-site jobs far from the viewer are *damped* (never removed). Remote jobs are not damped.
- Sections: **Recommended** = month-window popularity. **Popular** = week-window by default; detail page supports `period = today | week | month`. **Jobs near you** = 60% proximity + 40% popularity, within 25 km (widens once to 60 km if fewer than 6 jobs). **Explore** = popularity + freshness blend, deterministic per seed, with every 5th slot given to an under-exposed job so new postings get a chance. **Home** = all four at once, with Recommended/Popular/Explore not repeating each other.
- With no traffic at all (cold start) everything still works: order falls back to freshness + employer quality.

## FILE MAP (keep the file names exactly as they are, in ONE folder, e.g. `backend/feed/`)
Names are intentionally unusual so they cannot clash with existing files. They import each other with relative paths, so keep them together. Do not rename unless you do it with an IDE refactor that updates imports.

| Category | File | Purpose | Runs on |
|---|---|---|---|
| Database | `quokka_ledger_schema.sql` | Migration: event table, stats tables, refresh function, **eligibility view (adaptation point)** | Postgres |
| Config | `marmot_tuning_knobs.ts` | Every tunable number + generator for the scheduler SQL | Server |
| Types | `finch_shared_shapes.ts` | Shared types (type-only, safe to copy into the app bundle) | Server + App |
| Logic | `walrus_scoring_engine.ts` | Pure scoring math | Server |
| Logic | `heron_feed_assembler.ts` | Builds all feeds (home, recommended, popular, near, explore) | Server |
| Data | `badger_postgres_store.ts` | The only runtime SQL; implements `FeedStore` | Server |
| API | `ibis_request_router.ts` | Framework-neutral request handler with strict validation | Server |
| Client | `otter_event_recorder.ts` | Anonymous event batching, dwell timer, FlatList viewability helpers | App |
| Client | `lynx_feed_client.ts` | Typed fetch client for the feed endpoints | App |
| Proof | `pangolin_proof_tests.ts` | 46 logic tests (no DB needed) | Dev |
| Proof | `pangolin_sql_proof.ts` | 6 tests against a real Postgres+PostGIS | Dev |
| Proof | `pangolin_simulation.ts` | Fake-traffic quality check for tuning | Dev |

## STEP 1: Adapt the database view (the ONLY schema-specific part)
Open `quokka_ledger_schema.sql`. The view `feed_eligible_jobs` has an **example** mapping onto a `jobs` table. Inspect our real schema and rewrite **only the right-hand side/WHERE of that view** so it outputs exactly these columns:

`id uuid, employer_id uuid, category text, work_arrangement ('on_site'|'hybrid'|'remote'), job_type ('part_time'|'full_time'|'weekends'|null), pay_min float8, pay_max float8, pay_period ('hourly'|'daily'|'weekly'|'monthly'|'yearly'|null), created_at timestamptz, positions_left int (null = unlimited), location geography(Point,4326) (null allowed for remote), employer_quality float8 (0..1, null = unknown)`

Requirements:
- Only jobs that are **live** (confirm the real status value; our dashboard has Live / Draft / Review tabs, so Draft and Review jobs must NOT appear), **not soft-deleted** (`deleted_at is null`), and **not filled/closed** (respect auto-close and positions-left).
- Translate our real enum values into the strings above with `CASE` if they differ (e.g. `onsite` → `on_site`). If `location` is stored as lat/lng columns, build the geography in the view with `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`.
- If ids are not `uuid` (e.g. bigint), tell me before changing anything. The event table and router validation assume uuid.
- Leave `employer_quality` as `null` unless a real 0..1 score already exists. Do not invent one.
- Do not touch the rest of the file.

Ship it as a normal **version-controlled migration file** (not via the dashboard).

## STEP 2: Schedule the stats refresh
Every **10 minutes** run the SQL produced by `refreshJobStatsSql()` (in `marmot_tuning_knobs.ts`). Print it once, and register it with pg_cron (Supabase) or any scheduler that can run SQL. That string carries our tuning numbers into the database so SQL and TypeScript always agree. Re-generate and re-register it whenever `marmot_tuning_knobs.ts` changes. Verify it runs once manually.

## STEP 3: Host the API
`ibis_request_router.ts` exports `createRouter(service)`, taking `{ method, path, query, body }` and returning `{ status, body }`. Mount it behind any server (Supabase Edge Function, Node/Express/Hono, Lambda).
```ts
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });   // use the pooled connection string
const service = createFeedService(createPostgresFeedStore(db));
const handle = createRouter(service);
```
Endpoints: `GET /feed/home | /feed/recommended | /feed/popular | /feed/near | /feed/explore` and `POST /events`.
- **The database credentials must exist only on the server.** Never ship them (or a service-role key) in the app.
- Add basic **rate limiting on `POST /events`** (per IP) in the host layer. The router already caps a batch at 100 events and validates everything.
- Log 500s on the server. The router already returns a generic message to the client.

## STEP 4: Wire the app (NO visual changes)
Use `createFeedClient` from `lynx_feed_client.ts` inside our **existing repository/data layer**.
- The feed returns **job ids + small metadata**, not job cards. Load the cards through the existing repository (e.g. `getJobsByIds`) and **render them in the exact order the feed returned**. Drop ids the repository cannot find; do not crash.
- **Home screen:** one `client.home({lat, lng, prefs})` call feeds the four existing sections (Recommended, Popular, Jobs near you, Explore). Pass coarse lat/lng only if location permission was granted; otherwise omit them.
- **"Jobs near you" with `status: 'no_location'`:** show the app's existing no-permission/empty state. Do not invent a new one.
- **Detail / "view all" pages:** call the matching endpoint (`recommended`, `popular`, `near`, `explore`) and paginate with `nextCursor` (infinite scroll). Always pass the returned `nextCursor` back unchanged. De-duplicate by job id when appending pages (defensive).
- **Popular detail page period chips:** map them to `period: 'today' | 'week' | 'month'` and refetch from page 1 when the chip changes. **The approved design has period chips; confirm their labels map cleanly to these three keys, and if they do not, STOP and ask me.**
- **Explore:** generate one random `seed` string per app session and pass it on the first Explore request (it is stored in the cursor afterwards).
- **Match percentage badge:** each item has `fitPercent` (`55-98` or `null`). Show the badge **only when it is not null**; hide it otherwise. Pass the saved quick-search answers as `prefs` (`{ jobTypes, payMin, payMax, payPeriod }`) so it can be computed. **Never display `score`** and never present popularity as a "match". Remove any old hardcoded or fake percentage.

## STEP 5: Record anonymous events (this is what makes the feed learn)
Create ONE `JobEventRecorder` for the app's lifetime:
```ts
const recorder = new JobEventRecorder({ send: (batch) => client.sendEvents(batch) });
// plain React Native, no Expo:
import { AppState } from 'react-native';
AppState.addEventListener('change', (s) => { if (s !== 'active') recorder.onBackground(); });
```
Call sites (**job-seeker side only; never when an employer views their own listing/dashboard**):
- **impression:** on every job-card list (home sections and all detail lists). Define `viewabilityConfig={impressionViewabilityConfig}` and `onViewableItemsChanged={makeOnViewableItemsChanged(recorder, job => job.id)}` **once** (module level / `useRef`). FlatList errors if either changes between renders. For horizontal rows and `ScrollView`-based sections that are not FlatLists, use the same rule: a card counts only after being at least 50% visible for 1 second.
- **view:** once when Job Detail opens.
- **dwell:** `const stop = recorder.startDwell(jobId)` when Job Detail gains focus; call `stop()` when it loses focus or unmounts.
- **save:** when the user saves a job (not on un-save). **apply:** only after the application is actually submitted successfully.
- Do not log anything else, and do not attach user id, device id or location to events.

## STEP 6: Verify (do not skip; report the real output to me)
In a scratch environment: `npm i -D typescript tsx pg @types/pg @types/node`
1. `npx tsx --test pangolin_proof_tests.ts`: expect **46 pass, 0 fail**.
2. `npx tsx --test pangolin_sql_proof.ts` against a **throwaway Postgres+PostGIS database** (`DATABASE_URL=...`): expect **6 pass, 0 fail**. **It drops the public schema. Never point it at a real database.**
3. `npx tsx pangolin_simulation.ts`: the "This algorithm" row should clearly beat both naive rows.
4. Strict type-check: `npx tsc --noEmit --strict` on the folder.
5. Against our **real** staging database after your migration: manually run `select refresh_job_stats(...)` once and confirm `select count(*) from feed_eligible_jobs` equals the number of live jobs you expect (and that no Draft/Review/closed/filled/deleted job is in it).
6. In the app: open the home screen, confirm four sections load in server order; open Job Detail; wait 15+ seconds; go back; confirm rows appear in `job_events` (`impression`, `view`, `dwell_15s`); wait for a refresh and confirm `job_stats` fills in.

## Known limits (tell me, do not "fix" them silently)
- Distance is straight-line (PostGIS geography), not road distance.
- Each request ranks up to 5,000 candidate jobs in memory (`candidateLimit`). Fine for now; if the job count grows past that, tell me and we will add caching.
- Pagination cursors freeze the ranking time but not the stats refresh; in the rare case a refresh lands between pages, a job could repeat. The client de-dupes by id.
- Dedupe of events is per UTC day (a session counts each event type once per job per day).
- The match percentage reflects only the quick-search answers (job type, pay, distance). It is intentionally not popularity.

## Definition of done
All four sections plus the Popular detail page return real data from the new endpoints; events are being recorded; tests listed above pass; **zero UI or style changes; zero new filters; zero Expo-only imports added.** Reply with: the adapted view SQL, test output, and a list of files you touched.
