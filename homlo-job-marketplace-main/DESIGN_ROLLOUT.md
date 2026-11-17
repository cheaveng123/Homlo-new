# HOMLO design rollout tracker

Style benchmark: the Employer Dashboard (`src/new/screens/PostDashboardScreenNew.tsx` +
`src/new/components/dashboard/*`). `docs/design/homlo-dashboard-preview.html` is **not in the repo**;
the dashboard implementation is used as the spec until it is added.

Say "continue" to resume from **Next**. Each batch: typecheck, lint, tests, commit `design: <screen>`.

## Foundation (Phase 0): done

| Piece | Where |
|---|---|
| Tokens (colors, radii, spacing, shadows, durations, hero gradient) | `src/design/tokens.ts` |
| Motion: `Reveal`, `PressableScale`, `useShake` | `src/design/motion.tsx` |
| Primitives: `Card` + `TopLight`, `Hero`, `Sheet`, `SectionTitle`, `CountPill`, `Tabs`, `ListRow`, `PrimaryButton`, `EmptyState`, `Skeleton`, `PhotoPlaceholder` | `src/design/primitives.tsx` |
| Icon kit + registry (tier A/B/C), new tier A: `NoResultsIcon`, `EmptyInboxIcon`, `SuccessIcon`, `ErrorStateIcon` | `src/components/icons/` |
| Central palettes remapped (names unchanged) | `theme.config.js`, `src/new/theme/tokensNew.ts`, `components/home/theme.ts`, `components/theme.ts`, `theme/tokens.ts`, `components/explore/tokens.ts`, `constants/jobsTheme.ts` |
| Legacy brand hex literals replaced in screen code | 53 files (commit "map central palettes") |
| Shared `*New` primitives restyled | `PrimitivesNew.tsx`: spring press, cyan-deep selected chips, radius-14 inputs with animated focus, sliding tab indicator, shimmer skeletons, tier A empty states |
| Job cards | `JobPartsNew.tsx`: Photo placeholder, no avatar over photos, cyan positions bar (amber only for the last position) |
| Icons: `AppIconNew` redrawn in-house (1.8 line, rounded, one solid signature detail); legacy `AppIcon` shares the same core glyphs, 1.8 line | `src/new/icons/AppIconNew.tsx`, `components/ui/AppIcon.tsx` |
| Section-title + fact icons (tier B, two-tone, one-shot entrance): jobField, jobType, recommended, nearby, popular, explore, recent, suggestions, trending, conversations, location, details, employer, pay, positions | `src/components/icons/SectionIcons.tsx`, `SectionTitleNew glyph=` (right of the title, `tone="mono"` slate) |
| Ads label: shaded amber tab flush to the photo's bottom-left (rounded top-right), animated megaphone; matching pill on small thumbnails | `AdTabNew` / `AdBadgeNew` in `JobPartsNew.tsx`, `BoostBadge` |
| jobs-v2 icon set redrawn (1.8 outline, one custom detail each) + per-category glyphs | `components/jobs-v2/AppIcon.tsx`, `categories.ts` |
| Map job pin: flat cyan pin replaces the glossy briefcase image | `src/components/map/assets/job-suitcase*` |
| Bottom nav (all tab screens) | `components/home/BottomTabBar.tsx`: no pill, cyan icon + 16x3 bar, amber dot on active Post (**uncommitted**, see below) |

## Screen inventory and status

Legend: ✅ done (restyled) · 🎨 repainted via shared layer only (tokens/primitives), needs per-screen polish · ⏭ skipped

