# Homlo Jobs: apply the "Lagoon & Sunrise" redesign (New files + app-wide palette, fonts, icons, motion)

You are working in my existing React Native app (Expo, expo-router, Reanimated 4.5.1, mobile only: do not build or test web).
I added a folder `src/new/` with redesigned screens and shared parts. EVERY file I added ends in `New` (for example `HomeScreenNew.tsx`, `tokensNew.ts`). Never rename them and never overwrite an existing file that has the same name without `New`. Keep my old screens in the repo until I approve the swap.

## 0. The one rule: features do not change
Only fonts, colors, layout/presentation, icons and motion change. Never change: business logic, hooks, state, API calls, data models, routes and navigation structure, permissions, analytics, feature flags, translations (keys and text), validation, and every feature, button, filter, list and state (loading, empty, error). No new features, screens, or i18n keys. If a design needs a feature to change, keep the feature, adapt the design, and tell me in the report.
If the app already has something the New screens lack (a button, filter, field, state), KEEP it and place it in the new style. If the New screen shows something the app does not have (sample text like "+24%" or "214 jobs"), do not invent data: pass nothing and the element is skipped or hidden by the adapter.

## 1. Do NOT touch (leave as they are)
- The bottom tab bar. I use my current one. Do not build or restyle its layout. It only receives the global palette, fonts and icons from section 4.
- The Explore page (layout and features stay). It only receives the global palette, fonts, icons and motion from section 4.
- The Profile page, the Recommended page (the "See all" destination), the Job Field artwork and the Job Type behavior on Home. Keep the existing artwork: pass it in through the `icon` prop of `jobFields`. Recolor nothing in my illustrations without asking me.

## 2. What is in `src/new/` (install first)
```
npx expo install expo-font expo-linear-gradient expo-blur react-native-svg react-native-reanimated react-native-safe-area-context
npx expo install @expo-google-fonts/plus-jakarta-sans @expo-google-fonts/inter @expo-google-fonts/noto-sans-khmer
```
- `theme/tokensNew.ts` colors, accent families, spacing (4/8/12/16/24/32), radii, soft teal shadows, type scale (12/13/14/16/17/20/24)
- `theme/fontsNew.ts` `useFontsNew()` loads Plus Jakarta Sans 700/800, Inter 400/500/600, Noto Sans Khmer 400/500/600/700
- `theme/motionNew.ts` motion constants, `useEnterNew()` (stagger entrance), `useCountUpNew()`; all respect Reduce Motion
- `theme/copyNew.ts` ONE place for all visible strings (`useCopyNew()`)
- `icons/AppIconNew.tsx` the only icon set (24px grid, 1.6 line, round caps, no fill)
- `components/` TextNew, PrimitivesNew (buttons, chips, fields, tabs, accordion, ticket, skeleton, empty state, floating shapes), JobPartsNew (positions bar, job cards and rows), SearchPillNew, ProgressRingNew
- `screens/` the 10 redesigned screens (below). They are presentational: they take props and callbacks, no data fetching.
- `data/mockNew.ts` sample data to preview each screen alone. Delete when wired.

