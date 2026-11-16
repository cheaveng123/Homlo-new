# Homlo Jobs: four new job pages + new color palette (React Native / Expo, mobile only)

This is a mobile-only React Native (Expo, expo-router) app. Do not build or test the web target.
Do not touch auth logic, the data/repository layer, or any screen not named below.
Follow the supplied files exactly. They are the approved design. Do not redesign, "improve" or restyle them.

## Files and where they go (each file's first comment line says its destination)

| Supplied file | Destination |
|---|---|
| 01_profileTheme.ts | lib/profileTheme.ts (updated: new palette) |
| 03_AppIcon.tsx | components/ui/AppIcon.tsx (updated: 7 new icons) |
| 04_ProfileUI.tsx, 05_ProfileScreen.tsx, 06_ProfileSection.tsx | the profile files from before (updated: new palette only) |
| 07_jobsTheme.ts | lib/jobsTheme.ts |
| 08_jobsData.ts | lib/jobsData.ts (MOCK data) |
| 09_JobsUI.tsx | components/jobs/JobsUI.tsx |
| 10_RecommendedScreen.tsx | app/jobs/recommended.tsx |
| 11_WaysToWorkScreen.tsx | app/jobs/ways-to-work.tsx |
| 12_JobsMap.tsx | components/jobs/JobsMap.tsx |
| 13_NearYouScreen.tsx | app/jobs/near-you.tsx |
| 14_CategoryScreen.tsx | app/jobs/category/[slug].tsx |

Install anything missing: `npx expo install expo-linear-gradient expo-status-bar react-native-svg react-native-safe-area-context expo-image-picker`.
Reanimated 4.5.1 and expo-router are already in the project. Fix import paths to match the project's aliases.

## The four pages (no job detail page; do not create one)

1. Recommended: a "Top match" hero card, round category selectors, and a list of jobs with half-circle match gauges.
2. Ways to work (this is the JOB TYPE page): a sliding toggle with Part-time, Full-time, Weekends and Remote. Each tab has its own layout:
   - Part-time: day-of-week circles that filter shifts.
   - Full-time: salary circles that filter roles.
   - Weekends: Sat/Sun filter chips and ticket-style cards.
   - Remote: cards with a working-hours bar.
3. Jobs near you: a map with price pins, 1 / 3 / 5 km radius circles that resize the dashed radius ring and filter the list, and walk/ride times.
4. Category detail (this is the JOB FIELD page): opens when the user taps any job category anywhere in the app. Show a header with the category icon, a stats card, a "typical pay" bar, role chips and a sort control (Best match, Nearest, Pay). Wire every existing category tile or button to `router.push('/jobs/category/<id>')`. The ids are cafe, hotel, retail, delivery and office. Map the app's real category ids to these.

## Entry points: how users reach each page (required)

The four pages are routes. They must also be reachable from the real app, not only by deep link. Wire these:

- /jobs/recommended: the arrow button on the "Recommended" section of the jobs home, and any "See all recommended" link.
- /jobs/ways-to-work?tab=part-time | full-time | weekends | remote: every existing job-type tile, chip or filter. Pass the matching `tab` value. If the app has only one "job type" entry, open it with no tab (it starts on Part-time).
- /jobs/near-you: the "Jobs near you" arrow or button.
- /jobs/category/<id>: every job field / category tile (ids: cafe, hotel, retail, delivery, office; map the app's real ids to these).

First search the app for the existing job-type and category UI (tiles, chips, section headers). If you cannot find one for a page, do NOT invent a new home screen. Tell me which entry point is missing and what you found instead.

## Design rules (already implemented in the files; keep them)

Palette "Lagoon & Sunrise":
- Main: primary teal #0E7C86, deep teal #073B42, tint #D8F0EE, background #F4F8F8, border #E4ECEC.
- Text: #14272B for primary text, #58696B for muted text.
- Accents: sun #F5B52B, clay #C4531F (pay tags), cream #FFF1D2 (ticket and promo surfaces).
- Do not use green or purple anywhere in these pages or the profile pages.

Layout:
- Spacing is an 8pt grid: 4, 8, 12, 16, 24, 32. Screen side margin is always 16.
- Radii: logo 16, card 20, hero/overlap card 24, chip 14, pills 999.
- Every touch target is at least 44px. The save button is 36px with `hitSlop`.
- Type scale: 12 caption, 13 meta, 14 body, 16 title, 17 section, 20 header, 24 hero. Headings use Plus Jakarta Sans (700/800) and body uses Inter (400/500/600). If the project has `familyForWeight()`, use it instead of the font-name constants in `lib/profileTheme.ts`.

Signature elements (keep the exact look):
- Header: a teal gradient with soft rays, a small saffron sun, and a curved hill edge. All of these are in `SunriseHeader`.
- Cards that overlap the header edge by 30px.
- Round selectors: a ring plus a small saffron check badge when selected.
- Section titles with a sun dot.
- The half-circle match gauge.
- The weekend ticket: cream, with notched edges and a dashed tear line.
- Save button: a + that turns into a check on tap.
- Press feedback: scale 0.975 on buttons, rows and the round header buttons, and 0.985 on job cards.
- The "Quick apply" button keeps the subtle diagonal shine (the `shine` prop). It must stay off when Reduce Motion is on, and there are no sparkles or glow.

## Icons

Use only `AppIcon` (24px grid, thin 1.6 line, round caps and joins, no fill). No other icon library on these pages. The file now includes: bolt, sliders, grid, cup, hotel, bag, bike (plus all the earlier icons). If a page needs an icon that is missing, draw it in exactly the same style and add it to the registry.

## What to wire up (replace mock data, keep the visuals)

1. Replace `lib/jobsData.ts` mock data with the real jobs repository. Keep the `Job` shape or adapt the screens. Remove the hard-coded counts (`open`, `urgent`, "9 new matches", "Hi Meng") and use real values.
2. Saved jobs (`useSavedJobs`) must persist through the repository layer.
3. Job cards, the Top match card and the Quick apply button must open the existing flows. Mark each with a TODO if you cannot wire it.
4. Filter buttons (the sliders icon in each header) open the app's existing filter sheet, or leave a TODO.
5. Near you: `JobsMap` is a stylised stand-in. If the project already uses react-native-maps or Mapbox, replace its inside with the real map and keep the same props and the same visuals: the user dot is saffron with a soft halo, the radius ring is dashed teal at 10% fill, and the price pins are white pills. Get the user location and sort by real distance. Compute walk/ride times from real distance.
6. Currency, pay and time formats must follow the app's existing formatting helpers.

## Palette migration for existing screens

The profile files were already moved to this palette. Search the rest of the app for the old greens (for example #16803C, #0F9D62, #DFF7E9, #0E3B2E, #F7F8F6) and tell me what you find. Do not change anything outside the profile and jobs pages without asking.

## Done when

- All four routes open and scroll with no layout overflow on small (iPhone SE size) and large devices.
- The status bar is light on the three header pages and dark on Near you.
- `tsc` passes, there are no unused imports, and there are no console warnings.
- Give me the list of files changed and anything you could not wire.
