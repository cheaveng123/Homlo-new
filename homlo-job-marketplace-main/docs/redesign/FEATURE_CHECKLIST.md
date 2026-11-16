# FEATURE_CHECKLIST.md

Presentation-only redesign of the five employer screens using the "Lagoon & Sunrise" family.

**Hard rule:** do not change features, logic, hooks, state, API calls, data models, permissions,
analytics, flags, copy, validation, actions, action order, filters, lists, loading/empty/error states,
or navigation targets. This checklist is the behavioral baseline for the redesign.

Legend: ✅ must work unchanged · 🎨 appearance may change · ⚠️ existing gap/limitation, not a redesign
feature · `MISSING` no real target exists; do not invent one.

## Active sources (not the legacy components named in older docs)

| Screen | Route | Active implementation |
|---|---|---|
| Job manager | `/employer/job/[id]` | `app/employer/job/[id].tsx` → `NewJobManager.tsx` |
| Boost plan | `/boost/plan` | `app/boost/plan.tsx` → `NewBoost.tsx` |
| Employer profile | `/employer/[employerId]` | `app/employer/[employerId]/index.tsx` → `NewEmployerProfile.tsx` |
| View all jobs | `/employer/[employerId]/jobs` | `app/employer/[employerId]/jobs.tsx` → `NewEmployerJobs.tsx` |
| Edit job | `/employer/job/[id]/edit` | `app/employer/job/[id]/edit.tsx` → `NewEditJob.tsx` |

The route files are 2–3 line re-export stubs. The five screens use `NewTheme.ts`, `NewUI.tsx`, and
`NewRoutes.ts`. `src/new/theme/*` and `TextNew` exist but are **not** used by these five screens.

---

## 1. Job manager — `/employer/job/[id]`

| Item | Status | Active behavior |
|---|---|---|
| Route param `id` | ✅ | Reads `id`; finds the matching row in `homlo.employer.jobs` |
| Query gating | ✅ | Jobs query enabled for signed-in users; applications query enabled only with `id`, a found job, and a user |
| Loading | ✅ | Full-page spinner + `Loading job` while `jobsQuery.isLoading` |
| Signed out | ✅ | `Sign in to open this job.` → replaces with `/login` |
| Job missing | ✅ | `This listing is no longer available.` → replaces with `/employer` |
| Navigation | ✅ | Back is `router.back()` |
| “⋯” button | ✅ | Opens custom absolute overlay menu; Edit job and Delete job only |
| Edit job | ✅ | `/employer/job/{id}/edit` |
| Delete job | ✅ | `Alert.alert` confirm → `homlo.employer.softDeleteJob` → `router.replace('/employer')`; failure Alert `Couldn't delete the job` |
| Header title | 🎨 | Large title fades out; compact title fades in after scroll |
| Summary line | ✅ | `{n} applicant(s) · {unread} unread · {location}` |
| Filled stat | ✅ | Count of local applicants with accepted status; total from `rolesTotal` |
| Views stat | ✅ | `viewsCount` |
| Applicants stat | ✅ | Local applicant count |
| Pay stat | ✅ | `$payAmount` + `/hr`, `/day`, or `/mo` from pay type |
| Applicant count/unread | ✅ | Unread comes from `isNew` (`!viewed_at`) |
| Seat visual | 🎨 | One seat per role, filled by accepted count; empty seats are dashed |
| Boost ticket | ✅ | `/boost/plan?jobId={id}` |
| Location row | 🎨 | `locationLabel` or `Location not provided` |
| Filter tabs | ✅ | `All`, `Pending`, `Accepted`, `Rejected`; local state only |
| Filtered count pill | ✅ | Number of rows in the current tab |
| Applicant identity | ✅ | Avatar initial, name, relative applied time, status pill, unread dot |
| Applicant note | ✅ | Rendered only when present, quoted |
| Applicant location | ✅ | `locationLabel` or `Location not provided` |
| Status mapping | ✅ | `hired` → Accepted; `declined`/`withdrawn` → Rejected; everything else → Pending |
| Message | ✅ | `/conversations/conversation?applicationId={id}&name={name}&applicationStatus={db status}` |
| Accept action | ✅ | Only pending rows. `Alert.alert('Accept this application?', …)` → `Yes, accept` |
| Reject action | ✅ | Only pending rows. `Alert.alert('Reject this application?', …)` → destructive `Reject` |
| Optimistic status update | ✅ | Local overwrite, then `homlo.applications.changeStatus`; success haptic + refetch applications/jobs; failure haptic, rollback, Alert `Couldn't update the application` |
| Accepted/rejected row actions | ✅ | Message remains; Accept/Reject disappear |
| Empty applications | ✅ | `No applications yet.` |
| Empty filtered tab | ✅ | `No applicants with this status.` (only when applicants exist) |
| Query error handling | ⚠️ | No explicit retry/error panel; applications fall back to empty, jobs failure falls into “listing no longer available” |
| Applicant detail route | `MISSING` | Active card has no press-through to `/employer/application/[id]` |
| View profile | `MISSING` | No action exists; do not add one |
| More menu items | `MISSING` | Only existing Edit/Delete items may be restyled |

