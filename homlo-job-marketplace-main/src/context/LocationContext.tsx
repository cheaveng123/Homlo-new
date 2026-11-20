import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { type UseUserLocationResult, useUserLocation } from "../hooks/useUserLocation";

export type LocationContextValue = UseUserLocationResult & {
  /** Re-request location permission / kick off a fresh position fetch. */
  retry: () => Promise<void>;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const {
    location,
    accuracy,
    permission,
    permissionDenied,
    error,
    loading,
    requestPermission,
  } = useUserLocation();

  const retry = useCallback(() => requestPermission(), [requestPermission]);

  // PERF: this provider wraps the whole app. A fresh object every render made
  // every useLocation() consumer re-render whenever the root re-rendered.
  const value = useMemo<LocationContextValue>(
    () => ({ location, accuracy, permission, permissionDenied, error, loading, requestPermission, retry }),
    [location, accuracy, permission, permissionDenied, error, loading, requestPermission, retry],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const context = useContext(LocationContext);
  if (context === null) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
}
