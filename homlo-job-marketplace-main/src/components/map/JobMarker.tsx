import React from "react";
import { MapLibre } from "../../native-support";
import type { Coordinate } from "../../types";
import { JobMapPin } from "./JobMapPin";

export type JobMarkerProps = {
  coordinate: Coordinate;
  /** Job category / field; picks the pin glyph. */
  category?: string | null;
  anchor?: { x: number; y: number };
};

/** Single job destination pin (job detail map). Live view, so it animates in. */
export function JobMarker({ coordinate, category, anchor = { x: 0.5, y: 1 } }: JobMarkerProps) {
  if (!MapLibre) return null;

  const { MarkerView } = MapLibre;

  return (
    <MarkerView
      coordinate={[coordinate.longitude, coordinate.latitude]}
      anchor={anchor}
      allowOverlap
    >
      <JobMapPin category={category} selected />
    </MarkerView>
  );
}
