# ROUTES.md

Complete route inventory for Homlo Jobs. This documents the current `app/` tree and the generated
Expo Router types; it does not add or rename routes. All paths are public unless marked internal.

## Rules

- Paths come from the current `app/` files, cross-checked against `.expo/types/router.d.ts`.
- `(tabs)` is a route group, not a URL segment. Use the public aliases below in new code.
- `app/employer/[employerId]/types.ts`, `employerRepository.ts`, and `employmentTypeIcons.tsx` are
  data/components that accidentally live under the route tree. They appear in generated types but
  are **not navigable screens**.
- `/hr`, `/day`, and `/mo` appear in search results but are pay suffixes, not routes.
- Do not invent targets. See `MISSING` at the bottom.
- Route builders are currently duplicated:
  - `NewRoutes.ts` → `R` and `go`; used by the five active `New*` screens.
  - `lib/routes.ts` → `routes`/`R`; used by legacy screens.
  - During implementation, make `lib/routes.ts` canonical and have `NewRoutes.ts` re-export it.

## Tab routes

| Path | Aliases | Source | Params / notes |
|---|---|---|---|
| `/` | `/(tabs)` | `app/(tabs)/index.tsx` | Home feed |
| `/explore` | `/(tabs)/explore` | `app/(tabs)/explore.tsx` | Explore |
| `/inbox` | `/(tabs)/inbox` | `app/(tabs)/inbox.tsx` | Conversations inbox; Applications tab is a list filtered by application status |
| `/jobs` | `/(tabs)/jobs` | `app/(tabs)/jobs.tsx` | Jobs tab |
| `/post` | `/(tabs)/post` | `app/(tabs)/post.tsx` | Post entry |
| `/profile` | `/(tabs)/profile` | `app/(tabs)/profile.tsx` | Own profile |
| `/saved` | `/(tabs)/saved` | `app/(tabs)/saved.tsx` | Saved jobs |

## Auth, onboarding, account

| Path | Source | Params / notes |
|---|---|---|
| `/login` | `app/login.tsx` | Sign in |
| `/onboarding` | `app/onboarding/index.tsx` | Onboarding |
| `/oauth/callback` | `app/oauth/callback.tsx` | `code?`, `state?`, `error?`, `sessionToken?`, `user?` |
| `/complete-profile` | `app/complete-profile.tsx` | Profile completion |
| `/account-plans` | `app/account-plans.tsx` | Account plans; separate feature, not Boost pricing |

## Search and discovery

| Path | Source | Params / notes |
|---|---|---|
| `/category-listing` | `app/category-listing.tsx` | `category?`, `title?` |
| `/quick-search` | `app/quick-search.tsx` | Quick search entry |
| `/detailed-search` | `app/detailed-search.tsx` | Detailed filters |
| `/search-detail` | `app/search-detail.tsx` | Search detail entry |
| `/search-results` | `app/search-results.tsx` | Raw search params, including `jobType`; filter params are managed by search helpers |
| `/guided-search` | `app/guided-search.tsx` | Guided search |
| `/guided-results` | `app/guided-results.tsx` | Guided results |
| `/explore/filters` | `app/explore/filters.tsx` | Explore filter picker |
| `/jobs-map` | `app/jobs-map.tsx` | Map search |
| `/discover/[kind]` | `app/discover/[kind].tsx` | `kind`; unknown values fall back to `part-time` |
| `/vista/[categoryKey]` | `app/vista/[categoryKey].tsx` | `categoryKey` |
| `/jobs/category/[slug]` | `app/jobs/category/[slug].tsx` | `slug`; unknown values fall back to `cafe` |

## Jobs and applications

| Path | Source | Params / notes |
|---|---|---|
| `/job/[id]` | `app/job/[id].tsx` | `id`; public job detail |
| `/job/[id]/apply` | `app/job/[id]/apply.tsx` | `id`; submit application |
| `/job/[id]/location` | `app/job/[id]/location.tsx` | `id`; job map |
| `/jobs/near-you` | `app/jobs/near-you.tsx` | Near-you listing |
| `/jobs/popular` | `app/jobs/popular.tsx` | Popular listing |
| `/jobs/recommended` | `app/jobs/recommended.tsx` | Recommended listing |
| `/jobs/ways-to-work` | `app/jobs/ways-to-work.tsx` | `tab?` = `part-time`, `full-time`, `weekends`, `remote`; missing/unknown becomes Part-time |
| `/post-job` | `app/post-job.tsx` | Post a job |
| `/applications` | `app/applications/index.tsx` | Worker applications list |
| `/applications/[id]` | `app/applications/[id].tsx` | `id`; worker application detail |
| `/conversations/[id]` | `app/conversations/[id].tsx` | `id`; chat. Also accepts `applicationId?`, `jobId?`, `name?`, `jobTitle?`, `applicationStatus?`, `photo?` |
| `/messages/stub` | `app/messages/stub.tsx` | `employerId?`; placeholder employer message target |

`NewRoutes.R.thread()` uses the public path `/conversations/conversation?...`; it resolves through
`/conversations/[id]` with `id = "conversation"` and application params.

## Employer

