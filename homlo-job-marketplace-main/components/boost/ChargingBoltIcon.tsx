/**
 * "Charging" lightning bolt for the Boost active indicator.
 *
 * One loop (~4.8s): the bolt fills with amber from the bottom up with a bright spark riding
 * the charge line → when full it glows and throws a few sparkles off the tip → the charge
 * fades → it rests for ~2.4s → repeats. Smooth easing, no bounce.
 * Reduce Motion: a static, fully charged bolt.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

const ARect = Animated.createAnimatedComponent(Rect);

const BOLT = 'M13 2 3 14h7l-1 8 10-12h-7l1-8z';
const TOP = 2;
const SPAN = 20; // bolt spans y 2 → 22 in the 24 viewBox

const LOOP_MS = 4800;
// Phase marks as fractions of the loop.
const CHARGE_END = 1100 / LOOP_MS; // fill reaches the top
const FLASH_END = 1500 / LOOP_MS; // glow + sparkles
const HOLD_END = 2000 / LOOP_MS; // stays charged
const FADE_END = 2400 / LOOP_MS; // charge fades, then rests until the loop ends

/** Ease-in-out (cubic) so the charge builds up, then settles at the top. */
function easeInOut(k: number) {
  'worklet';
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

/** Sparkle thrown from the tip: travels (dx, dy) while it pops in and fades. */
function useSparkle(t: SharedValue<number>, reduced: boolean, dx: number, dy: number, delay: number) {
  return useAnimatedStyle(() => {
    if (reduced) return { opacity: 0 };
    const a = CHARGE_END + delay;
    const p = interpolate(t.value, [a, a + 0.1], [0, 1], Extrapolation.CLAMP);
    const o = interpolate(p, [0, 0.25, 1], [0, 1, 0], Extrapolation.CLAMP);
    return { opacity: o, transform: [{ translateX: dx * p }, { translateY: dy * p }, { scale: 0.4 + 0.6 * Math.sin(Math.PI * p) }] };
  });
}

type Props = { size?: number; color?: string; fill?: string; spark?: string };

export function ChargingBoltIcon({ size = 18, color = '#E8870F', fill = '#F5A524', spark = '#FFF4D6' }: Props) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? CHARGE_END : 0);

  useEffect(() => {
    if (reduced) { t.value = CHARGE_END; return; }
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
  }, [reduced, t]);

  /** 0 → 1 charge level with an eased rise. */
  const level = (v: number) => {
    'worklet';
    return easeInOut(interpolate(v, [0, CHARGE_END], [0, 1], Extrapolation.CLAMP));
  };

  const fillProps = useAnimatedProps(() => {
    const l = reduced ? 1 : level(t.value);
    const h = SPAN * l;
    const o = reduced ? 1 : interpolate(t.value, [HOLD_END, FADE_END], [1, 0], Extrapolation.CLAMP);
    return { y: TOP + SPAN - h, height: h, opacity: o };
  });

  // Bright line riding the top of the charge while it rises.
  const sparkProps = useAnimatedProps(() => {
    const l = reduced ? 0 : level(t.value);
    const visible = reduced ? 0 : interpolate(t.value, [0, 0.02, CHARGE_END - 0.02, CHARGE_END], [0, 1, 1, 0], Extrapolation.CLAMP);
    return { y: TOP + SPAN - SPAN * l - 0.9, opacity: visible };
  });

  // Soft glow behind the bolt at full charge.
  const glow = useAnimatedStyle(() => {
    if (reduced) return { opacity: 0 };
    const g = interpolate(t.value, [CHARGE_END - 0.02, (CHARGE_END + FLASH_END) / 2, FLASH_END + 0.05], [0, 1, 0], Extrapolation.CLAMP);
    return { opacity: g * 0.8, transform: [{ scale: 0.7 + 0.4 * g }] };
  });

  // Small four-point sparkles thrown up and out from the tip.
  const s1 = useSparkle(t, !!reduced, -size * 0.42, -size * 0.38, 0);
  const s2 = useSparkle(t, !!reduced, size * 0.36, -size * 0.46, 0.015);
  const s3 = useSparkle(t, !!reduced, size * 0.5, -size * 0.05, 0.03);

  const id = 'boltClip';
  const sparkSize = Math.max(6, size * 0.38);
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View pointerEvents="none" style={[st.glow, { width: size * 2, height: size * 2, left: -size * 0.5, top: -size * 0.5 }, glow]}>
        <Svg width={size * 2} height={size * 2}>
          <Defs>
            <RadialGradient id="boltGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={fill} stopOpacity={0.9} />
              <Stop offset="0.5" stopColor={fill} stopOpacity={0.35} />
              <Stop offset="1" stopColor={fill} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={size} cy={size} r={size} fill="url(#boltGlow)" />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Defs>
          <ClipPath id={id}><Path d={BOLT} /></ClipPath>
        </Defs>
        <G clipPath={`url(#${id})`}>
          <ARect x={0} width={24} fill={fill} animatedProps={fillProps} />
          <ARect x={0} width={24} height={1.8} fill={spark} animatedProps={sparkProps} />
        </G>
        <Path d={BOLT} stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
      {[s1, s2, s3].map((a, i) => (
        <Animated.View key={i} pointerEvents="none" style={[st.sparkle, { left: size * 0.55 - sparkSize / 2, top: size * 0.05 - sparkSize / 2, width: sparkSize, height: sparkSize }, a]}>
          <Svg width={sparkSize} height={sparkSize} viewBox="0 0 10 10">
            <Path d="M5 0 6.1 3.9 10 5 6.1 6.1 5 10 3.9 6.1 0 5 3.9 3.9Z" fill={i === 1 ? color : fill} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  glow: { position: 'absolute' },
  sparkle: { position: 'absolute' },
});
