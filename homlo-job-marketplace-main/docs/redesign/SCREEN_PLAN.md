# SCREEN_PLAN.md

Five employer screens, one visual family: **Lagoon & Sunrise**. This is a presentation-only plan.
Behavior comes from `FEATURE_CHECKLIST.md`; routing comes from `ROUTES.md`.

## Scope and source of truth

| Screen | Route | Active implementation |
|---|---|---|
| Job manager | `/employer/job/[id]` | `NewJobManager.tsx` via route stub |
| Boost plan | `/boost/plan` | `NewBoost.tsx` via route stub |
| Employer profile | `/employer/[employerId]` | `NewEmployerProfile.tsx` via route stub |
| View all jobs | `/employer/[employerId]/jobs` | `NewEmployerJobs.tsx` via route stub |
| Edit job | `/employer/job/[id]/edit` | `NewEditJob.tsx` via route stub |

Do not target the older `components/employer-v2/*` or `components/jobs-v2/theme.ts` paths named in
earlier redesign notes. The active five screens currently use `NewTheme.ts`, `NewUI.tsx`, and
`NewRoutes.ts`. `src/new/theme/tokensNew.ts`, `fontsNew.ts`, and `TextNew.tsx` exist but are not yet
used by these screens.

## Design direction

Calm employer tooling: lagoon teal structure, warm sunrise accents, cream “receipts”, soft borders,
generous rounded cards, and restrained motion. Light pages only. The screens should feel related but
not interchangeable: a stats-led manager, a campaign-led Boost flow, a profile-led employer page, a
dense jobs list, and a form with a live preview.

| Screen | Dominant surface | Accent budget | Signature |
|---|---|---|---|
| Job manager | White page + deep-teal Filled tile | Lagoon + sun; clay pay only | Bento stats, breathing seats, sun-dot applicant timeline, cream Boost ticket |
| Boost plan | Lagoon-tint hero + white ladder panel + cream plan cards | Lagoon + clay price; sun small | Animated budget, ripple artwork, plan ladder, snapping cards, sticky Continue |
| Employer profile | Dark banner fading into white | Lagoon + sun; dusk avatar tile only | Parallax hero, overlapping logo, hairline stats strip, reviews summary |
| View all jobs | White list + clay pay pills | Lagoon + clay; sun group dots | Collapsing name, chip row, count-up result count, date groups, dense rows |
| Edit job | White form + cream preview | Lagoon + clay; sun position dots | Live preview, photo tile, sliding salary segment, sticky save |

## Tokens

Use one active source. `NewTheme.ts` is current for the five screens; `tokensNew.ts` mirrors the
values. During implementation, make one the source and alias the other. Do not create a third palette.

### Color

| Role | Value |
|---|---|
| Teal / primary | `#0E7C86` |
| Deep teal | `#073B42` |
| Header/dark hero | `#052E34` |
| Lagoon tint | `#D8F0EE` |
| Lagoon tint 2 | `#B5E2DF` |
| Page background | `#F4F8F8` |
| Card | `#FFFFFF` |
| Border | `#E4ECEC` |
| Track | `#D9EAEA` |
| Text | `#14272B` |
| Muted text | `#58696B` |
| Sun | `#F5B52B` |
| Clay | `#C4531F` |
| Cream | `#FFF1D2` |
| Cream 2 | `#FFE0A0` |
| Cream ink | `#7A4300` |
| Dusk / avatar accent | `#6B4FA0` (`NewTheme.c.dusk`) |
| Danger | `#C0392B` on `#FBEAE6` |

The pale `tokensNew.dusk` (`#EDE6F7`) and `duskInk` (`#4A3578`) are separate lavender surfaces; do
not confuse them with `NewTheme.c.dusk` (`#6B4FA0`). Dusk is a small accent, never a second clay.

### Type

- Latin headings: Plus Jakarta Sans 700/800 (`PlusJakartaSans_700Bold`, `PlusJakartaSans_800ExtraBold`).
- Latin body/UI: Inter 400/500/600.
- Khmer: Noto Sans Khmer 400/500/600/700, with taller line height.
- Sizes: 12 caption, 13 meta, 14 body, 16 title, 17 section, 20 header, 24 hero. Large numeric
  displays may exceed this scale for the Boost budget and review rating.
- Adopt `TextNew`/`maxFontSizeMultiplier={1.3}` during the redesign. Active screens currently use raw
  `Text`; this is a known gap.