## 3. Page map (which New screen replaces which existing page)
Tab bar stays mine. Pages in tab order:
| Existing page | New screen | Notes |
|---|---|---|
| Home tab | `HomeScreenNew` | floating search pill, location indicator (no greeting), Job field grid (existing artwork in `icon`), Job type promo cards, Recommended (See all goes to the existing Recommended page), Jobs near you rows |
| Search tab (Explore) | NOT replaced | keep as is |
| Search page (opened from the Home search pill) | `SearchScreenNew` | recent, suggestions, trending. Keep any existing history/suggestion source |
| Search results page | `SearchResultsScreenNew` | filter chips = the app's real filters; states loading/empty/error built in |
| Job detail page | `JobDetailScreenNew` | Description and Requirements only, both open by default and foldable. Location section. Sticky bar: Save, About employer, Apply Now |
| Apply Now flow | `ApplyScreenNew` then `ApplySuccessScreenNew` | CV upload, name, phone, optional message, Submit Application, then the success screen. Use the app's EXISTING apply fields and submit call; add or remove fields to match it exactly |
| Post tab (employer dashboard) | `PostDashboardScreenNew` | stats, Add a New Job, Manage list (Applications, Job Posts, Live Jobs, View Applications), Live/Draft/Review tabs, job cards |
| Add a New Job flow | `AddJobScreenNew` (shell) | the shell only. Map the EXISTING steps and questions into `steps[].content` using FieldNew, ChipNew, CategoryCirclesNew (category = round circles with the app's existing artwork), StepperNew. Do not add or remove questions. The step count comes from the existing flow |
| Alerts tab | `InboxScreenNew` | Notifications and Messages tabs. `upcoming` ticket and `active` row render only if the app has that data |
| A conversation | `ChatScreenNew` | |
| Profile tab | NOT replaced | keep as is |

For each screen: create an adapter in the route file (or a hook beside it) that calls my EXISTING hooks and maps their data into the props. The New screen never calls an API. Keep the same route names. Swap only the component the route renders. Keep the old screen file.

## 4. App-wide changes (also for pages I did not redesign)
1. Fonts: call `useFontsNew()` in the root layout and hold the splash screen until it is true. Replace every font family in the app with the New families: headings Plus Jakarta Sans 700/800, body/UI Inter 400/500/600. For Khmer text always use Noto Sans Khmer at the matching weight (TextNew auto-detects Khmer). Use `TextNew` for text in the New screens. In old screens, make the shared text component/theme use the same families and sizes. Check Khmer line heights. Allow font scale up to 130% with no clipping (`maxFontSizeMultiplier={1.3}`).
2. Palette: replace the theme values with `colorsNew` (exact hex values, no substitutions). Search the whole app for old hard-coded colors (hex, rgb, named colors, shadows) and replace them with tokens. No green, purple or coral-pink anywhere. Primary action color is teal #0E7C86. Sun (#F5B52B) is highlight only. Clay (#C4531F) is for price and urgency only. Use at most two accent families plus Lagoon per screen, and avoid large teal fills: prefer white, tints and deep teal text.
3. Icons: audit every icon (lucide, Feather, vector-icons, SF Symbols) and replace each non-custom icon with `AppIconNew`. If an icon is missing, draw it in the same style (24px grid, 1.6 line, round caps) and add it to `AppIconNew`. Keep my own logo, illustrations and custom artwork. Remove an old icon package from package.json only after a search shows zero imports, and tell me first.
4. Shape: radii 14 chips, 16 tiles/rows, 20 cards, 24 hero, 28 sheets (top corners), 999 pills. Spacing on the 8pt grid, screen side margin 16. Soft teal shadows only (`shadowNew`), never heavy black. Job lists use hairline dividers, not boxed cards.
5. Motion (all of it must turn off with Reduce Motion): press scale 0.975 on buttons/rows/round buttons and 0.985 on cards (`PressableScaleNew`); a staggered fade-up entrance on each screen's sections (`useEnterNew`); the positions bar fills on mount; hearts pop when saved; the Home search placeholder rotates words (keep my existing placeholder animation if I already have one and pass it as `searchPlaceholderSlot`); the dashboard ring fills and its numbers count up; drifting decorative shapes only on the dashboard overview card; the success check draws itself; one slow diagonal light sweep on the main call to action of Home-less screens (Apply Now, Submit Application, Add a New Job). No confetti, sparkles, glow or bouncing. Durations 200 to 450 ms, ease-out.
6. Apply the same motion and press feedback to the existing Explore, Profile and Recommended pages without changing their layouts.
7. Touch targets at least 44px (use hitSlop). Text contrast at least 4.5:1 (text on a tint uses that family's ink or deep teal).

## 5. Strings and i18n
Every visible string in the New screens comes from `copyNew.ts`. Replace each value with the app's EXISTING translation call and keep the existing keys and text. Do not add keys. Pass numbers and labels (for example "3 of 5 left") through the existing formatting helpers.

## 6. Process
1. Phase 0 (no code): write `docs/redesign/FEATURE_CHECKLIST.md` listing every screen, element, action, state, route and hook/API for the pages in section 3, and mark which New prop each one maps to. Ask me ONE message of questions only if something is unclear.
2. Phase 1: install packages, load fonts, switch theme tokens, sweep old colors and icons (section 4).
3. Phase 2: wire `HomeScreenNew` first. Show me screenshots (small and large phone) and wait for approval.
4. Phase 3: wire the rest in order: Search, Results, Job detail, Apply and Success, Post dashboard, Add job, Inbox, Chat. After each group, show screenshots.
5. Phase 4: final sweep for leftover old colors/icons/fonts.

## 7. Verification (required)
- `git diff`: only presentation code and the new adapters changed. If logic, API, navigation or translations changed, undo and explain.
- Tick every item of FEATURE_CHECKLIST.md on a running build (iOS and Android).
- Run tsc, lint and the existing tests.
- Test: iPhone SE size and a large phone, iOS and Android shadows, font scale 130%, Reduce Motion on, Khmer language, and the loading, empty and error states.
- Contrast at least 4.5:1 and touch targets at least 44px.

## 8. Final report
List: files changed, how each feature was kept, anything that could not match the design, any place a design choice might affect a feature, hard-coded old colors or icons left on purpose, and anything in the New screens I should supply data for.
