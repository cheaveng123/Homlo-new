import { useCallback, useEffect, useState } from "react";

import { fetchDrivingRoute, type RoutingFailure } from "../services/routing";
import type { Coordinate, RouteSummary } from "../types";

export type UseRouteOptions = {
  enabled?: boolean;
};

export type UseRouteResult = {
  route: RouteSummary | null;
  loading: boolean;
  error: RoutingFailure | null;
  retry: () => void;
};

function coordinateKey(coordinate: Coordinate | null): string {
  if (!coordinate) return "";
  return `${coordinate.latitude.toFixed(4)},${coordinate.longitude.toFixed(4)}`;
}

export function useRoute(
  origin: Coordinate | null,
  destination: Coordinate | null,
  options: UseRouteOptions = {},
): UseRouteResult {
  const [attempt, setAttempt] = useState(0);
  // Each finished request is stored with the request it answered; route,
  // loading and error are derived from whether it matches the current request
  // (no state resets inside the effect).
  const [result, setResult] = useState<{
    pairKey: string;
    requestKey: string;
    route: RouteSummary | null;
    error: RoutingFailure | null;
  } | null>(null);

  const originKey = coordinateKey(origin);
  const destinationKey = coordinateKey(destination);
  const enabled =
    options.enabled !== false &&
    originKey.length > 0 &&
    destinationKey.length > 0;
  const pairKey = `${originKey}->${destinationKey}`;
  const requestKey = `${pairKey}#${attempt}`;

  useEffect(() => {
    if (!enabled || !origin || !destination) return;

    const controller = new AbortController();
    let active = true;

    void fetchDrivingRoute(origin, destination, {
      signal: controller.signal,
    }).then((outcome) => {
      if (!active) return;
      setResult({
        pairKey,
        requestKey,
        route: outcome.ok ? outcome.route : null,
        error: outcome.ok ? null : outcome.reason,
      });
    });

    return () => {
      active = false;
      controller.abort();
    };
    // origin/destination are represented by their keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pairKey, requestKey]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  const current = enabled && result?.requestKey === requestKey ? result : null;
  // While a retry reloads the same trip, keep showing the last route.
  const route = enabled && result?.pairKey === pairKey ? result.route : null;
  return {
    route,
    loading: enabled && !current,
    error: current?.error ?? null,
    retry,
  };
}
