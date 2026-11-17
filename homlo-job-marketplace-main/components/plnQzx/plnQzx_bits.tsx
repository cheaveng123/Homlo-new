import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QZ } from './plnQzx_tokens';

import { smooth } from '@/src/design/motion';
/* ---------- press feedback (scale 0.975) ---------- */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function QzPress(props: {
  children: React.ReactNode; onPress?: () => void; disabled?: boolean;
  style?: StyleProp<ViewStyle>; label?: string; role?: 'button' | 'radio' | 'tab'; selected?: boolean;
}) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole={props.role ?? 'button'}
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled, selected: props.selected, checked: props.role === 'radio' ? props.selected : undefined }}
      disabled={props.disabled}
      onPress={props.onPress}
      onPressIn={() => { s.set(withTiming(0.975, { duration: 90 })); }}
      onPressOut={() => { s.set(withTiming(1, { duration: 120 })); }}
      style={[props.style, a]}
    >
      {props.children}
    </AnimatedPressable>
  );
}

/* ---------- text (scale 12-24, 1.5 line height for Khmer, never clipped at 130%) ---------- */
const V = {
  h1: { f: QZ.font.head, s: QZ.fs.h1, c: QZ.c.deep },
  h2: { f: QZ.font.headMd, s: QZ.fs.h2, c: QZ.c.deep },
  lead: { f: QZ.font.headMd, s: QZ.fs.xl, c: QZ.c.deep },
  strong: { f: QZ.font.uiSb, s: QZ.fs.md, c: QZ.c.text },
  body: { f: QZ.font.ui, s: QZ.fs.md, c: QZ.c.muted },
  small: { f: QZ.font.ui, s: QZ.fs.sm, c: QZ.c.muted },
  tiny: { f: QZ.font.uiMd, s: QZ.fs.xs, c: QZ.c.muted },
  btn: { f: QZ.font.uiSb, s: QZ.fs.lg, c: QZ.c.white },
} as const;
const KHMER_FAMILY = {
  h1: QZ.khmer.head,
  h2: QZ.khmer.headMd,
  lead: QZ.khmer.headMd,
  strong: QZ.khmer.uiSb,
  body: QZ.khmer.ui,
  small: QZ.khmer.ui,
  tiny: QZ.khmer.uiMd,
  btn: QZ.khmer.uiSb,
} as const;
const KHMER = /[\u1780-\u17FF\u19E0-\u19FF]/;
function hasKhmer(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some((c) =>
    (typeof c === 'string' || typeof c === 'number') && KHMER.test(String(c)),
  );
}

export function QzText({ v = 'body', color, style, children, ...rest }: TextProps & { v?: keyof typeof V; color?: string; style?: StyleProp<TextStyle> }) {
  const t = V[v];
  const khmer = hasKhmer(children);
  return (
    <Text
      maxFontSizeMultiplier={1.3}
      {...rest}
      style={[{ fontFamily: khmer ? KHMER_FAMILY[v] : t.f, fontSize: t.s, lineHeight: Math.round(t.s * (khmer ? 1.75 : 1.5)), color: color ?? t.c }, style]}
    >
      {children}
    </Text>
  );
}

/* ---------- thin-line icons (24 grid, 1.6 stroke, round caps). Swap for AppIcon if it has these glyphs. ---------- */
const D: Record<string, string> = {
  back: 'M19 12H5M12 19l-7-7 7-7', check: 'M5 12.5l4.5 4.5L19 7.5', checkRing: 'M8 12.5l3 3 5-6',
  dashRing: 'M8.5 12h7', info: 'M12 8v5M12 16h.01', bolt: 'M13 3L5 13h6l-1 8 8-10h-6z', x: 'M6 6l12 12M18 6L6 18',
};
export function QzIcon({ name, size = 20, color = QZ.c.primary, ring }: { name: keyof typeof D; size?: number; color?: string; ring?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {ring ? <Circle cx={12} cy={12} r={9} /> : null}
      <Path d={D[name]} />
    </Svg>
  );
}

