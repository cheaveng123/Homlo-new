import { useCallback, useEffect, useRef, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import * as ExpoLocation from "expo-location";
import type {
  GeolocationError,
  GeolocationOptions,
  GeolocationResponse,
} from "@react-native-community/geolocation";

import type { Coordinate, PermissionState } from "../types";
import { isValidCoordinate } from "../utils/geo";

type GeolocationApi =
  typeof import("@react-native-community/geolocation").default;

const LOCATION_UNAVAILABLE_MESSAGE =
  "Location is unavailable in Expo Go. Use the Homlo development build for location and maps.";

let Geolocation: GeolocationApi | null = null;

try {
  const loaded = require("@react-native-community/geolocation") as
    (GeolocationApi & { default?: GeolocationApi }) | undefined;

  Geolocation = loaded?.default ?? loaded ?? null;
} catch {
  Geolocation = null;
}

const CURRENT_POSITION_OPTIONS: GeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 2_000,
};

const WATCH_OPTIONS: GeolocationOptions = {
  enableHighAccuracy: true,
  distanceFilter: 5,
  interval: 2_000,
  fastestInterval: 1_000,
  maximumAge: 2_000,
  timeout: 20_000,
};

export type UseUserLocationResult = {
  location: Coordinate | null;
  accuracy: number | null;
  permission: PermissionState;
  permissionDenied: boolean;
  error: string | null;
  loading: boolean;
  requestPermission: () => Promise<void>;
};

function isPermissionDenied(error: GeolocationError): boolean {
  return error.code === 1 || error.code === error.PERMISSION_DENIED;
}

export function useUserLocation(): UseUserLocationResult {
  const geolocationAvailable = Geolocation !== null;
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [permission, setPermission] = useState<PermissionState>(
    geolocationAvailable ? "unknown" : "denied",
  );
  const [error, setError] = useState<string | null>(
    geolocationAvailable ? null : LOCATION_UNAVAILABLE_MESSAGE,
  );
  const [loading, setLoading] = useState(geolocationAvailable);

  const watchIdRef = useRef<number | null>(null);

  const handleSuccess = useCallback((position: GeolocationResponse) => {
    const next: Coordinate = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    if (!isValidCoordinate(next)) return;

    setLocation(next);

    const nextAccuracy = position.coords.accuracy;
    setAccuracy(
      typeof nextAccuracy === "number" &&
        Number.isFinite(nextAccuracy) &&
        nextAccuracy > 0
        ? nextAccuracy
        : null,
    );

    setPermission("granted");
    setError(null);
    setLoading(false);
  }, []);

  const handleError = useCallback((nextError: GeolocationError) => {
    setLoading(false);

    if (isPermissionDenied(nextError)) {
      setPermission("denied");
      setError(
        nextError.message?.trim() ||
          "Location permission was denied. Enable it in system settings to see your position.",
      );
      return;
    }

    // Timeout (code 3) / temporary unavailability (code 2) / other transient
    // errors stay silent: no blocking banner, and watchPosition keeps running
    // so a real fix can still arrive.
  }, []);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    stopWatch();

    if (!Geolocation) return;

    watchIdRef.current = Geolocation.watchPosition(
      handleSuccess,
      handleError,
      WATCH_OPTIONS,
    );
  }, [handleError, handleSuccess, stopWatch]);

  const requestPermission = useCallback(async () => {
    const geolocation = Geolocation;

    if (!geolocation) {
      setPermission("denied");
      setError(LOCATION_UNAVAILABLE_MESSAGE);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPermission("requesting");

    try {
      if (Platform.OS === "android") {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);

        const fine =
          results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const coarse =
          results[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED;

        if (!fine && !coarse) {
          setPermission("denied");
          setError(
            "Location permission was denied. Enable it in system settings to see your position.",
          );
          setLoading(false);
          return;
        }
      } else {
        const authorized = await new Promise<boolean>((resolve) => {
          geolocation.requestAuthorization(
            () => resolve(true),
            (authorizationError) => {
              setError(
                authorizationError?.message?.trim() ||
                  "Location permission was denied.",
              );
              resolve(false);
            },
          );
        });

        if (!authorized) {
          setPermission("denied");
          setLoading(false);
          return;
        }
      }

      setPermission("granted");

      geolocation.getCurrentPosition(
        handleSuccess,
        handleError,
        CURRENT_POSITION_OPTIONS,
      );
      startWatch();
    } catch (requestError) {
      setPermission("denied");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not request location permission.",
      );
      setLoading(false);
    }
  }, [handleError, handleSuccess, startWatch]);

  useEffect(() => {
    const geolocation = Geolocation;
    if (!geolocation) return;

    geolocation.setRNConfiguration({
      skipPermissionRequests: Platform.OS === "android",
      authorizationLevel: "whenInUse",
      locationProvider: "auto",
    });

    // Check the existing permission without prompting. The app must not ask for
    // location on launch; requestPermission() is only called from map controls.
    let cancelled = false;
    void (async () => {
      try {
        const { status } = await ExpoLocation.getForegroundPermissionsAsync();
        if (cancelled) return;

        if (status === "granted") {
          setPermission("granted");
          geolocation.getCurrentPosition(
            handleSuccess,
            handleError,
            CURRENT_POSITION_OPTIONS,
          );
          startWatch();
        } else {
          setPermission(status === "denied" ? "denied" : "unknown");
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      stopWatch();
    };
  }, [handleError, handleSuccess, startWatch, stopWatch]);

  return {
    location,
    accuracy,
    permission,
    permissionDenied: permission === "denied",
    error,
    loading,
    requestPermission,
  };
}
