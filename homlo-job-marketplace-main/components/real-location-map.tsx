import { View } from "react-native";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";

export type RealLocationMapProps = { coordinate: MapCoordinate; radiusKm: number; onSelect: (coordinate: MapCoordinate) => void };

export function RealLocationMap(_: RealLocationMapProps) { return <View />; }
