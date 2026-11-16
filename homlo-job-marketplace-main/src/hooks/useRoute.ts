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
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RoutingFailure | null>(null);
  const [attempt, setAttempt] = useState(0);

  const originKey = coordinateKey(origin);
  const destinationKey = coordinateKey(destination);
  const enabled =
    options.enabled !== false &&
    originKey.length > 0 &&
    destinationKey.length > 0;

  useEffect(() => {
    if (!enabled || !origin || !destination) {
      setRoute(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    void fetchDrivingRoute(origin, destination, {
      signal: controller.signal,
    }).then((result) => {
      if (!active) return;

      if (result.ok) {
        setRoute(result.route);
        setError(null);
      } else {
        setRoute(null);
        setError(result.reason);
      }

      setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt, destinationKey, enabled, originKey]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  return { route, loading, error, retry };
}