Do not remove the Accept/Reject controls to match a design that omits them. Preserve confirmation
dialogs, optimistic behavior, refetches, haptics, and exact mutation inputs.

---

## 2. Boost plan — `/boost/plan`

| Item | Status | Active behavior |
|---|---|---|
| Route params | ✅ | `jobId`, optional `id` fallback, `step` (default `1`) |
| Plan source | ✅ | `BOOST_PLANS` from `lib/boostData.ts`; six real plans and real feature arrays |
| Recommended plan | ✅ | Initial selection is `RECOMMENDED_INDEX` (`standard`) |
| Default price display | ✅ | Large counter uses the plan’s base `price`; Pro price is secondary text |
| Pro pricing gap | ⚠️ | This screen does not call `useIsPro`; Continue uses base price. Downstream payment uses `useIsPro` |
| Step header | ✅ | Three bars and `{step}/3`; no step change besides Continue/back |
| Budget copy | ✅ | `Boost budget`, plan name, duration, base price, `Pro $…` |
| Artwork | ✅ | `BoostPlanImage` by plan index; no hard-coded image paths in the screen |
| Ladder | ✅ | One stop per real plan, selected thumb, recommended label at index 2 |
| Plan cards | ✅ | All six plans in a snapping horizontal carousel; selected card opacity 1, others 0.6 |
| Card content | ✅ | Name, days, one boost, base price, Pro price, all features |
| Ladder/card sync | ✅ | Tapping a stop scrolls the carousel; swiping updates the selected stop |
| Continue | ✅ | Label `Continue · $basePrice`; goes to `/boost/payment?jobId={jobId}&planId={planId}` |
| Missing job | ✅ | Continue renders but its callback no-ops because `job` is empty |
| Back | ✅ | `router.back()` |
| Static data states | ✅ | No loading/empty/error states on this screen; plans are local constants |
| Payment/success/failed | ✅ | Out of redesign scope; preserve routes and behavior |
| Pro price behavior | `MISSING` | Do not add Pro detection on this screen during a presentation-only pass |

The old checklist incorrectly said this screen uses `useIsPro`. It does not. The redesign keeps real
plans/prices and the existing base-price behavior. Do not hard-code six plans or prices.

---

## 3. Employer profile — `/employer/[employerId]`

| Item | Status | Active behavior |
|---|---|---|
| Route params | ✅ | `employerId`, fallback `id`, then default string `"1"` |
| Load | ✅ | `getEmployerById`, `getEmployerJobsPreview(eid, 3)`, `getEmployerReviews(eid)` in parallel |
| Cancellation | ✅ | Cleanup guard prevents state updates after unmount |
| Loading | ✅ | Centered spinner while loading or while employer is still null |
| Employer load failure | ⚠️ | No error/empty panel; a null employer leaves the spinner/blank state |
| Preview/review failure | ⚠️ | Jobs and reviews independently fall back to `[]` |
| Banner | 🎨 | Optional image; fallback dark teal surface; parallax/pull-stretch |
| Avatar | 🎨 | Optional photo; otherwise initials on a dusk tile |
| Identity | ✅ | Name, verified icon, `industry ?? category`, first two location segments |
| Stats strip | ✅ | Active jobs, rating, years on Homlo (derived from first number in `yearsOnHomlo`) |
| About | ✅ | `Acc` card, open by default |
| Details rows | ✅ | Location, industry/category, response time |
| Review summary | ✅ | Rating, review count, five distribution bars |
| Review distribution | ⚠️ | Bars use fixed values `[84, 12, 4, 0, 0]`, not actual review data |
| Review list | ✅ | Author, star rating, review text |
| Local rating | ✅ | `Worked with them?` stars update local state only |
| Write a review | `MISSING` | Renders an outline button whose `onPress` is a no-op |
| Active jobs preview | ✅ | Up to three jobs (`getEmployerJobsPreview(eid, 3)`) |
| Job preview row | ✅ | Title, first location segment, mapped employment label, `$price/unit`; tap → `/job/{id}` |
| Preview empty state | ⚠️ | No empty state; bordered jobs container still renders |
| Reviews empty state | ⚠️ | No empty state; summary card and rate card still render |
| “⋯” button | `MISSING` | Renders but `onPress` is empty; no menu exists |
| Message | `MISSING` | Existing target is `/messages/stub`; no employer thread exists |
| View all jobs | ✅ | `/employer/{employerId or id}/jobs` |
| Back | ✅ | `router.back()` |
| Sticky bottom bar | ✅ | Message + View all jobs only |