/* ---------- count-up number ---------- */
export function QzCount({ to, format, v = 'h1', color, ms = 700 }: { to: number; format?: (n: number) => string; v?: keyof typeof V; color?: string; ms?: number }) {
  const rm = useReducedMotion();
  const [val, setVal] = useState(to);
  const from = useRef(to);
  useEffect(() => {
    if (rm) { from.current = to; return; }
    let raf = 0; let t0 = 0; const start = from.current;
    const tick = (t: number) => {
      if (!t0) t0 = t;
      const k = Math.min((t - t0) / ms, 1);
      const cur = start + (to - start) * (1 - Math.pow(1 - k, 3));
      setVal(cur); from.current = cur;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, rm, ms]);
  const shown = rm ? to : val;
  return <QzText v={v} color={color}>{format ? format(shown) : String(Math.round(shown))}</QzText>;
}

/* ---------- primary pill CTA (48px, teal) with optional light sweep ---------- */
export function QzCta({ label, onPress, disabled, sweep, tone = 'primary' }: { label: string; onPress?: () => void; disabled?: boolean; sweep?: boolean; tone?: 'primary' | 'quiet' }) {
  const rm = useReducedMotion();
  const x = useSharedValue(-120);
  useEffect(() => {
    if (sweep && !rm && !disabled) {
      x.value = withRepeat(withSequence(withTiming(-120, { duration: 0 }), withDelay(2800, withTiming(460, { duration: 750 }))), -1);
    } else { x.value = -120; }
  }, [sweep, rm, disabled, x]);
  const sw = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { skewX: '-20deg' }] }));
  const quiet = tone === 'quiet';
  return (
    <QzPress onPress={onPress} disabled={disabled} label={label}
      style={[st.cta, { backgroundColor: quiet ? 'transparent' : disabled ? QZ.c.track : QZ.c.primary }]}>
      {sweep && !disabled ? (
        <Animated.View pointerEvents="none" style={[st.sweep, sw]}>
          <LinearGradient colors={['transparent', 'rgba(255,255,255,0.35)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      <QzText v="btn" color={quiet ? QZ.c.deep : disabled ? QZ.c.muted : QZ.c.white}>{label}</QzText>
    </QzPress>
  );
}

/* ---------- sticky bottom dock ---------- */
export function QzDock({ children }: { children: React.ReactNode }) {
  const { bottom } = useSafeAreaInsets();
  return <View style={[st.dock, { paddingBottom: QZ.sp.md + bottom }]}>{children}</View>;
}

/* ---------- spinner ---------- */
export function QzSpinner({ size = 20, w = 2 }: { size?: number; w?: number }) {
  const rm = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => { r.value = withRepeat(withTiming(360, { duration: rm ? 3000 : 900, easing: Easing.linear }), -1); }, [rm, r]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: w, borderColor: QZ.c.track, borderTopColor: QZ.c.primary }, a]} />;
}

/* ---------- result badge: pop, ripple rings, drawn mark, shake on failure ---------- */
const AnimatedPath = Animated.createAnimatedComponent(Path);
export function QzBadge({ tone }: { tone: 'ok' | 'bad' }) {
  const rm = useReducedMotion();
  const pop = useSharedValue(rm ? 1 : 0), draw = useSharedValue(rm ? 0 : 40), ring1 = useSharedValue(rm ? 1 : 0), ring2 = useSharedValue(rm ? 1 : 0), shake = useSharedValue(0);
  useEffect(() => {
    if (rm) return;
    pop.value = smooth(1);
    draw.value = withDelay(300, withTiming(0, { duration: 500 }));
    ring1.value = withDelay(350, withTiming(1, { duration: 1400 }));
    ring2.value = withDelay(750, withTiming(1, { duration: 1400 }));
    if (tone === 'bad') shake.value = withDelay(450, withSequence(withTiming(-8, { duration: 70 }), withTiming(8, { duration: 90 }), withTiming(-5, { duration: 80 }), withTiming(5, { duration: 80 }), withTiming(0, { duration: 60 })));
  }, [rm, tone, pop, draw, ring1, ring2, shake]);
  const col = tone === 'ok' ? QZ.c.primary : QZ.c.danger;
  const disc = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }, { translateX: shake.value }] }));
  const r1 = useAnimatedStyle(() => ({ opacity: ring1.value >= 1 ? 0 : 0.55 * (1 - ring1.value), transform: [{ scale: 1 + 0.9 * ring1.value }] }));
  const r2 = useAnimatedStyle(() => ({ opacity: ring2.value >= 1 ? 0 : 0.55 * (1 - ring2.value), transform: [{ scale: 1 + 0.9 * ring2.value }] }));
  const ap = useAnimatedProps(() => ({ strokeDashoffset: draw.value }));
  return (
    <View style={st.badgeWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[st.ring, { borderColor: col }, r1]} />
      <Animated.View style={[st.ring, { borderColor: col }, r2]} />
      <Animated.View style={[st.disc, { backgroundColor: tone === 'ok' ? QZ.c.tint : QZ.c.dangerTint }, disc]}>
        <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <AnimatedPath d={tone === 'ok' ? 'M5 12.5l4.5 4.5L19 7.5' : 'M6 6l12 12M18 6L6 18'} strokeDasharray={40} animatedProps={ap} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  cta: { minHeight: 48, borderRadius: QZ.r.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: QZ.sp.lg, overflow: 'hidden' },
  sweep: { position: 'absolute', top: 0, bottom: 0, width: 80 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: QZ.c.bg, borderTopWidth: 1, borderTopColor: QZ.c.border, paddingHorizontal: QZ.sp.lg, paddingTop: QZ.sp.md, gap: QZ.sp.xs },
  badgeWrap: { width: 88, height: 88, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: QZ.sp.xl },
  ring: { position: 'absolute', width: 88, height: 88, borderRadius: 44, borderWidth: 2 },
  disc: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
});
