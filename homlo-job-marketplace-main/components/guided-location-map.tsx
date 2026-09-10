import { View } from "react-native";

export type GuidedLocationMapProps = {
  coordinate: { latitude: number; longitude: number } | null;
  radiusKm: number;
  onSelect: (value: { latitude: number; longitude: number }) => void;
};

/**
 * Metro resolves the `.native` and `.web` implementations at runtime.
 * This platform-neutral fallback keeps static type checking deterministic.
 */
export function GuidedLocationMap(_: GuidedLocationMapProps) {
  return <View />;
}
