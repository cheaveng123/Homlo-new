import { View } from "react-native";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";

export type JobLocationMapProps = {
  coordinate: MapCoordinate | null;
  defaultCoordinate: MapCoordinate;
  onChange: (coordinate: MapCoordinate) => void;
};

export function JobLocationMap(_: JobLocationMapProps) { return <View />; }