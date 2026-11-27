import { useEffect, useRef, useState } from "react";

import type { Coordinate } from "../types";
import { haversineMeters, isValidCoordinate } from "../utils/geo";

/**
 * Returns only location updates that moved at least `thresholdMeters`.
 *
 * The blue dot can consume every raw GPS update, while routing logic uses this
 * value so a stationary user does not fire a new route request on every jitter.
 */
export function useSignificantMove(
  location: Coordinate | null,
  thresholdMeters = 25,
): Coordinate | null {
  const lastAcceptedRef = useRef<Coordinate | null>(null);
  const [significantLocation, setSignificantLocation] =
    useState<Coordinate | null>(null);

  useEffect(() => {
    if (!location || !isValidCoordinate(location)) return;

    const lastAccepted = lastAcceptedRef.current;
    const movedEnough =
      !lastAccepted ||
      haversineMeters(lastAccepted, location) >= thresholdMeters;

    if (!movedEnough) return;

    lastAcceptedRef.current = location;
    setSignificantLocation(location);
  }, [location, thresholdMeters]);

  return significantLocation;
}
