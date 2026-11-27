import { useEffect, useState } from "react";

/** Shows a short structural loading state while local or remote listings initialize. */
export function useListingLoading(duration = 0) {
  const [isLoading, setIsLoading] = useState(duration > 0);

  // Adjust during render when the duration flips to <= 0 so the state can
  // never be left hanging without waiting for an effect pass.
  const [prevDuration, setPrevDuration] = useState(duration);
  if (duration !== prevDuration) {
    setPrevDuration(duration);
    if (duration <= 0) setIsLoading(false);
  }

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => setIsLoading(false), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  return isLoading;
}
