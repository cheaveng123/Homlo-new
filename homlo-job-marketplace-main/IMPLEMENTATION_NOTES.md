# Homlo Jobs v2: React Native pages (Expo, mobile only)

Screens: Popular, Category detail, Part-time, Full-time (daylight), Weekends, Remote, and the 7-step Post a job flow.
All files type-check clean with `tsc --strict` against RN 0.79 + Reanimated 4 + react-native-svg 15.

## Files (copy to `components/jobs-v2/`)
theme.ts, AppIcon.tsx, ui.tsx, categories.ts, PopularScreen.tsx, CategoryScreen.tsx, PartTimeScreen.tsx,
FullTimeScreen.tsx, WeekendsScreen.tsx, RemoteScreen.tsx, PostJobFlow.tsx, mock.ts (demo data only)

## Dependencies (all but the last two are already in your app)
react-native-reanimated 4.x + react-native-worklets, react-native-svg, expo-linear-gradient, expo-status-bar,
react-native-safe-area-context, @expo-google-fonts/plus-jakarta-sans, @expo-google-fonts/inter.
No new gesture library: the salary slider uses core PanResponder; sheets use core Animated.

## Fonts
Loaded names expected: PlusJakartaSans_800ExtraBold, PlusJakartaSans_700Bold, Inter_400Regular, Inter_500Medium,
Inter_600SemiBold, Inter_700Bold. If you use familyForWeight() or a Khmer family, change the `font` object in theme.ts only.
Font scale is capped at 130% (maxFontSizeMultiplier) in `Txt`. Check Khmer line heights (lineHeight is set in `ts` styles).

## Wiring (presentation only, no logic changed)
Every screen is a presentational component. Pass your existing data and handlers; no hook, API, route or analytics is touched.
Example route file:
```tsx
import { useRouter } from 'expo-router';
import FullTimeScreen from '@/components/jobs-v2/FullTimeScreen';
export default function Route() {
  const router = useRouter();
  const { jobs, subtitle } = useYourExistingFullTimeHook();      // your hook, unchanged
  return <FullTimeScreen jobs={jobs.map(toFullTimeVM)} subtitle={subtitle}
    onBack={() => router.back()} onJobPress={(id) => router.push(`/job/${id}`)} />;
}
```
Map your job model to the small view-model types exported by each screen (PopularJob, CategoryJob, PartTimeJob, FullTimeJob, WeekendJob, RemoteJob).
Strings are English defaults in each file (`strings` prop or `S` object): connect them to your translation keys.
The tab bar is yours: screens only add bottom padding.

## Post a job flow
`<PostJobFlow onSaveDraft onDiscard onPublish />`
- X, Back on step 1 and Android back open the Save as draft / Discard / Keep editing sheet. Save draft is also beside Next on every step.
- Remote jobs skip the location step automatically.
- Photo: pass `onPickPhoto` (your existing picker, resolve a uri). Map: pass `renderMap` (your existing map picker). Without them, a static placeholder shows.
- `validate(step, draft)` replaces the default gating with your existing validation.
- Salary bounds and default ranges per period are in BOUNDS (top of file); match them to your real limits.
- The auto-close toggle on step 7 follows your existing feature; wire it through `draft.autoClose`.

## Category identity
categories.ts maps 19 PLACEHOLDER names to an accent family + icon. Key it by your real category ids and map icons to your AppIcon names.
Layout is shared; identity is color + icon only (flat hero, no patterns).

## Motion (all stop with Reduce Motion)
Popular chip glow + flame flicker, Part-time courier, Full-time sun and clouds, Weekends rotating sun rays, Remote circuit pulses,
scroll reveal on cards (`Reveal`) and header lift/fade (`Parallax`) via a shared scroll value from `ScreenScroll`.

## Things to check on device
Android shadows (elevation), dashed borders (photo tile), font scale 130%, Khmer, small and large phones,
and `measure` based reveal on Android (needs `collapsable={false}`, already set).
