/**
 * Device location, with the small expo-location-style API the app uses
 * (permissions, current/last-known position, watching, reverse geocoding).
 * Backed by @react-native-community/geolocation + react-native-permissions;
 * reverse geocoding goes through the app's OpenStreetMap (Nominatim) client.
 */
import Geolocation, { type GeolocationResponse } from "@react-native-community/geolocation";
import { Platform } from "react-native";
import { PERMISSIONS, RESULTS, check, request, type Permission, type PermissionStatus } from "react-native-permissions";

import { reverseOpenStreetMapPlace } from "@/lib/openstreetmap-geocoding";

export enum Accuracy {
  Lowest = 1,
  Low = 2,
  Balanced = 3,
  High = 4,
  Highest = 5,
  BestForNavigation = 6,
}

export type LocationObject = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    altitude: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
};

export type LocationOptions = {
  accuracy?: Accuracy;
  distanceInterval?: number;
  timeInterval?: number;
};

export type LocationLastKnownOptions = { maxAge?: number };

export type LocationSubscription = { remove: () => void };

export type PermissionResponse = {
  status: "granted" | "denied" | "undetermined";
  granted: boolean;
  canAskAgain: boolean;
};

export type LocationGeocodedAddress = {
  name: string | null;
  district: string | null;
  subregion: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postalCode: string | null;
};

// No Geolocation.setRNConfiguration() here: src/hooks/useUserLocation.ts owns
// that global setting. The read functions below check permission first, so
// they never trigger the system prompt themselves.

const FOREGROUND: Permission | null =
  Platform.OS === "ios"
    ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
    : Platform.OS === "android"
      ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
      : null;

function toResponse(status: PermissionStatus): PermissionResponse {
  if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
    return { status: "granted", granted: true, canAskAgain: true };
  }
  if (status === RESULTS.DENIED) return { status: "undetermined", granted: false, canAskAgain: true };
  // BLOCKED: the user said "don't ask again" (or iOS denied once); UNAVAILABLE: no GPS.
  return { status: "denied", granted: false, canAskAgain: false };
}

export async function getForegroundPermissionsAsync(): Promise<PermissionResponse> {
  if (!FOREGROUND) return { status: "undetermined", granted: false, canAskAgain: true };
  return toResponse(await check(FOREGROUND));
}

export async function requestForegroundPermissionsAsync(): Promise<PermissionResponse> {
  if (!FOREGROUND) return { status: "undetermined", granted: false, canAskAgain: true };
  return toResponse(await request(FOREGROUND));
}

/** True unless the device reports location as unavailable (e.g. GPS switched off). */
export async function hasServicesEnabledAsync(): Promise<boolean> {
  if (!FOREGROUND) return false;
  return (await check(FOREGROUND)) !== RESULTS.UNAVAILABLE;
}

function toObject(p: GeolocationResponse): LocationObject {
  return {
    coords: {
      latitude: p.coords.latitude,
      longitude: p.coords.longitude,
      accuracy: p.coords.accuracy ?? null,
      altitude: p.coords.altitude ?? null,
      heading: p.coords.heading ?? null,
      speed: p.coords.speed ?? null,
    },
    timestamp: p.timestamp,
  };
}

const highAccuracy = (a?: Accuracy) => (a ?? Accuracy.Balanced) >= Accuracy.High;

/** Like expo-location: reading the position never shows the permission prompt. */
async function hasPermission(): Promise<boolean> {
  return (await getForegroundPermissionsAsync()).granted;
}

export async function getCurrentPositionAsync(options?: LocationOptions): Promise<LocationObject> {
  if (!(await hasPermission())) throw new Error("Location permission not granted");
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (p) => resolve(toObject(p)),
      (e) => reject(new Error(e.message)),
      { enableHighAccuracy: highAccuracy(options?.accuracy), timeout: 15_000, maximumAge: 10_000 },
    );
  });
}

/** A cached fix no older than `maxAge` (default 5 min), or null. Never waits for the GPS. */
export async function getLastKnownPositionAsync(options?: LocationLastKnownOptions): Promise<LocationObject | null> {
  if (!(await hasPermission())) return null;
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (p) => resolve(toObject(p)),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 1_500, maximumAge: options?.maxAge ?? 5 * 60_000 },
    );
  });
}

export async function watchPositionAsync(
  options: LocationOptions,
  callback: (location: LocationObject) => void,
): Promise<LocationSubscription> {
  if (!(await hasPermission())) throw new Error("Location permission not granted");
  const id = Geolocation.watchPosition(
    (p) => callback(toObject(p)),
    () => {},
    {
      enableHighAccuracy: highAccuracy(options.accuracy),
      distanceFilter: options.distanceInterval ?? 0,
      interval: options.timeInterval,
    },
  );
  return { remove: () => Geolocation.clearWatch(id) };
}

export async function reverseGeocodeAsync(coordinate: {
  latitude: number;
  longitude: number;
}): Promise<LocationGeocodedAddress[]> {
  try {
    const place = await reverseOpenStreetMapPlace(coordinate);
    return [
      {
        name: place.label || null,
        district: place.district || null,
        subregion: null,
        city: place.city || null,
        region: place.province || null,
        country: place.country || null,
        postalCode: place.postalCode || null,
      },
    ];
  } catch {
    return [];
  }
}
