# Real Map Integration Notes

MapLibre React Native is the selected interactive map solution because it supports native Android and iOS mapping with an Expo configuration plugin and can render OpenStreetMap-compatible vector-tile styles. Its official Expo setup notes that it requires a development or production native build rather than Expo Go, plus the `@maplibre/maplibre-react-native` plugin in app configuration.[1]

MapLibre's Map component supports style URLs, touch pan and zoom controls, press handling, and a child Camera for programmatic viewpoint control. These APIs can support a true selectable area and map-centered current-location fallback without manually positioned city visuals.[3]

The guided location flow should request foreground location permission only after the user invokes current-location selection. If permission is unavailable or denied, the map defaults to Phnom Penh. Expo Location provides foreground permission and single-position retrieval on Android, iOS, and web.[2]

## References

[1] [MapLibre React Native — Expo Setup](https://maplibre.org/maplibre-react-native/docs/setup/expo/)

[2] [Expo Location — SDK 54 documentation](https://docs.expo.dev/versions/latest/sdk/location/)

[3] [MapLibre React Native — Map component](https://maplibre.org/maplibre-react-native/docs/components/map/)
