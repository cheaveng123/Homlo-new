// vistaEdge.tsx
// The shaped, slowly drifting bottom edge of the hero.
import React, { useEffect, useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { VistaEdgeType } from './vistaCategoryData';

/** 800×28 path made of two identical 400-wide halves so the loop is seamless. */
export function buildVistaEdgePath(type: VistaEdgeType, n: number, seed: number) {
  let r = seed || 1;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const H = Array.from({ length: n }, rnd);
  let d = 'M0 28';
  for (let x = 0; x <= 800; x += 4) {
    const f = ((x % 400) / 400) * n, fr = f % 1, k = Math.floor(f) % n;
    let y: number;
    if (type === 'wave') y = 13 + 8 * Math.sin(f * 6.283) + (seed ? 4 * Math.sin(f * 12.566 + seed) : 0);
    else if (type === 'scal') y = 26 - 20 * Math.abs(Math.sin(f * 3.1416));
    else if (type === 'zig') y = 4 + 20 * Math.abs(fr * 2 - 1);
    else if (type === 'step') y = 24 - (k % 4) * 6;
    else if (type === 'sky') y = 26 - (6 + H[k] * 18);
    else if (type === 'arch') y = 26 - 22 * Math.sqrt(Math.max(0, 1 - (2 * fr - 1) ** 2));
    else if (type === 'cren') y = fr < 0.5 ? 6 : 22;
    else if (type === 'torn') y = 8 + 14 * (H[k] * (1 - fr) + H[(k + 1) % n] * fr);
    else y = 14 + 7 * Math.sin(f * 6.283 + seed) + 4 * Math.sin(f * 18.85 + seed * 2); // hill
    d += `L${x} ${y.toFixed(1)}`;
  }
  return d + 'L800 28Z';
}

type Props = { width: number; type: VistaEdgeType; n: number; seed: number; seconds?: number; fill?: string };

export function VistaEdge({ width, type, n, seed, seconds = 30, fill = '#fff' }: Props) {
  const reduce = useReducedMotion();
  const d = useMemo(() => buildVistaEdgePath(type, n, seed), [type, n, seed]);
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = 0;
    if (reduce) return;
    x.value = withRepeat(withTiming(-width, { duration: seconds * 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(x);
  }, [width, seconds, reduce, d]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, bottom: -1, width: width * 2, height: 28 }, style]}>
      <Svg width={width * 2} height={28} viewBox="0 0 800 28" preserveAspectRatio="none">
        <Path d={d} fill={fill} />
      </Svg>
    </Animated.View>
  );
}