| Priority | Route | Type | Implementation | Status |
|---|---|---|---|---|
| 0 | `/employer/listings` (Post tab) | Overview | `PostDashboardScreenNew` | ✅ benchmark |
| 1 | `/login` | Auth | `app/login.tsx` | 🎨 |
| 1 | `/onboarding` | Auth | `app/onboarding/index.tsx` | 🎨 |
| 1 | `/complete-profile` | Form | `app/complete-profile.tsx` | 🎨 |
| 2 | `/` Home | List/Overview | `HomeScreenNewAdapter` → `HomeScreenNew` | 🎨 (job cards ✅, section icons ✅ uncommitted) |
| 2 | `/search-detail`, `/search-results`, `/quick-search` | List | `SearchScreenNew`, `SearchResultsScreenNew`, `app/quick-search.tsx` | 🎨 |
| 2 | `/explore`, `/explore/filters` | List/Form | `components/explore/*`, `04_FilterScreen` | 🎨 |
| 2 | `/jobs/*` (recommended, popular, near-you, ways-to-work, category) | List | `app/jobs/*`, `components/jobs-v2/*` | 🎨 |
| 3 | `/job/[id]` | Detail | `app/job/[id].tsx` + `JobDetailScreenNew` | ✅ scroll choreography: stretchy/parallax hero, collapsing header + title, reading progress, scroll-revealed sections, custom fact icons, labels |
| 3 | `/job/[id]/apply` | Form | `app/job/[id]/apply.tsx` | 🎨 |
| 4 | `/applications`, `/applications/[id]` | List/Detail | `src/new/applications/*` | 🎨 |
| 4 | `/employer/applications`, `/employer/new-applicants`, `/employer/live-now`, `/employer/jobs-posted` | List | `components/employer-job/*` | 🎨 |
| 4 | `/employer/application/[id]` | Detail | `EmployerApplicantDetailView.jsx` | 🎨 |
| 5 | `/inbox`, `/conversations/[id]` | List/Detail | `InboxScreenNewAdapter`, `ChatThreadScreenNewAdapter` | 🎨 |
| 6 | `/profile`, `/profile/[section]` | Settings | `app/(tabs)/profile.tsx`, `app/profile/[section].tsx` | 🎨 |
| 6 | `/saved` | List | `app/(tabs)/saved.tsx` | 🎨 |
| 7 | `/employer/job/[id]`, `/employer/job/[id]/edit*`, `/employer/post-job` | Detail/Form | `NewJobManager`, `NewEditJob`, `app/employer/post-job.tsx` | 🎨 |
| 7 | `/employer/[employerId]`, `/employer/[employerId]/jobs` | Detail/List | `NewEmployerProfile`, `NewEmployerJobs` | 🎨 |
| 8 | `/boost/*`, `/employer/boost/[id]`, `/checkout`, `/account-plans` | Form/Modal | `NewBoost`, `app/boost/*`, `app/checkout.tsx` | 🎨 |
| 9 | `/jobs-map`, `/job/[id]/location`, `/employer/job/[id]/edit/location` | Map | map components | ⏭ |
| 9 | `/discover/[kind]`, `/vista/[categoryKey]`, `/guided-*`, `/category-listing` | List | various | 🎨 |
| — | `/dev/theme-lab`, `/messages/stub`, `/oauth/callback` | Dev/utility | — | ⏭ |

## Next (in priority order)

0. **Icons still to redraw in house style**: the ~60 remaining glyphs in `components/ui/AppIcon.tsx` (already custom, need the 1.8/rounded pass glyph by glyph), and `src/components/icons/Icons.tsx`. Then give the remaining section headers (legacy screens use their own headers, not `SectionTitleNew`) `SectionIcon` glyphs.

1. **Auth/onboarding**: gradient `Hero` + one tier A icon per step; `PrimaryButton`; radius-14 inputs (`login.tsx`, `onboarding/index.tsx`, `complete-profile.tsx` use their own inline styles, not `FieldNew`).
2. **Job detail + apply**: hero photo with `PhotoPlaceholder`, tier B fact rows, sticky bottom bar with `PrimaryButton` + `SuccessIcon` after submit.
3. **Applications (seeker + employer)**: `Card light` on key items, `Reveal` first screenful, `CountPill` status, shaped skeletons, `EmptyState`.
4. **Inbox/chat**: `EmptyState icon="inbox"`, row press feedback.
5. **Profile/settings**: cyan `Hero` + overlapping `Sheet`, `ListRow` with tier B icons.
6. Employer job manager/edit/post-job forms, then boost/checkout.

## Skipped and why

- Map screens: map styling lives in MapLibre styles; restyling them costs more than it adds.
- Dev/utility routes (`/dev/theme-lab`, `/messages/stub`, `/oauth/callback`): not user-facing.
- Root `0x_*.tsx` duplicates other than `04_FilterScreen`: legacy copies, not routed.

## Uncommitted on purpose

These files changed for the redesign but **also contain unrelated uncommitted work that was already on the branch**,
so they were left out of the `design:` commits to avoid sweeping that work in. Commit them with that work:

- `components/home/BottomTabBar.tsx` (new nav style)
- `components/jobs-v2/PostJobFlow.tsx` (category tiles without the tinted disc, slate/cyan icon)
- `src/new/screens/HomeScreenNew.tsx`, `SearchScreenNew.tsx`, `InboxScreenNew.tsx` (section icons: only `glyph=` props added)
- `src/new/screens/PostDashboardScreenNew.tsx`, `screens/EmployerDashboardNewAdapter.tsx`, `src/new/theme/copyNew.ts` (dashboard)
- ~11 screen files where the hex recolor overlapped pre-existing edits (see `git diff`)

## Known deviations

- Positions show "accepted/total" (e.g. "1/2 positions"), not "N positions left": `tests/job-positions-views-contract.test.ts` forbids "positions left" wording.
- Coral and clay accents are remapped to amber (`clay` → `#E8870F`) because the spec keeps coral inside multi-tone icons only.
- `dusk` (violet) accent tokens are remapped to neutral cyan-grey for the same reason.