- Never compress Khmer line height to match Latin.

### Space, radius, elevation

- Space: 4, 8, 12, 16, 24, 32.
- Screen side margin: 16.
- Radii: chip 14, tile 16, card 20, hero 24, sheet 28, pill 999.
- Shadow: soft teal/deep tinted, low opacity; do not use harsh black.
- Primary pills: 48px tall. Icon buttons: 44px. Touch targets: at least 44px.

### Shared primitives

Keep the active vocabulary from `NewUI.tsx`: `Press` (0.975 scale), `Btn`, `Circ`, `Pill`, `Sun`,
`Sec`, `Reveal`, `Fade`, `Chip`, `Tabs`, `CountUp`, `Acc`, `Shimmer`, `JobRow`, `Icon`, `Boundary`.
Restyle them centrally rather than creating one-off variants.

- `Sun` is the section marker and timeline/date dot.
- `Pill` is the status/pay token; clay variant for pay, lagoon variant for status.
- `JobRow` is the list workhorse; keep its press target and one-line title.
- `Shimmer` is limited to two CTAs: Job manager Boost and Boost Continue.
- `Fade` is the hero-to-page transition, not a general overlay.

## Screen plans

### 1. Job manager — `/employer/job/[id]`

**Structure**

1. Top bar: 44px back circle, compact title that fades in, 44px “⋯”.
2. Hero: 24px title, applicant/unread/location summary.
3. Deep-teal Filled card: `filled of total`, seat grid; filled seats solid, empty seats dashed, with at least one seat rendered.
4. Bento row: Views, Applicants, Pay. Views/Applicants are white tiles with small bar marks; Pay is
   cream with clay price and unit suffix.
5. Cream Boost ticket: dashed perforation, sun bolt tile, existing light sweep, single Boost job CTA.
6. Location row on lagoon tint.
7. Sticky tabs: All / Pending / Accepted / Rejected with a 3px teal indicator.
8. Applications header with count pill; vertical sun-dot timeline; applicant cards.
9. Applicant card: initial avatar, name, relative time, unread dot, status pill, optional quoted
   message, location, Message + pending Accept/Reject actions.
10. Menus: filtered empty states; “⋯” overlay with Edit job and Delete job.

**Preserve:** optimistic status update/rollback, both confirmation Alerts, failure Alerts, haptics,
refetches, applicant status mapping, unread semantics, delete redirect, and exact routes.

**Do not add:** applicant detail press-through, profile view, extra menu items, or new statuses.

**Motion:** title crossfade; staggered reveal; seat pop and breathe; bars grow once; boost bolt glow;
list enter/exit; count changes. Add Reduce Motion guards where missing.

### 2. Boost plan — `/boost/plan`

**Structure**

1. Lagoon-tint hero with 3 step bars and `1/3`.
2. Back circle; header step bars; no extra actions.
3. Budget hero: 48px animated base price, plan name, days, secondary Pro price.
4. Artwork: rippling rings + `BoostPlanImage`, selected plan index.
5. White ladder panel: one stop per real plan, selected thumb, sun/clay Recommended label.
6. Snapping horizontal plan cards: cream ticket surface, plan name, days/one boost, large clay price,
   Pro price, dashed rule, feature checks.
7. Sticky bottom Continue: `Continue · $basePrice`, existing light sweep.

**Data contract:** every plan and price comes from `BOOST_PLANS`; recommended from
`RECOMMENDED_INDEX`; features are not rewritten. Do not hard-code six plans. This screen displays the
base price and secondary Pro price; it does not call `useIsPro`. Keep that behavior unless a separate
feature change is approved. Continue no-ops when `jobId`/`id` is absent.

**Motion:** selected thumb spring, card snap, count-up price, ripple rings, stagger. Stop loops under
Reduce Motion.

### 3. Employer profile — `/employer/[employerId]`

**Structure**

1. Banner hero: 190px + safe area, optional image, dark fallback, parallax and pull-stretch.
2. Floating back and “⋯” circles. “⋯” remains inert.
3. Overlapping 96px logo with 4px white ring; photo or initials on dusk.
4. Name + verified icon; `industry · city, country` line.
5. Hairline stats strip: Active jobs + mini bars, Rating + stars, On Homlo + year dots.
6. “About the employer” accordion, open by default.
7. Details card: Location, Industry, Response time.
8. Reviews: 40px rating, stars, review count, five distribution bars, local five-star rating card,
   `Write a review` outline CTA (no-op), review rows.
