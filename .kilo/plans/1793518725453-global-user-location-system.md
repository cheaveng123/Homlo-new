# Plan: Global User Current Location System Across All Homlo Maps

**Plan file:** `.kilo/plans/1793518725453-global-user-location-system.md`
**Mode:** Plan only — no source changes in this turn.

---

## 1. Investigation Summary

### Map library
- Native (iOS/Android): `react-native-maps` v1.27.2
- Web: `maplibre-gl` v6.5.0
- Location: `expo-location` v57.0.21 (already installed)
- Expo SDK ~57, React Native 0.86.3

### Every map implementation discovered (native = react-native-maps)

| # | File | Library | Has user location? | Has recenter? | Notes |
|---|------|---------|-------------------|---------------|-------|
| 1 | `components/real-location-map.native.tsx` | react-native-maps | Yes (yellow pin) | Yes (`showsMyLocationButton`) | Radius circle + onSelect |
| 2 | `components/job-location-map.native.tsx` | react-native-maps | Yes (yellow pin) | Yes (`showsMyLocationButton`) | Job pin + onChange |
| 3 | `components/search/search-results-map.native.tsx` | react-native-maps | Yes (yellow pin) | Yes (`showsMyLocationButton`) | Markers + radius circle |
| 4 | `components/job-details/job-distance-map.native.tsx` | react-native-maps | Via `userCoordinate` prop | No | Shows user + job + line |
| 5 | `components/guided-location-map.native.tsx` | react-native-maps | No | No | City picker (Phnom Penh etc.) |
| 6 | `components/onboarding-location-map.native.tsx` | react-native-maps (Google) | No | No | Onboarding area selection |
| 7 | `components/search/polygon-draw-map.native.tsx` | react-native-maps | No | No | Polygon drawing |
| 8 | `app/jobs-map.tsx` | react-native-maps (inline) | Yes (inline expo-location) | Yes (custom button) | Jobs map screen |
| 9 | `components/JobLocationPicker.tsx` | react-native-maps | No | No | Location picker for job posts |

### Base/web fallbacks (return empty `<View />` or maplibre stubs)
- `components/real-location-map.tsx`, `.web.tsx`
- `components/job-location-map.tsx`, `.web.tsx`
- `components/guided-location-map.tsx`, `.web.tsx`
- `components/onboarding-location-map.tsx` (web iframe)
- `components/search/search-results-map.tsx`, `.web.tsx`
- `components/job-details/job-distance-map.tsx`, `.web.tsx`
- `components/search/polygon-draw-map.tsx`, `.web.tsx`

> Per prior context: web map versions are left unchanged. Focus is on native maps.

### Screens that use maps
- `app/jobs-map.tsx` — Jobs map screen (own inline location logic)
- `app/job/[id]/location.tsx` — Job location screen (uses `JobLocationMap`)
- `app/job/[id].tsx` — Job detail screen: inline map + full-screen Modal (uses `JobLocationMap`)
- `app/employer/job/[id]/edit/location.tsx` — Job edit location picker (uses `JobLocationPicker`)
- `app/onboarding/index.tsx` — Onboarding step 2 (uses `OnboardingLocationMap`)

### Existing location utilities
- `lib/use-user-location.ts` — `useUserLocation()` hook: requests foreground permission once, returns `{ location, error }`. **No recenter, no permission status, no watch, no re-request flow.**
- `hooks/use-search-location.ts` — `useSearchLocation()`: similar, plus reverse geocoding label. Used by home/Explore feed.
- `lib/job-geography.ts` — `defaultSearchCenter` (Phnom Penh), `jobCoordinate()`, `haversineDistance()`.

### Permission configuration (current state)
- **`ios/HomloJobs/Info.plist`:** Has `NSLocationWhenInUseUsageDescription` (GOOD). ALSO has `NSLocationAlwaysAndWhenInUseUsageDescription` and `NSLocationAlwaysUsageDescription` (**BAD** — background location, must be removed per task).
- **`app.config.ts`:** Android `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` (GOOD). expo-location plugin with when-in-use description (GOOD).
- No `android/` directory (Expo managed workflow, generated at build time).

---

## 2. Decisions

| Decision | Rationale |
|----------|-----------|
| Improve existing `lib/use-user-location.ts` rather than create new Context | Hook already imported by 4 map components; minimizes churn; follows existing convention |
| Centralize permission logic in a new `lib/location-service.ts` singleton | Avoids duplicate permission requests across maps; single source of truth for `expo-location` calls |
| Keep `showsMyLocationButton` (built-in recenter) on native maps | Already used by 3 maps; consistent with react-native-maps design; no custom UI needed |
| Add user-location marker in blue tone (`#007AFF`-ish), distinct from yellow job pins | Task requires blue/blue-toned user-location indicator; existing yellow (`#F5B52B`) is used for job/user pins — will change user pin to blue |
| Remove background location keys from Info.plist | Task explicitly: do not request background location |
| Onboarding: add location permission explanation before requesting OS permission | Task: never request OS permission without explaining why; "Enable Location / Maybe Later" actions |
| Web maps: left unchanged | Per prior context directive (mobile-first, native-only) |

---

## 3. Files to Create

| File | Purpose |
|------|---------|
| `lib/location-service.ts` | Centralized location service: `checkPermission()`, `requestPermission()`, `getCurrentPosition()`, `watchPosition()`, `hasServicesEnabled()`, `openSettings()` |

---

## 4. Files to Modify

