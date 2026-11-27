import { StyleSheet, Text, View } from "react-native";

import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";
import { colors } from "./colors";
import { fonts } from "./typography";

export type JobDistanceMapProps = {
  userCoordinate: MapCoordinate;
  jobCoordinate: MapCoordinate;
  /** Road geometry from the routing service. Falls back to a direct line. */
  routeGeometry?: MapCoordinate[] | null;
};

export function JobDistanceMap(_: JobDistanceMapProps) {
  return (
    <View accessibilityLabel="Distance map unavailable" style={styles.map}>
      <Text style={styles.text}>Map unavailable on this platform</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.mintTint,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
  },
});