Do not wire “Write a review” or “⋯” to invented screens. Keep the local-only rating interaction.
The review distribution is currently placeholder presentation; do not describe it as real data.

---

## 4. View all jobs — `/employer/[employerId]/jobs`

| Item | Status | Active behavior |
|---|---|---|
| Route params | ✅ | `employerId`, fallback `id`, default string `"1"` |
| Load | ✅ | `getEmployerById` + `getEmployerJobs` in parallel |
| Name failure | ✅ | Falls back to `this employer` |
| Job failure | ⚠️ | Falls back to `[]`; no error panel |
| Loading | ✅ | Small centered spinner below count row |
| Status filtering | ✅ | None; displays every job returned by `getEmployerJobs` |
| Employment filters | ✅ | `All`, `Part-time`, `Full-time`, `Weekends`, `Remote`; Remote has globe icon |
| Filter matching | ✅ | Matches display label exactly against mapped employment type |
| Sort | ✅ | Toggle `Newest`/`Oldest`; implements reverse of the returned array, not date parsing |
| Result count | ✅ | Count of filtered rows |
| Header | 🎨 | Back, employer name, collapsible compact title |
| Date grouping | ✅ | Groups by `dayLabel`: `Today`, `Yesterday`, `{n}d ago`; shows sun-dot headers |
| Job row | 🎨 | Bag tile, title, `place · type`, clay pay pill; press → `/job/{id}` |
| Row data | ✅ | First location segment, employment label, `$price/priceUnit`; relative day drives grouping |
| Empty state | ✅ | `No jobs match this filter`; bag icon |
| Back | ✅ | `router.back()` |
| Error state | `MISSING` | No retry/error UI exists |
| “Live only” filter | `MISSING` | Older docs claimed this; it is not in active code |

Grouping and labels may be restyled, but do not add filters, status filtering, real date sorting,
pagination, or new navigation.

---

## 5. Edit job — `/employer/job/[id]/edit`

| Item | Status | Active behavior |
|---|---|---|
| Route param `id` | ✅ | Reads matching job from `homlo.employer.jobs` |
| Query gating | ✅ | Enabled for signed-in users with an id |
| Loading | ✅ | Full-page small spinner while jobs load |
| Signed out | ✅ | `Sign in to edit this job.` → replace `/login` |
| Job missing | ✅ | `This listing is no longer available.` → replace `/employer` |
| Seed | ✅ | Once per job: title, pay type, amount, positions, location, description, requirements, image, coordinates |
| Top bar | ✅ | Back, `Edit job`, spacer |
| Live preview | 🎨 | Title or `Job title`, `Virtual`/location fallback, `$amount` + suffix |
| Job photo | ✅ | Existing image or dashed add tile; tap opens library picker |
| Photo permission | ✅ | Alert `Photo access needed` |
| Photo upload | ✅ | Crop 16:9, JPEG conversion, `uploadJobImage`, `Uploading…` overlay |
| Photo failure | ✅ | Alert `Couldn't upload image` |
| Job title field | ✅ | Required, seeded, editable |
| Salary segment | ✅ | `Hourly`, `Daily`, `Monthly`; maps to `hourly`, `daily`, `fixed` |
| Salary amount | ✅ | Decimal input; required and must be `> 0` |
| Positions stepper | ✅ | Min 1, max 99; dot preview up to 12; seeded from `rolesTotal` |
| Virtual switch | ⚠️ | Presentation flag only; it hides/shows location and does not change saved data |
| Location text | ✅ | Editable when not virtual |
| Select on map | ✅ | `/employer/job/{id}/edit/location`; returns via `lib/job-edit-draft` and clears draft |
| Description | ✅ | Multiline; required for non-draft jobs |
| Requirements | ✅ | Multiline; optional |
| Validation Alerts | ✅ | `Add a job title`, `Check the salary`, `Add a description` |
| Save | ✅ | `homlo.employer.saveJob` with `buildJobSavePayload`; invalidates employer jobs |
| Saved status | ✅ | Preserves `draft`/`open`/`closed`/`cancelled` via `payableStatus` (`filled`/`expired` become `closed`); sends `autoCloseEnabled: true` |
| Save success | ✅ | Alert `Changes saved` → `router.back()` |
| Save failure | ✅ | Alert `Couldn't save changes` |
| Sticky save bar | 🎨 | `Saving…` while pending; button otherwise |
| Category UI | `MISSING` | No category control; the save payload sets `categoryId: null` |
| Employment type UI | `MISSING` | Not present in active screen |
| Auto-close UI | `MISSING` | Not present; payload always sends `autoCloseEnabled: true` |
| Category picker route | ⚠️ | `/employer/job/[id]/edit/category` exists but has no caller from this screen |
| Error/loading for save | ✅ | Inline button state + failure Alert only |

