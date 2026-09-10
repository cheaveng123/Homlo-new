import { View } from "react-native";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";

export type PolygonDrawMapProps = {
  center?: MapCoordinate;
  polygon: MapCoordinate[];
  onAddPoint: (point: MapCoordinate) => void;
  onRemoveLastPoint: () => void;
  onClear: () => void;
};

export function PolygonDrawMap(_props: PolygonDrawMapProps) {
  return <View />;
}
