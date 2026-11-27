import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import LinearGradient from '@/lib/native/linear-gradient';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { TextNew } from '../TextNew';
import { useCountUpNew } from '../../theme/motionNew';
import { kf } from '@/src/components/icons/loop';
import { PlusGlyph } from '@/src/components/icons/DashIcons';
import { dash, easeInOut, easeOut, HEADER_H } from './dashTokens';

import { smooth } from '@/src/design/motion';
const ACircle = Animated.createAnimatedComponent(Circle);

type Stat = { label: string; value: number };
type Props = {
  topInset: number;
  scrollY: SharedValue<number>;
  live: number;
  liveRatio: number;
  liveLabel: string;
  rows: Stat[];
  loading?: boolean;
  addLabel: string;
  onAddJob: () => void;
};

/* ───────── background effects ───────── */

function Orb({ size, color, opacity, style, dx, dy, ds, duration }: {
  size: number; color: string; opacity: number; style: object; dx: number; dy: number; ds: number; duration: number;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration, easing: easeInOut }), -1, true);
  }, [reduced, duration, t]);
  const a = useAnimatedStyle(() => ({
    transform: [{ translateX: dx * t.value }, { translateY: dy * t.value }, { scale: 1 + ds * t.value }],
  }));
  const id = `orb${color.replace('#', '')}`;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style, a]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.45} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

function Rings() {
  const reduced = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    r.value = withRepeat(withTiming(360, { duration: 70000, easing: Easing.linear }), -1, false);
  }, [reduced, r]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[s.rings, a]}>
      <Svg width={260} height={260} viewBox="0 0 260 260" fill="none">
        <Circle cx={130} cy={130} r={50} stroke="#fff" strokeWidth={1} />
        <Circle cx={130} cy={130} r={80} stroke="#fff" strokeWidth={1} strokeDasharray="2 8" />
        <Circle cx={130} cy={130} r={110} stroke="#fff" strokeWidth={1} />
        <Circle cx={130} cy={130} r={128} stroke="#fff" strokeWidth={1} strokeDasharray="1 6" />
      </Svg>
    </Animated.View>
  );
}

/** Periodic wave (period = w) drawn across 2w, so translating by -w loops seamlessly. */
function wavePath(w: number, h: number, base: number, amp: number, phase: number) {
  const steps = 48;
  let d = `M0 ${h} L0 ${base + amp * Math.sin(phase)}`;
  for (let i = 1; i <= steps; i += 1) {
    const x = (2 * w * i) / steps;
    d += ` L${x.toFixed(1)} ${(base + amp * Math.sin((2 * Math.PI * x) / w + phase)).toFixed(1)}`;
  }
  return `${d} L${2 * w} ${h} Z`;
}

function Wave({ width, opacity, duration, reverse, base, amp, phase }: {
  width: number; opacity: number; duration: number; reverse?: boolean; base: number; amp: number; phase: number;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
  }, [reduced, duration, t]);
  const a = useAnimatedStyle(() => ({
    transform: [{ translateX: reverse ? -width + width * t.value : -width * t.value }],
  }));
  const d = useMemo(() => wavePath(width, 70, base, amp, phase), [width, base, amp, phase]);
  return (
    <Animated.View pointerEvents="none" style={[s.wave, { width: width * 2 }, a]}>
      <Svg width={width * 2} height={70}>
        <Path d={d} fill="#fff" fillOpacity={opacity} />
      </Svg>
    </Animated.View>
  );
}

/* ───────── summary ───────── */

const RING_R = 35;
const RING_C = 2 * Math.PI * RING_R;

