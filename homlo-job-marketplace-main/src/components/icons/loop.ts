import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** Static end state shown under Reduce Motion or while the screen is not focused. */
export const LOOP_REST = 0.5;

/**
 * Shared 5s icon cadence: progress p runs 0 -> 1 (enter 0-30%, hold to ~80%,
 * fade 80-92%, reset). `replayKey` restarts the loop from 0; `active` pauses it.
 */
export function useLoop(delay = 0, replayKey = 0, active = true) {
  const reduce = useReducedMotion();
  const p = useSharedValue(LOOP_REST);
  useEffect(() => {
    cancelAnimation(p);
    if (reduce || !active) {
      p.value = LOOP_REST;
      return;
    }
    p.value = 0;
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey, reduce, active]);
  return p;
}

/** Keyframe lookup: f is a list of [progress, value] pairs. */
export const kf = (p: number, f: number[][]) => {
  'worklet';
  return interpolate(
    p,
    f.map((a) => a[0]),
    f.map((a) => a[1]),
    Extrapolation.CLAMP,
  );
};

/** Scale around (x, y) inside an SVG viewBox. */
export const around = (s: number, x: number, y: number) => {
  'worklet';
  return [{ translateX: x }, { translateY: y }, { scale: s }, { translateX: -x }, { translateY: -y }];
};

export const FADE = [[0, 0], [0.06, 0], [0.24, 1], [0.8, 1], [0.92, 0], [1, 0]];
// Badges settle in smoothly (no overshoot).
export const POP = [[0, 0.6], [0.24, 0.6], [0.4, 1], [1, 1]];
