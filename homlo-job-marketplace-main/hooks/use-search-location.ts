import { useEffect, useState } from "react";

import { defaultSearchCenter } from "@/lib/job-geography";
import { reverseOpenStreetMapPlace, type MapCoordinate } from "@/lib/openstreetmap-geocoding";
import { useUserLocation } from "@/lib/use-user-location";
import type { LocationPermissionStatus } from "@/lib/location-service";

type ResolvedLabel = { key: string; label: string };

type UseSearchLocationOptions = {
  /** Ask for permission on mount. Defaults to true for location-first screens. */
  requestOnMount?: boolean;
};

/**
 * The device's search center plus a human label for it. Starts at the default
 * center and upgrades to the foreground position once permission allows, with
 * the locality reverse-geocoded for display.
 *
 * Backed by the shared `useUserLocation`/`locationService` so permission
 * requests and GPS watches are not duplicated per screen.
 */
export function useSearchLocation(options: UseSearchLocationOptions = {}) {
  const { requestOnMount = true } = options;
  const { location, permissionStatus } = useUserLocation({ requestOnMount });
  const [resolvedLabel, setResolvedLabel] = useState<ResolvedLabel | null>(null);

  const latitude = location?.latitude;
  const longitude = location?.longitude;
  const key = latitude != null && longitude != null ? `${latitude},${longitude}` : null;

  useEffect(() => {
    if (latitude == null || longitude == null) return;

    let active = true;
    reverseOpenStreetMapPlace({ latitude, longitude })
      .then((place) => {
        if (active) {
          setResolvedLabel({
            key: `${latitude},${longitude}`,
            label: place.city || place.label || "Current location",
          });
        }
      })
      .catch(() => {
        if (active) {
          setResolvedLabel({ key: `${latitude},${longitude}`, label: "Current location" });
        }
      });

    return () => {
      active = false;
    };
  }, [latitude, longitude]);

  const coordinates: MapCoordinate = location ?? defaultSearchCenter;
  const locationLabel =
    key === null ? "Phnom Penh" : resolvedLabel?.key === key ? resolvedLabel.label : "Current location";

  return {
    coordinates,
    locationLabel,
    permissionStatus: permissionStatus as LocationPermissionStatus,
    usingDeviceLocation: Boolean(location),
  };
}
