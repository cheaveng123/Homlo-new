import * as Location from "expo-location";

export type LocationPermissionStatus = "granted" | "denied" | "undetermined";

export type LocationState = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
};

export type LocationPermissionDetails = {
  status: LocationPermissionStatus;
  canAskAgain: boolean;
};

type LocationListener = (state: LocationState) => void;

function isValidFix(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function toState(loc: Location.LocationObject): LocationState | null {
  const latitude = loc.coords.latitude;
  const longitude = loc.coords.longitude;
  if (!isValidFix(latitude, longitude)) return null;
  return {
    latitude,
    longitude,
    accuracy: loc.coords.accuracy ?? null,
    altitude: loc.coords.altitude ?? null,
    heading: loc.coords.heading ?? null,
    speed: loc.coords.speed ?? null,
    timestamp: loc.timestamp,
  };
}

class LocationService {
  private watchSubscription: Location.LocationSubscription | null = null;
  private watchRefCount = 0;
  private listeners = new Set<LocationListener>();
  private lastLocation: LocationState | null = null;

  async checkPermission(): Promise<LocationPermissionStatus> {
    return (await this.getPermissionDetails()).status;
  }

  async getPermissionDetails(): Promise<LocationPermissionDetails> {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      return {
        status: permission.status as LocationPermissionStatus,
        canAskAgain: permission.canAskAgain ?? true,
      };
    } catch {
      return { status: "undetermined", canAskAgain: true };
    }
  }

  async requestPermission(): Promise<LocationPermissionStatus> {
    return (await this.requestPermissionDetails()).status;
  }

  async requestPermissionDetails(): Promise<LocationPermissionDetails> {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      return {
        status: permission.status as LocationPermissionStatus,
        canAskAgain: permission.canAskAgain ?? true,
      };
    } catch {
      // Some browsers cannot answer the Permissions API but can still resolve
      // a real position (which is what actually triggers the prompt).
      const position = await this.getCurrentPosition();
      return position
        ? { status: "granted", canAskAgain: false }
        : { status: "denied", canAskAgain: false };
    }
  }

  async hasServicesEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch {
      return false;
    }
  }

  async getCurrentPosition(options?: Location.LocationOptions): Promise<LocationState | null> {
    try {
      const pos = await Location.getCurrentPositionAsync(options);
      const state = toState(pos);
      if (!state) return null;
      this.lastLocation = state;
      return state;
    } catch {
      return null;
    }
  }

  async getLastKnownPosition(
    options?: Location.LocationLastKnownOptions,
  ): Promise<LocationState | null> {
    try {
      const pos = await Location.getLastKnownPositionAsync(options);
      if (!pos) return null;
      const state = toState(pos);
      if (!state) return null;
      this.lastLocation = state;
      return state;
    } catch {
      return null;
    }
  }

  /**
   * Prefer a recent cached fix (fast, battery-friendly) and fall back to a live
   * reading. Returns null when no usable fix exists; callers must not invent
   * coordinates.
   */
  async getBestAvailablePosition(maxAgeMs = 5 * 60 * 1000): Promise<LocationState | null> {
    const cached = await this.getLastKnownPosition({ maxAge: maxAgeMs });
    if (cached) return cached;
    return this.getCurrentPosition({ accuracy: Location.Accuracy.Balanced });
  }

  async startWatching(options?: Location.LocationOptions): Promise<void> {
    this.watchRefCount += 1;
    if (this.watchSubscription !== null) return;
    this.watchSubscription = await Location.watchPositionAsync(
      options || { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
      (loc: Location.LocationObject) => {
        const state = toState(loc);
        if (!state) return;
        this.lastLocation = state;
        this.listeners.forEach((cb) => cb(state));
      },
    );
  }

  async stopWatching(): Promise<void> {
    this.watchRefCount = Math.max(0, this.watchRefCount - 1);
    if (this.watchRefCount === 0 && this.watchSubscription !== null) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
  }

  subscribe(listener: LocationListener): () => void {
    this.listeners.add(listener);
    if (this.lastLocation) {
      listener(this.lastLocation);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  getLastLocation(): LocationState | null {
    return this.lastLocation;
  }
}

export const locationService = new LocationService();
