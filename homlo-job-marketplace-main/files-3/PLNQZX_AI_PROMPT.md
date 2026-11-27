# Task: restyle the "Account plans" screen of Homlo Jobs (React Native, Expo, expo-router, Reanimated, mobile only)

## Where this screen is
Account plans is opened from the **Profile page** (the plan / upgrade entry in the profile). Find the existing screen by searching the Profile page for the link or route to it, then open that route's file. Edit only that screen and the flow it already has (choose a plan, confirm, processing, success, failure). Do not touch any other screen.

## The one rule: presentation only
I am giving you ready-made presentational files. Wire them to the EXISTING screen. Change only fonts, colors, layout, icons and motion.

Never change: business logic, hooks, state, API calls, payments, data models, permissions, analytics, feature flags, translation keys or text, validation, existing buttons, states (loading, empty, error) or actions. No feature may be removed or hidden. If the design needs a feature to change, keep the feature, adapt the design, and tell me in the report.

Do not leave sample data. Keep the existing data hooks and map their results into the view props.

## The new files (deliberately odd names so they never clash with existing files)
Copy this folder into the app, for example `components/plnQzx/` (follow the app's own structure, but keep every file name exactly as written):

| File | What it is |
|---|---|
| `plnQzx_tokens.ts` | Colors, spacing, radii, type scale, fonts, shadow (`QZ`, `qzShadow`) |
| `plnQzx_types.ts` | `PlnQzxPlan` and `PlnQzxCopy` types |
| `plnQzx_bits.tsx` | Press feedback, text, line icons, count-up, CTA with light sweep, dock, spinner, result badge |
| `plnQzx_glyphs.tsx` | Animated custom icons for "active jobs" and "job posts / month" |
| `plnQzx_PlansView.tsx` | `PlnQzxPlansView`, the plan list screen |
| `plnQzx_FlowViews.tsx` | `PlnQzxConfirmView`, `PlnQzxProcessingView`, `PlnQzxSuccessView`, `PlnQzxFailureView` |

All exports use the prefixes `PlnQzx`, `Qz` or `QZ`. If any name still clashes, rename the new one, never the existing one.

## How to wire it
1. In the existing Account plans screen, KEEP all hooks, state, handlers and navigation. Replace only the JSX that renders the UI.
2. Map existing data to `PlnQzxPlan[]` (id, name, tagline, numeric price, activeJobs, postsPerMonth, popular flag, features with included true/false). Do not hard-code the number of plans or any price. Use whatever the existing data returns. Pass the existing price formatter as `formatPrice`.
3. Build the `PlnQzxCopy` object from the app's EXISTING translation calls (`t('...')`). Do not add, rename or edit translation keys or text. Where a string already contains the plan name or price, use a function that calls the existing key with the same interpolation.
4. Show the right view for the existing flow state:
   - choosing a plan -> `PlnQzxPlansView` (its primary button calls the existing upgrade/change handler)
   - confirming -> `PlnQzxConfirmView` (existing payment methods go in `methods`; the existing pay handler goes in `onPay`)
   - payment running -> `PlnQzxProcessingView` (`stepIndex` 0, 1 or 2 from the existing progress state, or advance it from the existing status)
   - paid -> `PlnQzxSuccessView`
   - failed -> `PlnQzxFailureView` (retry and keep-current-plan use the existing handlers)
5. Keep every existing loading, empty and error state. Restyle them with the same tokens, but do not remove them.
6. Keep every existing button and action. If the old screen had an action the new views do not show, add it back into the new layout using the same tokens.
7. Routes: do not invent paths. Take them from the existing app. If you need to centralise any route strings for this screen, put them in one file of your own with an odd name, for example `plnQzx_routes.ts`.

## Design language (already in the files, do not drift)
- Palette "Lagoon & Sunrise": primary teal #0E7C86, deep teal #073B42, tint #D8F0EE, page #F4F8F8, border #E4ECEC, text #14272B, muted #58696B, sun #F5B52B (small highlights only), clay #C4531F (price), cream #FFF1D2 (ticket), danger #C0392B on #FBEAE6. Remove the old greens, purples and pinks from this screen, including hard-coded hex values.
- Light only. No dark page background.
- Plus Jakarta Sans for headings, Inter for UI, and the matching Khmer font at matching weights. Map the real font names in `plnQzx_tokens.ts` (`QZ.font`) to the fonts already loaded in the app. Check Khmer line heights. Support 130% font scale with no clipping.
- Scale 12, 13, 14, 16, 17, 20, 24. Spacing 4, 8, 12, 16, 24, 32. Side margin 16. Radii 14, 16, 20, 24, 28, 999.
- Primary buttons are teal pills, 48 high. Press feedback scale 0.975. Touch targets at least 44. Contrast at least 4.5:1. Selected state is a teal ring plus a small check.
- The plan card is a cream ticket with a dashed tear line and a clay price.
- Only two icons are animated: active jobs and job posts / month (custom, bold, looping). All other icons are static. There are NO icons on the confirm page.
- Only one CTA on this screen uses the diagonal light sweep: the plans primary button.
- Respect Reduce Motion everywhere (`useReducedMotion`), including every looping animation.

## Dependencies
Uses `react-native-reanimated`, `react-native-svg`, `expo-linear-gradient` and `react-native-safe-area-context`. Check they are already installed and install only what is missing with the project's package manager (`npx expo install ...`). If the app has its own `AppIcon` that already contains back, check and info glyphs, you may use it in place of `QzIcon`, but keep the two animated glyphs as they are. If the plan count can exceed 4, make the switcher in `PlnQzxPlansView` scroll horizontally.

## Verify
- `git diff` shows presentation changes only. If logic, API, payment or translations changed, undo and explain.
- Run tsc, lint and the existing tests.
- Test on a small and a large phone, iOS and Android shadows, font scale 130%, Reduce Motion on, Khmer, and the loading, empty, error, success and failure states.
- Report: files changed, how each existing feature was kept, anything that could not match, and any design choice that might affect a feature.