function LiveRing({ value, ratio, label, loading }: { value: number; ratio: number; label: string; loading?: boolean }) {
  const reduced = useReducedMotion();
  const target = RING_C * (1 - Math.min(Math.max(ratio, 0), 1));
  const off = useSharedValue(reduced ? target : RING_C);
  useEffect(() => {
    if (loading) return;
    off.value = reduced ? target : withDelay(150, withTiming(target, { duration: 1200, easing: easeOut }));
  }, [target, reduced, loading, off]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: off.value }));
  const n = useCountUpNew(loading ? 0 : value, 900);
  return (
    <View style={s.ringWrap}>
      {/* soft white glow behind the ring */}
      <Svg width={112} height={112} style={s.ringGlow} pointerEvents="none">
        <Defs>
          <RadialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0.55" stopColor="#fff" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={56} cy={56} r={56} fill="url(#ringGlow)" />
      </Svg>
      <Svg width={84} height={84} viewBox="0 0 78 78">
        <Circle cx={39} cy={39} r={RING_R} stroke="rgba(255,255,255,0.24)" strokeWidth={7} fill="none" />
        <ACircle
          animatedProps={arc}
          cx={39}
          cy={39}
          r={RING_R}
          stroke="#fff"
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${RING_C} ${RING_C}`}
          transform="rotate(-90 39 39)"
        />
      </Svg>
      <View style={s.ringCenter} pointerEvents="none">
        <TextNew variant="hero" heading weight="bold" color="#fff" style={s.ringNum}>{loading ? '–' : n}</TextNew>
        <TextNew variant="caption" color="#fff" style={s.ringLabel}>{label}</TextNew>
      </View>
    </View>
  );
}

function StatRow({ label, value, index, last, loading }: Stat & { index: number; last: boolean; loading?: boolean }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(250 + index * 100, withTiming(1, { duration: 550, easing: easeOut }));
  }, [reduced, index, t]);
  const a = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateX: 14 * (1 - t.value) }] }));
  const n = useCountUpNew(loading ? 0 : value, 900);
  return (
    <Animated.View style={[s.row, !last && s.rowLine, a]}>
      <TextNew variant="body" color="rgba(255,255,255,0.88)" numberOfLines={1} style={s.rowLabel}>{label}</TextNew>
      <TextNew variant="header" heading weight="bold" color="#fff" style={s.rowNum}>{loading ? '–' : n}</TextNew>
    </Animated.View>
  );
}

/* ───────── add button ───────── */

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const press = useSharedValue(0);
  const sheen = useSharedValue(0);
  useEffect(() => {
    if (reduced || !w) return;
    // one 1.1s sweep, then rest: a 6s cycle starting at 1.5s
    sheen.value = withDelay(1500, withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false));
  }, [reduced, w, sheen]);
  const btn = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.025 * press.value }] }));
  const plus = useAnimatedStyle(() => ({ transform: [{ rotate: `${90 * press.value}deg` }] }));
  const sh = useAnimatedStyle(() => ({
    opacity: sheen.value > 0 && sheen.value < 0.19 ? 1 : 0,
    transform: [{ translateX: kf(sheen.value, [[0, -80], [0.18, w + 20], [1, w + 20]]) }, { skewX: '-18deg' }],
  }));
  const spring = { damping: 14, stiffness: 180 };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => { press.set(reduced ? 1 : smooth(1)); }}
      onPressOut={() => { press.set(reduced ? 0 : smooth(0)); }}
    >
      <Animated.View style={[s.addBtn, btn]} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        <View style={s.addClip} pointerEvents="none">
          <Animated.View style={[s.sheen, sh]} />
        </View>
        <Animated.View style={plus}><PlusGlyph size={16} color={dash.cyanDeep} strokeWidth={2.6} /></Animated.View>
        <TextNew variant="title" heading weight="bold" color={dash.cyanDeep} style={s.addText}>{label}</TextNew>
      </Animated.View>
    </Pressable>
  );
}

/* ───────── hero ───────── */

export function DashHeroNew(p: Props) {
  const { width } = useWindowDimensions();
  const effects = useAnimatedStyle(() => ({ transform: [{ translateY: p.scrollY.value * 0.45 }] }));
  const summary = useAnimatedStyle(() => {
    const y = Math.max(p.scrollY.value, 0);
    return { opacity: Math.max(0, 1 - y / 190), transform: [{ translateY: y * 0.28 }] };
  });
  return (
    <View style={[s.hero, { paddingTop: HEADER_H + p.topInset }]}>
      <LinearGradient
        colors={['#0B7F9B', dash.cyan, '#0A86A4']}
        locations={[0, 0.6, 1]}
        start={{ x: 0.37, y: 0 }}
        end={{ x: 0.63, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="heroGlow" cx="92%" cy="0%" rx="70%" ry="60%">
            <Stop offset="0" stopColor="#2DBAD4" stopOpacity={0.9} />
            <Stop offset="1" stopColor="#2DBAD4" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#heroGlow)" />
      </Svg>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, effects]}>
        <Orb size={190} color="#6FE0F2" opacity={0.5} style={{ right: -50, top: -40 }} dx={-40} dy={34} ds={0.15} duration={13000} />
        <Orb size={150} color={dash.amber} opacity={0.2} style={{ left: -60, bottom: 16 }} dx={50} dy={-26} ds={0.2} duration={16000} />
        <Rings />
        <Wave width={width} opacity={0.1} duration={20000} base={30} amp={9} phase={0} />
        <Wave width={width} opacity={0.07} duration={30000} reverse base={36} amp={7} phase={1.7} />
      </Animated.View>

      <Animated.View style={[s.summary, summary]}>
        <LiveRing value={p.live} ratio={p.liveRatio} label={p.liveLabel} loading={p.loading} />
        <View style={s.rows}>
          {p.rows.map((r, i) => (
            <StatRow key={r.label} {...r} index={i} last={i === p.rows.length - 1} loading={p.loading} />
          ))}
        </View>
      </Animated.View>

      <View style={s.addWrap}>
        <AddButton label={p.addLabel} onPress={p.onAddJob} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { paddingBottom: 50, paddingHorizontal: 16, overflow: 'hidden' },
  rings: { position: 'absolute', right: -70, top: -70, width: 260, height: 260, opacity: 0.16 },
  wave: { position: 'absolute', left: 0, bottom: 0, height: 70 },
  summary: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 18 },
  ringWrap: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  ringGlow: { position: 'absolute', left: -14, top: -14 },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringNum: { fontSize: 25, lineHeight: 29 },
  ringLabel: { fontSize: 11, lineHeight: 14 },
  rows: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.22)' },
  rowLabel: { flexShrink: 1, fontSize: 14, lineHeight: 19 },
  rowNum: { fontSize: 18, lineHeight: 23, marginLeft: 8 },
  addWrap: { marginTop: 20 },
  addBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#06425A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  addClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, overflow: 'hidden' },
  sheen: { position: 'absolute', top: -10, bottom: -10, width: 60, backgroundColor: 'rgba(8,145,178,0.18)' },
  addText: { fontSize: 16, lineHeight: 21 },
});
