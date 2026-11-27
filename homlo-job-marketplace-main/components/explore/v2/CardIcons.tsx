/**
 * Animated detail icons for Explore job cards. Each is a tiny metaphor with one short
 * story, played on a shared 6s card clock so a card's details light up in turn
 * (company → place → time → schedule → setting), then rest. Cards are offset so the
 * list never pulses in unison. Reduce Motion shows the final static state.
 *
 * Built as stacked SVG layers in Animated.Views (transform/opacity only), so they stay
 * cheap and render the same on iOS and Android.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { EX } from './tokens';

const LOOP = 6000;

/** One clock per card. 0.5 = static end state (Reduce Motion). */
export function useCardClock(offsetMs = 0) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 0.5 : 0);
  useEffect(() => {
    cancelAnimation(p);
    if (reduce) { p.value = 0.5; return; }
    p.value = 0;
    p.value = withDelay(offsetMs, withRepeat(withTiming(1, { duration: LOOP, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(p);
  }, [offsetMs, reduce, p]);
  return { p, reduce: !!reduce };
}

type Clock = { p: SharedValue<number>; reduce: boolean };

/** Keyframes on the clock, clamped. */
const kf = (p: SharedValue<number>, f: number[][]) => {
  'worklet';
  return interpolate(p.value, f.map((x) => x[0]), f.map((x) => x[1]), Extrapolation.CLAMP);
};

const Layer = ({ size, style, children }: { size: number; style?: object; children: React.ReactNode }) => (
  <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, style]}>{children}</Animated.View>
);

/* ───────── company: an office whose windows light up one after another ───────── */

export function CompanyIcon({ clock, size = 15 }: { clock: Clock; size?: number }) {
  const { p, reduce } = clock;
  const w1 = useAnimatedStyle(() => ({ opacity: reduce ? 1 : kf(p, [[0, 0.15], [0.04, 0.15], [0.09, 1], [0.6, 1], [0.7, 0.15], [1, 0.15]]) }));
  const w2 = useAnimatedStyle(() => ({ opacity: reduce ? 0.15 : kf(p, [[0, 0.15], [0.08, 0.15], [0.13, 1], [0.62, 1], [0.72, 0.15], [1, 0.15]]) }));
  const w3 = useAnimatedStyle(() => ({ opacity: reduce ? 1 : kf(p, [[0, 0.15], [0.12, 0.15], [0.17, 1], [0.64, 1], [0.74, 0.15], [1, 0.15]]) }));
  const k = size / 24;
  const win = (x: number, y: number, a: object) => (
    <Animated.View style={[{ position: 'absolute', left: x * k, top: y * k, width: 3 * k, height: 3 * k, borderRadius: 0.8 * k, backgroundColor: EX.amber }, a]} />
  );
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M4.5 20.5V5A1.5 1.5 0 0 1 6 3.5h8A1.5 1.5 0 0 1 15.5 5v15.5M15.5 10h3a1.5 1.5 0 0 1 1.5 1.5v9M3 20.5h18" stroke={EX.slate} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
        <Rect x={8} y={7} width={3} height={3} rx={0.8} fill={EX.slate} opacity={0.25} />
        <Rect x={8} y={12} width={3} height={3} rx={0.8} fill={EX.slate} opacity={0.25} />
        <Rect x={8} y={17} width={3} height={3.5} rx={0.8} fill={EX.slate} opacity={0.25} />
      </Svg>
      {win(8, 7, w1)}
      {win(8, 12, w2)}
      {win(16.2, 13, w3)}
    </View>
  );
}

/* ───────── place: the pin drops onto its spot and a ripple spreads ───────── */