| Path | Source | Params / notes |
|---|---|---|
| `/employer` | `app/employer/index.tsx` | Employer home |
| `/employer/applications` | `app/employer/applications.tsx` | Applications across jobs |
| `/employer/enterprise-campaign` | `app/employer/enterprise-campaign.tsx` | Enterprise campaign |
| `/employer/jobs-posted` | `app/employer/jobs-posted.tsx` | Posted jobs |
| `/employer/jobs` | `app/employer/jobs.tsx` | Employer jobs |
| `/employer/listings` | `app/employer/listings.tsx` | Employer listings |
| `/employer/live-now` | `app/employer/live-now.tsx` | Live jobs |
| `/employer/new-applicants` | `app/employer/new-applicants.tsx` | New applicants |
| `/employer/post-job` | `app/employer/post-job.tsx` | Post a job |
| `/employer/[employerId]` | `app/employer/[employerId]/index.tsx` | `employerId`; active profile also falls back to `id`, default `"1"` |
| `/employer/[employerId]/jobs` | `app/employer/[employerId]/jobs.tsx` | `employerId`; same `id`/`"1"` fallback as profile |
| `/employer/application/[id]` | `app/employer/application/[id].tsx` | `id`, `jobId` |
| `/employer/boost/[id]` | `app/employer/boost/[id].tsx` | `id`, plus optional `title`, `company`, `city`, `category`, `employmentType`, `workArrangement`, `salary`, `step`, `planId`, `payment`; legacy wizard with no in-app caller |
| `/employer/job/[id]` | `app/employer/job/[id].tsx` | `id`; Job manager |
| `/employer/job/[id]/edit` | `app/employer/job/[id]/edit.tsx` | `id`; Edit job |
| `/employer/job/[id]/edit/category` | `app/employer/job/[id]/edit/category.tsx` | `id`, `current?`; route exists but no active caller |
| `/employer/job/[id]/edit/location` | `app/employer/job/[id]/edit/location.tsx` | `id`, `lat?`, `lng?`; writes `lib/job-edit-draft` for Edit job |

## Boost and payment

| Path | Source | Params / notes |
|---|---|---|
| `/boost/plan` | `app/boost/plan.tsx` | `jobId?`, `id?`, `step?`; active plan screen |
| `/boost/payment` | `app/boost/payment.tsx` | `jobId?`, `planId?`; active payment screen, not redesigned |
| `/boost/success` | `app/boost/success.tsx` | `jobId?`, `planId?`, `receiptId?`; active success screen, not redesigned |
| `/boost/failed` | `app/boost/failed.tsx` | `jobId?`, `planId?`, `reason?`; active failure screen, not redesigned |
| `/checkout` | `app/checkout.tsx` | `kind?`, `plan?`, `planId?`, `payment?`, `price?`, `duration?`, `jobTitle?`, `company?`, `jobId?`, `city?`, `category?`, `employmentType?`, `workArrangement?`, `salary?` |

`NewRoutes.R.boost()` emits `/boost/plan?jobId=…` for step 1 and
`/boost/payment?jobId=…&planId=…` for later steps.

## Profile

| Path | Source | Params / notes |
|---|---|---|
| `/profile/[section]` | `app/profile/[section].tsx` | `section`; valid values: `edit`, `about`, `location`, `contact`, `employer`, `applications`, `language`, `currencies`, `security`, `devices`, `password` |

## Dev and generated

| Path | Source | Params / notes |
|---|---|---|
| `/dev/theme-lab` | `app/dev/theme-lab.tsx` | Development-only theme lab |
| `/_sitemap` | Expo Router | Generated route index; do not add to app navigation |

## Non-screen modules in the route tree

| Generated path | Source | Notes |
|---|---|---|
| `/employer/[employerId]/employerRepository` | `app/employer/[employerId]/employerRepository.ts` | Repository/data functions; not a React screen |
| `/employer/[employerId]/types` | `app/employer/[employerId]/types.ts` | Types only; not a React screen |
| `/employer/[employerId]/employmentTypeIcons` | `app/employer/[employerId]/employmentTypeIcons.tsx` | Component exports; no default screen |

Moving these out of `app/` would remove them from generated route types, but that is an
implementation change and not part of Phase 0. Do not navigate to them.

## Active screen targets

| Screen | Existing targets |
|---|---|
| Job manager | Back; Edit job; Delete job → employer home; Boost job → Boost plan; applicant Message → conversation; login/employer replace states |
| Boost plan | Back; Continue → payment |
| Employer profile | Back; job rows → job detail; Message → `/messages/stub`; View all jobs |
| View all jobs | Back; job rows → job detail |
| Edit job | Back; map picker; save success → back; login/employer replace states |

## `MISSING`

| Location | Missing |
|---|---|
| Job manager applicant card | Applicant detail/view profile target |
| Employer profile “⋯” | Menu and targets |
| Employer profile “Write a review” | Review composer |
| Employer profile “Message” | Real employer conversation; only `/messages/stub` |
| View all jobs | Error/retry route/state |
| Edit job | Category/employment/auto-close controls; category route exists but is unused |

## False positives

- `/hr`, `/day`, `/mo` — pay suffixes (`suffix()` in `NewJobManager`), not routes.
- `(tabs)` — route group alias only.
- Legacy `app/employer/boost/[id].tsx` has no in-app caller; it is still a real route.
