import { useEffect, useState } from "react";

/** Shows a short structural loading state while local or remote listings initialize. */
export function useListingLoading(duration = 0) {
  const [isLoading, setIsLoading] = useState(duration > 0);

  useEffect(() => {
    if (duration <= 0) {
      setIsLoading(false);
      return;
    }
    const timer = setTimeout(() => setIsLoading(false), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  return isLoading;
}