export function PlaceIcon({ clock, known, size = 15 }: { clock: Clock; known: boolean; size?: number }) {
  const { p, reduce } = clock;
  const k = size / 24;
  const pin = useAnimatedStyle(() => (reduce ? {} : {
    transform: [{ translateY: kf(p, [[0, 0], [0.14, 0], [0.18, -4 * k], [0.24, 0], [0.27, -1 * k], [0.3, 0], [1, 0]]) }],
  }));
  const ripple = useAnimatedStyle(() => (reduce ? { opacity: 0 } : {
    opacity: kf(p, [[0, 0], [0.23, 0], [0.25, 0.9], [0.42, 0], [1, 0]]),
    transform: [{ scaleX: kf(p, [[0, 0.4], [0.23, 0.4], [0.42, 1.6], [1, 1.6]]) }],
  }));
  return (
    <View style={{ width: size, height: size }}>
      <Layer size={size} style={ripple}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Ellipse cx={12} cy={21.5} rx={4} ry={1.3} fill="none" stroke={EX.cyan} strokeWidth={1.4} />
        </Svg>
      </Layer>
      <Layer size={size} style={pin}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          {known ? (
            <>
              <Path d="M12 2.5a6.5 6.5 0 0 1 6.5 6.5c0 4.6-5.2 9.3-6.1 10.1a.6.6 0 0 1-.8 0C10.7 18.3 5.5 13.6 5.5 9A6.5 6.5 0 0 1 12 2.5Z" fill="#E4F3F7" stroke={EX.slate} strokeWidth={1.9} />
              <Circle cx={12} cy={9} r={2.4} fill={EX.cyanDeep} />
            </>
          ) : (
            <>
              <Path d="M12 2.5a6.5 6.5 0 0 1 6.5 6.5c0 4.6-5.2 9.3-6.1 10.1a.6.6 0 0 1-.8 0C10.7 18.3 5.5 13.6 5.5 9A6.5 6.5 0 0 1 12 2.5Z" stroke="#8FA3AA" strokeWidth={1.9} strokeDasharray="2.6 2.2" />
              <Path d="M10.3 8.3a1.8 1.8 0 1 1 2.6 1.6c-.5.3-.9.6-.9 1.3M12 13.2v.1" stroke={EX.slate} strokeWidth={1.8} strokeLinecap="round" />
            </>
          )}
        </Svg>
      </Layer>
    </View>
  );
}

/* ───────── posted: the clock's minute hand sweeps once around ───────── */

export function PostedIcon({ clock, size = 14 }: { clock: Clock; size?: number }) {
  const { p, reduce } = clock;
  const hand = useAnimatedStyle(() => ({
    transform: [{ rotate: `${reduce ? 0 : kf(p, [[0, 0], [0.28, 0], [0.42, 360], [1, 360]])}deg` }],
  }));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={StyleSheet.absoluteFill}>
        <Circle cx={12} cy={12} r={8.5} stroke={EX.slate} strokeWidth={1.9} />
        <Path d="M12 12l3.2 2" stroke={EX.slate} strokeWidth={1.9} strokeLinecap="round" />
        <Circle cx={12} cy={12} r={1.3} fill={EX.slate} />
      </Svg>
      <Layer size={size} style={hand}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 12V6.5" stroke={EX.amberDeep} strokeWidth={1.9} strokeLinecap="round" />
        </Svg>
      </Layer>
    </View>
  );
}

/* ───────── schedule: full-time = full sun (rays turn); part-time = half sun rising ───────── */

