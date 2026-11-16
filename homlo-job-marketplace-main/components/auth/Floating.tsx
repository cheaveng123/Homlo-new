/**
 * components/auth/Floating.tsx
 *
 * A single, deliberately-subtle motion wrapper for the auth screen's
 * illustrations. React Native `Animated` with the native driver — no Reanimated
 * and no CSS-style keyframes, so nothing here depends on the RN Web shim.
 *
 * Modes:
 *   float  – drifts vertically and rotates a degree or two (default)
 *   bounce – a soft double-tap with a long rest; used for the map pin
 *   sway   – rotation-dominant, near-zero travel; used for the two characters
 *   shine  – opacity flicker only; used for the sparkles
 *
 * Amplitudes are intentionally tiny (3–9px, ≤2°) so the composition reads as
 * alive rather than busy behind the sign-in form.
 *
 * The wrapper is always `pointerEvents="none"` — it is decoration, and must
 * never intercept a touch aimed at a field or button.
 *
 * `reduceMotion` is a prop rather than an internal subscription so the owning
 * screen owns the single `AccessibilityInfo` listener and passes the flag down.
 */
import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, Platform, StyleSheet, type ViewStyle } from 'react-native';

export type FloatingMode = 'float' | 'bounce' | 'sway' | 'shine';

type Props = {
  children: React.ReactNode;
  /** Absolute placement for the wrapper — `left`/`top`, or `left`/`bottom`. */
  style?: ViewStyle;
  mode?: FloatingMode;
  /** Vertical travel in px. Ignored in `shine` mode. */
  amp?: number;
  /** Duration of one full cycle in ms. */
  duration?: number;
  /** Stagger so the pieces don't move in lockstep. */
  delay?: number;
  /** Resting rotation in degrees. */
  rotate?: number;
  /** When true the child renders completely static. */
  reduceMotion?: boolean;
};

export default function Floating({
  children,
  style,
  mode = 'float',
  amp = 6,
  duration = 6000,
  delay = 0,
  rotate = 0,
  reduceMotion,
}: Props) {
  const v = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (reduceMotion) return;
    const t = (toValue: number, ms: number, easing = Easing.inOut(Easing.ease)) =>
      Animated.timing(v, { toValue, duration: ms, easing, useNativeDriver: true });
    const cycle =
      mode === 'bounce'
        ? Animated.sequence([
            t(1, 300, Easing.out(Easing.quad)),
            t(0, 300, Easing.in(Easing.quad)),
            t(0.35, 150),
            t(0, 150),
            Animated.delay(1800),
          ])
        : mode === 'shine'
          ? Animated.sequence([Animated.delay(duration * 0.6), t(1, duration * 0.1), t(0, duration * 0.3)])
          : Animated.sequence([t(1, duration / 2), t(0, duration / 2)]);
    const loop = Animated.loop(cycle);
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [mode, duration, delay, reduceMotion, v]);

  const translateY = mode === 'shine' ? 0 : v.interpolate({ inputRange: [0, 1], outputRange: [0, -amp] });
  const deg = mode === 'sway' ? 1.2 : mode === 'float' ? 2 : 0;
  const rot = v.interpolate({ inputRange: [0, 1], outputRange: [`${rotate}deg`, `${rotate + deg}deg`] });
  const opacity = mode === 'shine' ? v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) : 1;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.abs, style, { opacity, transform: [{ translateY }, { rotate: rot }] }]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  abs: {
    position: 'absolute',
    ...Platform.select({
      ios: { shadowColor: '#0F4637', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } },
      default: {},
    }),
  },
});
