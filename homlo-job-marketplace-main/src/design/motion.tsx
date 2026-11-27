import React, { useEffect } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { durations, easings } from './tokens';

/** House motion curve: a decelerating ease (no overshoot, no bounce). */
export const SMOOTH = Easing.bezier(0.2, 0, 0, 1);

/**
 * Smooth replacement for springs: settles on `toValue` in `duration` ms without
 * overshooting. Use it for press feedback, toggles and anything that used withSpring.
 */
export function smooth(toValue: number, duration = 240, callback?: (finished?: boolean) => void) {
  'worklet';
  return withTiming(toValue, { duration, easing: SMOOTH }, callback);
}

/** Entrance: fade + rise 22pt + scale .98, 600ms, 50ms stagger. Items at index >= 8 render static. */
export function Reveal({ children, index = 0, style }: { children: React.ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const animate = !reduce && index < 8;
  const v = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) v.value = withDelay(index * 50, withTiming(1, { duration: durations.enter, easing: easings.out }));
    // once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * 22 }, { scale: 0.98 + 0.02 * v.value }],
  }));
  return <Animated.View style={[st, style]}>{children}</Animated.View>;
}

/** Press feedback for every tappable card/row/button: 0.97 in 120ms, spring out. */
export function PressableScale({ children, scale = 0.97, style, ...rest }: PressableProps & { scale?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => { if (!reduce) s.set(withTiming(scale, { duration: 120 })); rest.onPressIn?.(e); }}
      onPressOut={(e) => { if (!reduce) s.set(smooth(1, 200)); rest.onPressOut?.(e); }}
    >
      <Animated.View style={[st, style]}>{children as React.ReactNode}</Animated.View>
    </Pressable>
  );
}

/** Error feedback: 3-step horizontal shake (±6pt, 220ms). Call `shake()` when validation fails. */
export function useShake() {
  const reduce = useReducedMotion();
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shake = () => {
    if (reduce) return;
    const t = { duration: 37 };
    x.set(withSequence(withTiming(-6, t), withTiming(6, t), withTiming(-6, t), withTiming(6, t), withTiming(-3, t), withTiming(0, t)));
  };
  return { style, shake };
}
