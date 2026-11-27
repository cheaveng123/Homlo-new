import { useCallback, useRef } from "react";

/**
 * Guards a callback so duplicate taps (which fire before navigation removes
 * the pressed screen) can never trigger the action twice. Returns a handler
 * that ignores every call within `ttlMs` of the last accepted one.
 */
export function usePressLock<T extends (...args: never[]) => void>(callback: T, ttlMs = 700): T {
  const lockUntilRef = useRef(0);
  return useCallback(
    (...args: never[]) => {
      const now = Date.now();
      if (now < lockUntilRef.current) return;
      lockUntilRef.current = now + ttlMs;
      callback(...args);
    },
    [callback, ttlMs],
  ) as T;
}