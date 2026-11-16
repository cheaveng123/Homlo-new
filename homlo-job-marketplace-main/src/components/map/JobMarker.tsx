import React from "react";
import { Image, StyleSheet } from "react-native";
import { MapLibre } from "../../native-support";
import type { Coordinate } from "../../types";

const SUITCASE = require("./assets/job-suitcase.png");

export type JobMarkerProps = {
  coordinate: Coordinate;
  anchor?: { x: number; y: number };
};

export function JobMarker({ coordinate, anchor = { x: 0.5, y: 1 } }: JobMarkerProps) {
  if (!MapLibre) return null;

  const { PointAnnotation } = MapLibre;

  return (
    <PointAnnotation
      id="job-detail-marker"
      coordinate={[coordinate.longitude, coordinate.latitude]}
      anchor={anchor}
    >
      <Image source={SUITCASE} style={styles.markerImage} />
    </PointAnnotation>
  );
}

const styles = StyleSheet.create({
  markerImage: {
    width: 32,
    height: 32,
  },
});
