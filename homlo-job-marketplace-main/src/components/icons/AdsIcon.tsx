// "Ads" badge icon: a megaphone announcing; its two sound waves ripple outward on a
// calm 2.4s loop. Plays only while the screen is focused; static under Reduce Motion.
import React, { useEffect } from 'react';
import Svg, { G, Path } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { kf } from './loop';

const AG = Animated.createAnimatedComponent(G);

export function AdsIcon({ size = 14, color = '#A8620B', accent = '#F5A524', active = true }: { size?: number; color?: string; accent?: string; active?: boolean }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0.5);
  useEffect(() => {
    cancelAnimation(t);
    if (reduce || !active) { t.value = 0.5; return; }
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [reduce, active, t]);
  // Horn gives a small "shout" kick at the start of each cycle.
  const horn = useAnimatedProps(() => ({
    transform: [{ translateX: 6 }, { translateY: 12 }, { rotate: `${kf(t.value, [[0, 0], [0.06, -8], [0.16, 0], [1, 0]])}deg` }, { translateX: -6 }, { translateY: -12 }],
  }));
  const w1 = useAnimatedProps(() => ({ opacity: kf(t.value, [[0, 0], [0.12, 1], [0.6, 1], [0.8, 0], [1, 0]]), transform: [{ translateX: kf(t.value, [[0, -2], [0.2, 0], [1, 0]]) }] }));
  const w2 = useAnimatedProps(() => ({ opacity: kf(t.value, [[0, 0], [0.24, 0], [0.36, 1], [0.66, 1], [0.86, 0], [1, 0]]), transform: [{ translateX: kf(t.value, [[0, -2], [0.24, -2], [0.4, 0], [1, 0]]) }] }));
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <AG animatedProps={horn}>
        <Path d="M3.5 9.5h3l7-4.5v14l-7-4.5h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" fill={color} />
        <Path d="M6.5 15 8 20.5h2.6L9.6 15.6" fill={color} />
      </AG>
      <AG animatedProps={w1}><Path d="M16.5 9.5a3.5 3.5 0 0 1 0 5" stroke={accent} strokeWidth={2.2} strokeLinecap="round" /></AG>
      <AG animatedProps={w2}><Path d="M19 7a7 7 0 0 1 0 10" stroke={accent} strokeWidth={2.2} strokeLinecap="round" /></AG>
    </Svg>
  );
}
