import { NativeModules } from "react-native";

export type MapLibreModule = typeof import("@maplibre/maplibre-react-native");

export const HAS_MAPLIBRE_NATIVE = Boolean(
  NativeModules.MLRNModule && NativeModules.MLRNLocationModule,
);

// Load MapLibre lazily. Its module initialization constructs a NativeEventEmitter
// for the location module, which throws in Expo Go because the native module is
// missing. Requiring it only when the native modules exist keeps Expo Go usable.
export const MapLibre: MapLibreModule | null = HAS_MAPLIBRE_NATIVE
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("@maplibre/maplibre-react-native") as MapLibreModule)
  : null;

// Re-export types from MapLibre for components to use, so they don't need to import directly.
export type { CameraRef } from "@maplibre/maplibre-react-native";
export type { OnPressEvent, ShapeSourceRef } from "@maplibre/maplibre-react-native";
