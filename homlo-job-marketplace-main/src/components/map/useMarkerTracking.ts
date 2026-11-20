import { useEffect, useState } from "react";

import { pinAnimationWindow } from "./JobMapPin";

/**
 * react-native-maps renders custom markers as bitmap snapshots on Android, so
 * an animated pin only moves while `tracksViewChanges` is on. Keep it on for
 * the length of the pin's animation after each change in `key`, then switch it
 * off so the map isn't re-snapshotting idle markers.
 */
export function useMarkerTracking(key: unknown, index = 0): boolean {
  // Tracking is "on" until the timer for the current key has fired.
  const [settledKey, setSettledKey] = useState<unknown>(undefined);
  useEffect(() => {
    const timer = setTimeout(() => setSettledKey(key), pinAnimationWindow(index));
    return () => clearTimeout(timer);
  }, [key, index]);
  return settledKey !== key;
}
