# Real Map Integration Notes

Interactive maps use MapLibre GL JS on web and `react-native-maps` with OpenStreetMap raster tiles on native Android and iOS. Rendering OpenStreetMap tiles keeps the app free of mandatory Google or Apple map keys, while `mapType="none"` on native prevents the underlying Google basemap from showing through.

`react-native-maps` provides touch pan and zoom, press handling, markers, and `animateToRegion` for programmatic viewpoint control. These APIs support selectable areas and a documented default browsing center without manually positioned city visuals.[3]

The guided location flow requests foreground location permission only after the user invokes current-location selection. If permission is unavailable or denied, the map shows an explicit "location off" state and may center on a documented default search area for browsing — it never presents that default as the user's GPS position. Expo Location provides foreground permission and single-position retrieval on Android, iOS, and web.[2]

## Current implementation

- Web maps use MapLibre GL JS with an OpenStreetMap-compatible style. Native maps use `react-native-maps` with `mapType="none"` plus OpenStreetMap raster tiles, so no Google Maps key is required.
- Provider endpoints live in `lib/map-config.ts` and are overridable with `EXPO_PUBLIC_MAP_*`, `EXPO_PUBLIC_NOMINATIM_URL` and `EXPO_PUBLIC_OSRM_URL`.
- GPS access is centralised in `lib/location-service.ts` / `useUserLocation`; screens must not call `expo-location` directly.
- Road distance comes from `lib/routing-service.ts` (OSRM). When routing is unavailable the UI labels the haversine value as "Straight-line distance" rather than pretending it is a road distance.
- The `app/jobs-map.tsx` route resolves a platform implementation (`JobsMapExperience.native.tsx` / `.web.tsx`), so the web bundle never imports `react-native-maps`. `JobLocationPicker` and `DrawAreaMap` follow the same pattern.
- Verified with `EXPO_USE_METRO_WORKSPACE_ROOT=1 npx expo export --platform web`: the web bundle succeeds and contains MapLibre GL JS but no `react-native-maps`.

## References

[1] [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)

[2] [Expo Location — SDK 54 documentation](https://docs.expo.dev/versions/latest/sdk/location/)

[3] [react-native-maps — MapView](https://github.com/react-native-maps/react-native-maps/blob/master/docs/mapview.md)
