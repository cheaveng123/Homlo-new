# Homlo Jobs — Profile redesign + icon replacement (React Native / Expo, mobile only)

This is a mobile-only React Native (Expo, expo-router) app. Do not build or test the web target.
Do not touch auth logic, data/repository layers, or any screen not named below.

## Part 1 — Install the redesigned Profile

Install any missing packages with `npx expo install expo-image-picker expo-linear-gradient react-native-svg react-native-safe-area-context`.
(Reanimated 4.5.1 and expo-router are already in the project.)

Place the supplied files (each file's first comment line says its destination):

| Supplied file | Destination |
|---|---|
| 01_profileTheme.ts | lib/profileTheme.ts |
| 02_currencies.ts | lib/currencies.ts |
| 03_AppIcon.tsx | components/ui/AppIcon.tsx |
| 04_ProfileUI.tsx | components/profile/ProfileUI.tsx |
| 05_ProfileScreen.tsx | the existing Profile tab screen (replace its UI, keep its data hooks and sign-out logic) |
| 06_ProfileSection.tsx | app/profile/[section].tsx (new route; make sure it uses the app's normal `slide_from_right` stack animation) |

Rules:
1. Fix import paths to match the project (aliases are fine). Do not change the visual design.
2. Only the main Profile tab shows the banner and avatar. The detail pages under `app/profile/[section]` must never render an avatar or banner. The Edit page contains only fields.
3. Keep the existing bottom tab bar as is. The screen must not draw its own tab bar.
4. If the project already has `familyForWeight()` or its own font constants, use them instead of the `F` strings in 01_profileTheme.ts. Fonts are Plus Jakarta Sans for headings and Inter for body.
5. Replace the mock data (`PROFILE`, the sample applications and devices, the Employer tiles) with the real data through the existing repository layer. Mark anything you cannot wire with a short TODO. Wire the "Employer workspace", "Listings", "Applicants" and "Boosts" rows and the "Go to workspace" button to the existing employer routes. Wire "Log out" to the existing sign-out handler.
6. Banner and avatar pickers use `expo-image-picker` and then upload through the repository layer. Until the upload exists, keep the local URI in state.
7. The "Edit Profile" button has a subtle diagonal light sweep (the `shine` prop). Keep it subtle: no sparkles, no glow, and it must turn off when Reduce Motion is enabled.
8. The currency rates in 02_currencies.ts are estimates for display only. Do not present them as live prices anywhere in the app.

## Part 2 — Replace the app's icons with this icon style

The new icon style is the one in `components/ui/AppIcon.tsx`: a 24×24 grid, thin 1.6 stroke, round line caps and joins, no fill, a single color passed in by prop, and slightly rounded geometric shapes.

Task: replace every icon in the app that is NOT custom-made with an `AppIcon`.

1. Audit first. Search the whole codebase for icon usage from `lucide-react-native`, `@expo/vector-icons` (Feather and others) and `expo-symbols` / SF Symbols. List every distinct icon and where it is used before changing anything.
2. Keep as is (do not replace): anything custom-made, such as the "Homlo" wordmark/logo, the auth-screen illustration SVG artwork, empty-state or onboarding illustrations, and the job-category icon slots that hold the owner's own artwork.
3. Replace everything else (tab bar icons, headers, buttons, chips, list rows, inputs, filter and search icons, and so on) with `<AppIcon name="…" />`.
4. Use this mapping for the existing icons: MapPin → `pin`, Search → `search`, X → `close`, Check → `check`, Chevron Right/Left/Down/Up → `chevron` (rotate with a transform for other directions), Clock → `clock`, Briefcase → `brief`, Heart → `heart`, Bell → `bell`, Home → `home`, User → `user`, Laptop → `laptop`, CalendarDays → `calendar`, Settings/Gear → `gear`, Camera → `cam`, Pencil/Edit → `edit`, Eye → `eye`, Phone → `call`, Plus → `plus`, LogOut → `logout`, Navigation → `nav`.
5. If an icon in use has no equivalent in the set, draw a new one in exactly the same style and add it to `AppIcon.tsx` (add the name to `IconName`, then a new entry in the `ICONS` registry). It must be 24×24, stroke-only with `strokeWidth` 1.6, round caps and joins, `fill="none"`, and visually consistent with the existing ones. Do not use filled icons, and do not mix in other icon libraries. When you finish, list the icons you added.
6. Keep each icon's existing size and color, and keep the active state styling of the tab bar. If an icon was filled to show an active state, show it with the active color and the same stroke style instead. Use size 17–22 as the app convention unless the spot already used something else.
7. Do not change layout, behavior or navigation as part of this.
8. Do not remove `lucide-react-native` or `@expo/vector-icons` from package.json until a search shows zero remaining imports of them. Then tell me, and I will decide about removing them.
9. Remove unused imports, run the TypeScript check, and give me the final list of files changed.
