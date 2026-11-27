import { AppState, type AppStateStatus } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "@/lib/native/location";

import { locationService, type LocationPermissionStatus, type LocationState } from "@/lib/location-service";

export type UserLocation = { latitude: number; longitude: number };

type UseUserLocationOptions = {
  /** Ask for permission on first use when it has never been decided. */
  requestOnMount?: boolean;
};

type UseUserLocationReturn = {
  location: UserLocation | null;
  permissionStatus: LocationPermissionStatus;
  error: string | null;
  isLoading: boolean;
  requestPermission: () => Promise<LocationPermissionStatus>;
  recenter: () => Promise<void>;
};

/** Centralized user-location hook backed by a shared location service. */
export function useUserLocation(options: UseUserLocationOptions = {}): UseUserLocationReturn {
  const { requestOnMount = false } = options;
  // PERF: start from the last fix any screen already got, so newly mounted
  // screens render with a position immediately instead of waiting for GPS.
  const [location, setLocation] = useState<UserLocation | null>(() => {
    const last = locationService.getLastLocation();
    return last ? { latitude: last.latitude, longitude: last.longitude } : null;
  });
const [, setAccuracy] = useState<number | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>("undetermined");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const active = useRef(true);
  const unsubRef = useRef<(() => void) | null>(null);
  const subscribed = useRef(false);
  const appState = useRef(AppState.currentState);

  const setResult = useCallback((state: LocationState) => {
    if (active.current) {
      setLocation({ latitude: state.latitude, longitude: state.longitude }); setAccuracy(state.accuracy ?? null);
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (subscribed.current) {
      unsubRef.current?.();
      unsubRef.current = null;
      subscribed.current = false;
      void locationService.stopWatching();
    }
  }, []);

  const loadLocation = useCallback(async () => {
    const pos = await locationService.getCurrentPosition({ accuracy: Location.Accuracy.Balanced });
    if (pos && active.current) {
      setLocation({ latitude: pos.latitude, longitude: pos.longitude });
    }

    if (subscribed.current) return;
    subscribed.current = true;
    unsubRef.current = locationService.subscribe(setResult);
    try {
      await locationService.startWatching({ accuracy: Location.Accuracy.Balanced, distanceInterval: 10 });
    } catch {
      if (subscribed.current) {
        unsubRef.current?.();
        unsubRef.current = null;
        subscribed.current = false;
      }
    }
  }, [setResult]);

  const checkAndLoad = useCallback(async () => {
    const status = await locationService.checkPermission();
    if (!active.current) return;
    setPermissionStatus(status);
    if (status === "granted") {
      setError(null);
      await loadLocation();
      return;
    }

    // Permission was revoked or never granted: drop any stale fix rather than
    // showing an old position as the user's current location.
    stopTracking();
    if (active.current) setLocation(null);

    if (status === "undetermined" && requestOnMount) {
      const next = await locationService.requestPermission();
      if (!active.current) return;
      setPermissionStatus(next);
      if (next === "granted") {
        setError(null);
        await loadLocation();
      }
    }
  }, [loadLocation, requestOnMount, stopTracking]);

  useEffect(() => {
    active.current = true;
    queueMicrotask(() => {
      if (active.current) void checkAndLoad();
    });

    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        void checkAndLoad();
      }
      appState.current = nextAppState;
    });

    return () => {
      active.current = false;
      stopTracking();
      subscription.remove();
    };
  }, [checkAndLoad, stopTracking]);

  const requestPermission = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const details = await locationService.getPermissionDetails();
      if (details.status === "denied" && !details.canAskAgain) {
        setPermissionStatus("denied");
        setError("Location permission is blocked. Enable it in system settings.");
        return "denied";
      }

      const status = await locationService.requestPermission();
      setPermissionStatus(status);
      if (status === "granted") {
        await loadLocation();
      } else {
        stopTracking();
        setLocation(null);
        setError("Location permission not granted");
      }
      return status;
    } catch {
      setPermissionStatus("denied");
      setError("Unable to request location permission");
      return "denied";
    } finally {
      setIsLoading(false);
    }
  }, [loadLocation, stopTracking]);

  const recenter = useCallback(async () => {
    const status = await locationService.checkPermission();
    if (status !== "granted") {
      const next = await requestPermission();
      if (next !== "granted") return;
    } else {
      setPermissionStatus("granted");
    }

    const pos = await locationService.getCurrentPosition({ accuracy: Location.Accuracy.Balanced });
    if (pos && active.current) {
      setError(null);
      setLocation({ latitude: pos.latitude, longitude: pos.longitude });
    } else if (!pos && active.current) {
      setError("Unable to get current location");
    }
  }, [requestPermission]);

  return { location, permissionStatus, error, isLoading, requestPermission, recenter };
}