Do not add fields or start persisting virtual/employment/auto-close toggles. Preserve validation
order and exact mutation payload construction.

---

## Cross-cutting requirements

- ✅ Preserve every existing hook, query key, enabled condition, mutation input, refetch/invalidate,
  Alert copy, haptic, route target, and action order.
- ✅ Route paths are currently duplicated between `NewRoutes.ts` and `lib/routes.ts`; consolidate in
  `lib/routes.ts` during implementation and have `NewRoutes.ts` re-export it. Targets remain unchanged.
- ✅ Preserve the existing loading states, both empty applicant states, the jobs empty state, and all
  existing failure Alerts.
- ✅ Keep light pages; no dark page background.
- ✅ Keep `Press` scale `0.975`; primary pills 48px high; touch targets at least 44px.
- ✅ Keep the two existing light sweeps only (Job manager Boost, Boost Continue).
- ⚠️ Reduce Motion is respected by `Shimmer`, `CountUp`, `Seat`, boost `Ring`, and the boost glow.
  It is not applied to `Bar`, `Tabs`, profile stat animations, ladder/step bars, or `Acc`.
  Add missing guards during the redesign without changing behavior.
- ⚠️ The active five screens use raw `Text` + `NewTheme` fonts; they do not use `TextNew`, the
  `src/new/theme` tokens, automatic Khmer switching, or `maxFontSizeMultiplier`. The design
  requirement remains 130% scaling and Khmer support; adopting `TextNew`/Noto Khmer is a
  presentation-only change and must be verified.
- 🎨 Visual tokens: use `NewTheme.ts` and/or the matching `src/new/theme/tokensNew.ts` values; do not
  reintroduce the old green/coral palette.
- 🎨 Typography: Plus Jakarta Sans headings, Inter body/UI; Khmer must resolve to Noto Sans Khmer
  when adopted.
- 🎨 Contrast at least 4.5:1; labels and icon-only buttons keep accessibility labels/roles.
- 🎨 Do not change copy, counts, units, labels, filter order, tab labels, alert text, or button order.

## `MISSING` inventory (report only; do not build in the design pass)

| Location | Missing target |
|---|---|
| Job manager applicant card | Applicant detail/view profile press-through |
| Job manager “⋯” | Any item beyond existing Edit/Delete |
| Employer profile “⋯” | Menu/target |
| Employer profile “Write a review” | Review composer/persistence |
| Employer profile “Message” | Real employer conversation; only `/messages/stub` exists |
| View all jobs | Error/retry state |
| Edit job | Category, employment type, auto-close UI; category picker route exists but is unused |

## Out of scope

- `app/boost/payment.tsx`, `app/boost/success.tsx`, `app/boost/failed.tsx` — untouched.
- `app/employer/boost/[id].tsx` — legacy six-step wizard; no in-app caller.
- `app/account-plans.tsx` — separate pricing feature.
- Legacy screens under `screens/`/`legacy/`, old redesign components, and unused price components.

## Verification gate

- `pnpm check`
- `pnpm lint`
- Targeted `pnpm test`
- Manual: iPhone small + large, Android, 130% text, Reduce Motion, Khmer text if enabled.
- Manually tick every ✅ row on a running build before merge.