9. Active jobs section: up to three preview rows, each pressable to job detail.
10. Sticky bottom bar: Message (stub) and View all jobs.

**Preserve:** three-job preview, local-only rating, review list, `more` no-op, Message stub, and
View all jobs target. The distribution bars are currently fixed `[84,12,4,0,0]`; present them as
existing placeholder data, not live analytics.

**Do not add:** a working review composer, employer menu, employer chat, or extra jobs on the
preview.

### 4. View all jobs — `/employer/[employerId]/jobs`

**Structure**

1. Fixed top bar: back, employer name fading in, 44px spacer.
2. Large employer name below the bar.
3. Sticky horizontal chips: All, Part-time, Full-time, Weekends, Remote; Remote has a globe icon.
4. Count line `${n} jobs` and Newest/Oldest toggle.
5. Date groups: sun dot + Today/Yesterday/`{n}d ago`; dense job rows.
6. Job row: bag tile, title, `place · type`, clay pay pill; tap opens job detail.
7. Empty: bag circle + `No jobs match this filter`.
8. Loading: small centered spinner.

**Preserve:** every job returned by the repository (no status filter), the reverse-array sort toggle,
filter order/labels, count semantics, and empty copy. Do not add real date sorting, pagination, or
status tabs.

### 5. Edit job — `/employer/job/[id]/edit`

**Structure**

1. Top bar: back, `Edit job`, spacer.
2. Cream live preview: title/fallback, Virtual/location, clay salary pill.
3. Job photo tile: image or dashed add tile; upload overlay.
4. Job title field.
5. Salary: segmented Hourly/Daily/Monthly, amount, positions stepper with sun dots.
6. Location: virtual switch, text field, Select on map.
7. Details: description and requirements.
8. Sticky Save changes bar.

**Preserve:** seed-once behavior, permission/upload Alerts, three validations in order, exact payload
fields, `payableStatus`, `autoCloseEnabled: true`, success Alert + back, failure Alert, and map draft
handoff. The virtual switch is presentation-only and does not persist virtual/arrangement.

**Do not add:** category, employment type, or auto-close fields. Do not wire the unused category
route. Do not change pay-type mapping (`Hourly → hourly`, `Daily → daily`, `Monthly → fixed`).

## Motion budget

- Reveal: staggered fade/rise, 60–80ms stagger.
- Lists: entering/exiting + linear layout transitions on filter/sort.
- Scroll: collapsing titles, banner parallax/pull-stretch, sticky tabs/chips.
- Data: count-up for stats, prices, and result counts.
- Loops: seats, Boost bolt/ripples, selected thumb; no more than one loop per viewport where possible.
- Light sweeps: exactly two CTAs.
- Press: 0.975 on all buttons.
- Reduce Motion: required for all loops, count-ups, parallax, and large list transitions. Active gaps
  to close: `Bar`, `Tabs`, profile mini-stats, Boost ladder/step bars, `Acc`.

## Accessibility and localization

- Light mode only; body contrast at least 4.5:1.
- Every icon-only control keeps an accessibility label and role.
- Tabs use tab roles; switches expose checked state; accordions expose expanded state.
- 44px minimum targets; 48px primary pills.
- Support 130% text without clipping. Adopt `TextNew` or equivalent scaling behavior.
- Khmer must use Noto Sans Khmer and taller line height. Test mixed Khmer/Latin rows, buttons, and
  applicant names.
- Reduced Motion must not hide information that was only communicated by animation.

## Implementation order

1. Consolidate route builders in `lib/routes.ts`; `NewRoutes.ts` re-exports it. No target changes.
2. Consolidate tokens/typography; adopt `TextNew` and close Reduce Motion gaps.
3. Restyle shared primitives.
4. Rebuild Job manager.
5. Rebuild Boost plan.
6. Rebuild Employer profile.
7. Rebuild View all jobs.
8. Rebuild Edit job.
9. Run `pnpm check`, `pnpm lint`, targeted `pnpm test`, then the manual matrix.

## `MISSING` / deferred

- Job manager applicant detail/profile.
- Employer “⋯” menu.
- Employer review composer.
- Real employer conversation.
- View all jobs error/retry state.
- Edit job category/employment/auto-close controls.

These are not part of the presentation-only pass. Add them only in a separately approved feature
phase.