| File | Change |
|------|--------|
| `lib/use-user-location.ts` | Rewrite on top of `location-service`: add `permissionStatus`, `requestPermission`, `recenter` callback, `watchPosition` while mounted, error states, cleanup |
| `components/real-location-map.native.tsx` | Switch user pin to blue; ensure recenter via built-in button; center on user when location available |
| `components/job-location-map.native.tsx` | Switch user pin to blue; ensure recenter via built-in button; center on user when location available |
| `components/search/search-results-map.native.tsx` | Switch user pin to blue; ensure recenter via built-in button; center on user when location available |
| `components/job-details/job-distance-map.native.tsx` | Keep prop-driven `userCoordinate` (caller supplies from hook); no change needed to map itself, but document |
| `components/guided-location-map.native.tsx` | Add user-location layer + recenter; center on user when available, fall back to city view |
| `components/onboarding-location-map.native.tsx` | Add user-location indicator (optional; onboarding is about choosing area) |
| `components/search/polygon-draw-map.native.tsx` | Add optional user-location layer (non-intrusive) |
| `app/jobs-map.tsx` | Migrate inline `expo-location` logic to `useUserLocation` hook; use shared recenter |
| `components/JobLocationPicker.tsx` | Add optional user-location layer + "locate me" button |
| `app/job/[id]/location.tsx` | No change needed (uses `JobLocationMap` which gets hook) |
| `app/job/[id].tsx` | No change needed (uses `JobLocationMap`) |
| `app/employer/job/[id]/edit/location.tsx` | No change needed (uses `JobLocationPicker`) |
| `app/onboarding/index.tsx` | Add location permission explanation screen/dialog before map step; "Enable Location / Maybe Later" |
| `ios/HomloJobs/Info.plist` | Remove `NSLocationAlwaysAndWhenInUseUsageDescription` and `NSLocationAlwaysUsageDescription`; keep `NSLocationWhenInUseUsageDescription` |
| `app.config.ts` | Verify no background location; expo-location plugin already configured (no change likely needed) |

---

## 5. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  lib/location-service.ts  (singleton, expo-location)   │
│  - checkPermission()                                    │
│  - requestPermission()                                  │
│  - getCurrentPosition()                                 │
│  - watchPosition(callback)                              │
│  - hasServicesEnabled()                                 │
│  - openSettings()                                       │
└─────────────────────────────────────────────────────────┘
                        ▲
┌───────────────────────┴───────────────────────┐
│  lib/use-user-location.ts  (React hook)        │
│  - location, permissionStatus, error,          │
│    requestPermission, recenter, isLoading      │
└───────────────────────┬───────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   real-location-map  job-location-map  search-results-map
   guided-location-map onboarding-map   polygon-draw-map
   jobs-map            JobLocationPicker (optional)
```

Each map screen calls `useUserLocation()` once. The hook manages a single `watchPosition` subscription and caches the last known location. Maps read from the hook — no duplicate permission requests.

---

## 6. Permission Flow

1. **App install, first map open:** Map hook checks permission. If `undetermined`, show in-app explanation ("Find opportunities around you...") with "Enable Location / Maybe Later". On "Enable Location", call `requestForegroundPermissionsAsync()`.
2. **"Maybe Later" or denied:** Map works without user location. No repeated OS dialogs.
3. **Permission denied previously:** Show explanation directing user to device settings; offer "Open Settings" button.
4. **Location services disabled:** Explain via `hasServicesEnabledAsync()` check.
5. **Approximate location:** Accept `Accuracy.Balanced` or `Reduced`; don't pretend precision.
6. **App returns from background:** Re-check permission via `getForegroundPermissionsAsync()` on app state change.

---

## 7. Potential Conflicts & Risks

| Risk | Mitigation |
|------|------------|
| `useUserLocation()` already imported by 4 components; changing its return shape could break callers | Keep `location` and `error` keys; add new keys additively (`permissionStatus`, `requestPermission`, `recenter`) |
| `jobs-map.tsx` has its own inline `expo-location` logic that duplicates the hook | Migrate to the shared hook; remove inline logic |
| Info.plist has background location keys that may trigger App Store rejection | Remove `NSLocationAlways*` keys |
| `guided-location-map` and `onboarding-location-map` don't currently use `useUserLocation` | Add hook usage; these are lower-priority maps |
| Web maps use maplibre-gl and don't support expo-location | Leave web maps unchanged (native-only per directive) |
| `JobDistanceMap` receives `userCoordinate` from parent; parent must supply from hook | Document that caller provides `userCoordinate` |
| `showsMyLocationButton` built-in button may conflict with custom UI | It's already used by 3 maps; keep consistent |

---

## 8. Validation Steps

1. `pnpm check` (tsc --noEmit) — TypeScript passes
2. `pnpm lint` (expo lint) — lint passes
3. `pnpm build` (esbuild server) — server build passes (not affected by mobile changes but verify no breakage)
4. Verify every native map component imports and uses `useUserLocation`
5. Verify Info.plist has no `NSLocationAlways*` keys
6. Verify onboarding has permission explanation before OS request
7. Manual test scenarios (iOS simulator / Android emulator):
   - Fresh install, no permission → map shows without user location, explanation appears
   - Grant permission → user location marker appears, map centers on user
   - Deny → map works, no repeated dialogs
   - Approximate → works with available coords
   - Location services off → explanation shown
   - Recenter button → animates to user location
   - Navigate between maps → location persists, no duplicate requests
   - Return from background → permission re-checked

---

## 9. Out of Scope

- Web map versions (maplibre-gl) — left unchanged per directive
- Backend location sending — task says do not send location to Supabase unless needed
- Background location tracking — explicitly not requested
- Boost indicators / employer profile work from prior context — separate task

---

## Next Step

Switch to an implementation-capable agent to execute this plan. The plan is implementation-ready: all files, changes, architecture, and validation steps are defined.