import { StyleSheet, View, Text } from "react-native";

import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";

type Marker = { id: string; coordinate: MapCoordinate; label: string; selected?: boolean };

export type SearchResultsMapProps = {
  center: MapCoordinate;
  zoom: number;
  radiusKm: number;
  markers: Marker[];
  selectedId?: string | null;
  onSelectMarker?: (id: string) => void;
  onMapClick?: (coordinate: MapCoordinate) => void;
};

export function SearchResultsMap({ markers }: SearchResultsMapProps) {
  return (
    <View style={styles.container}>
      <View style={styles.gridOverlay} pointerEvents="none" />
      <View style={styles.callout} pointerEvents="none">
        <View style={styles.calloutDot} />
        <Text style={styles.calloutLabel}>{markers.length} listings on the map</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#DCE5E2",
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  gridOverlay: {
    backgroundColor: "#E8EFEC",
    bottom: 0,
    left: 0,
    opacity: 0.55,
    position: "absolute",
    right: 0,
    top: 0,
  },
  callout: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#C7D3CC",
    borderRadius: 14,
    borderWidth: 1,
    bottom: 16,
    flexDirection: "row",
    gap: 8,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: "absolute",
    shadowColor: "#173C25",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  calloutDot: {
    backgroundColor: "#0891B2",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  calloutLabel: {
    color: "#17201A",
    fontSize: 11.5,
    fontWeight: "700",
  },
});