export function ScheduleIcon({ clock, fullTime, size = 14 }: { clock: Clock; fullTime: boolean; size?: number }) {
  const { p, reduce } = clock;
  const k = size / 24;
  const rays = useAnimatedStyle(() => ({ transform: [{ rotate: `${reduce ? 0 : kf(p, [[0, 0], [0.4, 0], [0.58, 90], [1, 90]])}deg` }] }));
  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: reduce ? 0 : kf(p, [[0, 0], [0.4, 0], [0.42, 7 * k], [0.56, 0], [1, 0]]) }] }));
  if (fullTime) {
    return (
      <View style={{ width: size, height: size }}>
        <Layer size={size} style={rays}>
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" stroke={EX.amberDeep} strokeWidth={1.9} strokeLinecap="round" />
          </Svg>
        </Layer>
        <Svg width={size} height={size} viewBox="0 0 24 24" style={StyleSheet.absoluteFill}>
          <Circle cx={12} cy={12} r={4.6} fill={EX.amber} />
        </Svg>
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', left: 0, top: 0, width: size, height: 15.5 * k, overflow: 'hidden' }}>
        <Layer size={size} style={rise}>
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M6.5 15.5a5.5 5.5 0 0 1 11 0Z" fill={EX.amber} />
            <Path d="M12 6v1.8M6.2 9.2l1.3 1.2M17.8 9.2l-1.3 1.2" stroke={EX.amberDeep} strokeWidth={1.9} strokeLinecap="round" />
          </Svg>
        </Layer>
      </View>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={StyleSheet.absoluteFill}>
        <Path d="M3 15.5h18M7 19.5h10" stroke={EX.navy} strokeWidth={1.9} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/* ───────── setting: on-site = person walks to the door; remote = laptop with signal; hybrid = both ───────── */

export function SettingIcon({ clock, arrangement, size = 14 }: { clock: Clock; arrangement: string; size?: number }) {
  const { p, reduce } = clock;
  const k = size / 24;
  const walk = useAnimatedStyle(() => (reduce ? {} : {
    opacity: kf(p, [[0, 0], [0.52, 0], [0.56, 1], [0.8, 1], [0.86, 0], [1, 0]]),
    transform: [{ translateX: kf(p, [[0, -6 * k], [0.52, -6 * k], [0.66, 0], [1, 0]]) }],
  }));
  const arc1 = useAnimatedStyle(() => ({ opacity: reduce ? 1 : kf(p, [[0, 0.2], [0.52, 0.2], [0.57, 1], [0.8, 1], [0.86, 0.2], [1, 0.2]]) }));
  const arc2 = useAnimatedStyle(() => ({ opacity: reduce ? 1 : kf(p, [[0, 0.2], [0.58, 0.2], [0.63, 1], [0.8, 1], [0.86, 0.2], [1, 0.2]]) }));
  const a = arrangement.toLowerCase();

  if (a === 'remote') {
    return (
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={StyleSheet.absoluteFill}>
          <Rect x={5} y={11} width={14} height={8} rx={1.5} stroke={EX.navy} strokeWidth={1.9} />
          <Path d="M3 21h18" stroke={EX.navy} strokeWidth={1.9} strokeLinecap="round" />
        </Svg>
        <Layer size={size} style={arc1}>
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M9.6 7.6a3.4 3.4 0 0 1 4.8 0" stroke={EX.cyan} strokeWidth={1.9} strokeLinecap="round" /></Svg>
        </Layer>
        <Layer size={size} style={arc2}>
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M7.3 5.2a6.6 6.6 0 0 1 9.4 0" stroke={EX.cyan} strokeWidth={1.9} strokeLinecap="round" /></Svg>
        </Layer>
      </View>
    );
  }
  // On-site (and Hybrid: the same site with a small laptop badge)
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={StyleSheet.absoluteFill}>
        <Path d="M7 20.5V9l7-5 7 5v11.5M12.5 20.5v-5h3v5M5 20.5h17" stroke={EX.navy} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
        {a === 'hybrid' && <Rect x={1.5} y={14} width={5} height={3.6} rx={0.8} fill={EX.cyan} />}
      </Svg>
      <Layer size={size} style={walk}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={4.6} cy={12.2} r={1.7} fill={EX.amberDeep} />
          <Path d="M2.6 20.5c0-2.6.9-4.6 2-4.6s2 2 2 4.6Z" fill={EX.amberDeep} />
        </Svg>
      </Layer>
    </View>
  );
}

/* ───────── promoted: sound waves leave the megaphone ───────── */

export function PromotedIcon({ clock, size = 15 }: { clock: Clock; size?: number }) {
  const { p, reduce } = clock;
  const w1 = useAnimatedStyle(() => (reduce ? {} : {
    opacity: kf(p, [[0, 0], [0.02, 1], [0.12, 0], [0.16, 1], [0.26, 0], [1, 0]]),
    transform: [{ translateX: kf(p, [[0, 0], [0.12, 2], [0.14, 0], [0.26, 2], [1, 2]]) }],
  }));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={StyleSheet.absoluteFill}>
        <Path d="M2 6.2h3l5-3v9.6l-5-3H2Z" fill="#FDF0D9" stroke={EX.amberText} strokeWidth={1.5} strokeLinejoin="round" />
        <Path d="M4 9.8l.8 3.2h1.7l-.7-3.2" fill={EX.amberText} />
      </Svg>
      <Layer size={size} style={w1}>
        <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <Path d="M12 5.5a3 3 0 0 1 0 5" stroke={EX.amberText} strokeWidth={1.5} strokeLinecap="round" />
          <Path d="M13.8 4a5.2 5.2 0 0 1 0 8" stroke={EX.amberText} strokeWidth={1.3} strokeLinecap="round" opacity={0.6} />
        </Svg>
      </Layer>
    </View>
  );
}

/* ───────── seats: taken seats fill; open seats breathe softly in turn ───────── */

export function SeatIcon({ clock, taken, index, size = 14 }: { clock: Clock; taken: boolean; index: number; size?: number }) {
  const { p, reduce } = clock;
  const start = 0.7 + index * 0.04;
  const a = useAnimatedStyle(() => (reduce || taken ? {} : {
    opacity: kf(p, [[0, 1], [start, 1], [start + 0.04, 0.45], [start + 0.1, 1], [1, 1]]),
    transform: [{ scale: kf(p, [[0, 1], [start, 1], [start + 0.04, 0.86], [start + 0.1, 1], [1, 1]]) }],
  }));
  return (
    <Animated.View style={a}>
      <Svg width={size} height={size} viewBox="0 0 16 16">
        <Path d="M8 1.7a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 0 1 0-5.8ZM2.4 14.2c0-3 2.3-5 5.6-5s5.6 2 5.6 5Z"
          fill={taken ? EX.navy : 'none'} stroke={taken ? EX.navy : '#9BB6BF'} strokeWidth={taken ? 0 : 1.3} />
      </Svg>
    </Animated.View>
  );
}
