/**
 * Shared presentation primitives for the employer redesign (docs/redesign).
 * Built on the jobs-v2 tokens (Lagoon & Sunrise) + jobs-v2 ui primitives.
 * Every loop/animation respects Reduce Motion.
 */
import React, { useEffect, useState } from 'react';
import {
  Animated as RNAnimated,
  Easing as RNEasing,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Press, BottomSheet } from '../jobs-v2/ui';
import { colors, font, radius, shadow } from '../jobs-v2/theme';
import { AppIcon } from '../jobs-v2/AppIcon';

import { smooth } from '@/src/design/motion';
export * from '../jobs-v2/ui';
export * from '../jobs-v2/theme';
export { AppIcon, type IconName } from '../jobs-v2/AppIcon';

/* ───────────── count-up number ───────────── */

/**
 * Animates a number from its previous value to `value` (counts up/down).
 * Reduced Motion: jumps straight to the final value.
 */
export function CountUp({
  value, format, duration = 700, style,
}: {
  value: number; format?: (n: number) => string; duration?: number; style?: StyleProp<TextStyle>;
}) {
  const reduce = useReducedMotion();
  const v = useSharedValue(reduce ? value : 0);
  const fmt = (n: number) => (format ? format(n) : String(Math.round(n)));

  useEffect(() => {
    if (reduce) {
      v.value = value;
      return;
    }
    v.value = withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(v);
  }, [value, duration, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const animatedProps = useAnimatedProps(() => ({ text: fmt(v.value) }));

  // `Animated.Text` (rather than createAnimatedComponent(Text)) so the `text`
  // animated-prop is part of its public props type.
  return <Animated.Text animatedProps={animatedProps as never} maxFontSizeMultiplier={1.3} style={[{ color: colors.deepTeal }, style]} />;
}

/* ───────────── growing bars (stats) ───────────── */

const BAR_PATTERN = [10, 16, 22, 17, 24, 13];

export function Bars({
  active, bars = BAR_PATTERN.length, filled = colors.teal, tinted = colors.track, height = 24, gap = 3, width = 4,
}: {
  active?: number; bars?: number; filled?: string; tinted?: string; height?: number; gap?: number; width?: number;
}) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    p.value = 0;
    p.value = withDelay(140, withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(p);
  }, [p, reduce]);

  const count = Math.max(1, bars);
  const filledCount = Math.max(0, Math.min(count, active ?? count));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap }}>
      {Array.from({ length: count }, (_, i) => (
        <Bar key={i} p={p} h={BAR_PATTERN[i % BAR_PATTERN.length]} max={Math.max(...BAR_PATTERN)} height={height} width={width} color={i < filledCount ? filled : tinted} />
      ))}
    </View>
  );
}

function Bar({ p, h, max, height, width, color }: {
  p: SharedValue<number>; h: number; max: number; height: number; width: number; color: string;
}) {
  const anim = useAnimatedStyle(() => ({
    height: (h / max) * height * p.value,
    opacity: p.value,
  }));
  return <Animated.View style={[anim, { width, borderRadius: 2, backgroundColor: color }]} />;
}

/* ───────────── looping helpers ───────────── */

/** Soft opacity "breathe" loop. Reduced Motion: static. */
export function Breathe({
  size = 8, color = colors.sun, duration = 1700, style,
}: { size?: number; color?: string; duration?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(reduce ? 1 : 0.55);
  useEffect(() => {
    if (reduce) return;
    o.value = withRepeat(withTiming(0.98, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(o);
  }, [reduce, duration, o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style, anim]} />;
}

/**
 * Diagonal light sweep: a soft band that sweeps across its parent once per
 * `period`. Parent must set `overflow: 'hidden'`. Reduced Motion: hidden.
 */
export function LightSweep({
  travel, period = 4200, band = 30, color = 'rgba(255,255,255,0.35)', tilt = 0.6,
}: { travel: number; period?: number; band?: number; color?: string; tilt?: number }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: period, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [reduce, period, t]);

  const anim = useAnimatedStyle(() => {
    const x = -band + t.value * (travel + band * 2);
    return {
      transform: [{ translateX: x }, { scaleY: tilt }, { translateX: band * -0.5 }],
      opacity: reduce ? 0 : 1,
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: -8, bottom: -8, width: band, backgroundColor: color, borderRadius: band }, anim]}
    />
  );
}

/** Concentric expanding rings (boost artwork halo). Reduced Motion: static rings. */
export function Ripple({
  size = 120, color = colors.tintMid, periods = 3, period = 2600,
}: { size?: number; color?: string; periods?: number; period?: number }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: period, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(t);
  }, [reduce, period, t]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: periods }, (_, i) => (
        <RippleRing key={i} index={i} periods={periods} progress={t} reduce={reduce} size={size} color={color} />
      ))}
    </View>
  );
}

/** One ring of the Ripple: its own component so the hook isn't called in a loop. */
function RippleRing({
  index, periods, progress, reduce, size, color,
}: { index: number; periods: number; progress: SharedValue<number>; reduce: boolean; size: number; color: string }) {
  const anim = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, progress.value * periods - index));
    return { transform: [{ scale: 0.45 + p * 1.05 }], opacity: reduce ? 0.12 : 0.42 * (1 - p) };
  });
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: color }, anim]} />;
}

/* ───────────── dashes ───────────── */

/** Horizontal dashed "tear" line (boost ticket, receipt cards). */
export function DashedTear({ color = colors.border, style }: { color?: string; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ borderBottomWidth: 1.2, borderStyle: 'dashed', borderColor: color }, style]} />;
}

/* ───────────── stars (exact fraction fill) ───────────── */

export function StarFill({ value, size = 16, gap = 3, filled = colors.teal, empty = colors.track }: {
  value: number; size?: number; gap?: number; filled?: string; empty?: string;
}) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const fill = Math.max(0, Math.min(1, value - i));
    return (
      <View key={i} style={{ width: size, height: size, position: 'relative' }}>
        {fill >= 1 ? (
          <AppIcon name="star" size={size} color={filled} strokeWidth={1.6} />
        ) : (
          <>
            <AppIcon name="star" size={size} color={empty} strokeWidth={1.6} />
            {fill > 0 ? (
              <View style={{ position: 'absolute', left: 0, top: 0, width: size * fill, height: size, overflow: 'hidden' }}>
                <AppIcon name="star" size={size} color={filled} strokeWidth={1.6} />
              </View>
            ) : null}
          </>
        )}
      </View>
    );
  });
  return <View style={{ flexDirection: 'row', gap }}>{stars}</View>;
}

/* ───────────── segmented control (sliding pill, equal segments) ───────────── */

export function Segmented<T extends string>({
  options, value, onChange, disabled,
}: { options: readonly T[]; value: T; onChange: (v: T) => void; disabled?: boolean }) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.indexOf(value));
  const len = options.length;
  const segment = len > 0 ? w / len : 0;
  const travel = useSharedValue(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    travel.value = reduce ? idx * segment : withTiming(idx * segment, { duration: 260, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(travel);
  }, [idx, segment, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: travel.value }] }));

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', backgroundColor: colors.track, borderRadius: radius.chip, padding: 3, height: 44 }}
    >
      <Animated.View style={[{ position: 'absolute', top: 3, bottom: 3, left: 3, width: segment > 0 ? segment - 2 : 0, borderRadius: 11, backgroundColor: colors.white, ...(segment > 0 ? { shadowColor: colors.teal, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 } : {}) }, pill]} />
      {options.map((o) => {
        const selected = o === value;
        return (
          <Press
            key={o}
            disabled={disabled}
            onPress={() => onChange(o)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11 }}
          >
            <Text style={{ fontFamily: font.medium, fontSize: 13, color: selected ? colors.deepTeal : colors.muted }}>{o}</Text>
          </Press>
        );
      })}
    </View>
  );
}

/* ───────────── switch (animated thumb) ───────────── */

export function Switch({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    t.value = reduce ? (value ? 1 : 0) : smooth(value ? 1 : 0);
    return () => cancelAnimation(t);
  }, [value, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  const track = useAnimatedStyle(() => ({ backgroundColor: value ? colors.teal : colors.track }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: t.value * 20 }] }));

  return (
    <Press
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{ width: 48, height: 28, borderRadius: 14, padding: 3 }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 14 }, track]} />
      <Animated.View style={[{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, shadowColor: colors.teal, shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 }, thumb]} />
    </Press>
  );
}

/* ───────────── press-down disc (seat tiles) ───────────── */

export function PressDisc({
  onPress, children, size = 22, style, accessibilityLabel,
}: { onPress?: () => void; children?: React.ReactNode; size?: number; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  return (
    <Press
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      {children}
    </Press>
  );
}

/* ───────────── seat icon (filled seat / dashed empty seat) ───────────── */

export function Seat({ filled, size = 22, breathe }: { filled: boolean; size?: number; breathe?: boolean }) {
  if (filled) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.white, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' }} />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' }}>
      {breathe ? <Breathe size={Math.max(6, size * 0.45)} color="rgba(255,255,255,0.85)" duration={1900} /> : null}
    </View>
  );
}

/* ───────────── expandable card (unfold) ───────────── */

export function ExpandCard({
  title, children, defaultOpen = false,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [h, setH] = useState<number | null>(null);
  const reduce = useReducedMotion();
  // Stable animated value, created once (no ref read during render).
  const [prog] = useState(() => new RNAnimated.Value(open ? 1 : 0));

  useEffect(() => {
    RNAnimated.timing(prog, {
      toValue: open ? 1 : 0,
      duration: reduce ? 0 : 260,
      easing: RNEasing.out(RNEasing.cubic),
      useNativeDriver: false,
    }).start();
  }, [open, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const chevron = prog.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16 }}>
      <Press onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: font.headBold, fontSize: 15, color: colors.deepTeal }}>{title}</Text>
        <RNAnimated.View style={{ transform: [{ rotate: chevron }] }}>
          <AppIcon name="chevron" size={18} color={colors.muted} />
        </RNAnimated.View>
      </Press>
      <RNAnimated.View style={{ height: prog.interpolate({ inputRange: [0, 1], outputRange: [0, h ?? 0] }), opacity: prog, overflow: 'hidden' }}>
        <View onLayout={(e) => setH(e.nativeEvent.layout.height)} style={{ paddingBottom: 14 }}>
          {children}
        </View>
      </RNAnimated.View>
    </View>
  );
}

/* ───────────── confirm sheet (accept / reject / delete) ───────────── */
// Presentation-only re-skin of the employer-job ConfirmActionSheet, using the
// v2 tokens. Trigger logic stays in the route; this mirrors the old props.

const CONFIRM_ICON = { check: 'check', x: 'x', trash: 'trash' } as const;

export function ConfirmSheet({
  visible, tone = 'good', icon = 'check', title, message, children,
  cancelLabel, confirmLabel, confirmTone = 'teal', onCancel, onConfirm,
}: {
  visible: boolean; tone?: 'good' | 'bad'; icon?: keyof typeof CONFIRM_ICON;
  title: string; message: string; children?: React.ReactNode;
  cancelLabel?: string; confirmLabel: string; confirmTone?: 'teal' | 'red';
  onCancel?: () => void; onConfirm: () => void;
}) {
  const danger = tone === 'bad';
  const dz = confirmTone === 'red';
  return (
    <BottomSheet visible={visible} onClose={onCancel ?? (() => {})}>
      <View style={{ alignItems: 'center', paddingBottom: 4 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: danger ? colors.dangerTint : colors.tint, alignItems: 'center', justifyContent: 'center' }}>
          <AppIcon name={CONFIRM_ICON[icon]} size={26} color={danger ? colors.danger : colors.teal} strokeWidth={1.8} />
        </View>
        <Text style={{ fontFamily: font.headBold, fontSize: 18, color: colors.deepTeal, marginTop: 14, textAlign: 'center' }}>{title}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 6, textAlign: 'center' }}>{message}</Text>
        {children ? <View style={{ width: '100%', marginTop: 16 }}>{children}</View> : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' }}>
          {cancelLabel ? (
            <Press
              onPress={onCancel}
              accessibilityRole="button"
              style={{ flex: 1, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: font.semi, fontSize: 14, color: colors.text }}>{cancelLabel}</Text>
            </Press>
          ) : null}
          <Press
            onPress={onConfirm}
            accessibilityRole="button"
            style={{ minHeight: 48, borderRadius: radius.pill, backgroundColor: dz ? colors.danger : colors.teal, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', flex: cancelLabel ? 1 : undefined }}
          >
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.white }}>{confirmLabel}</Text>
          </Press>
        </View>
      </View>
    </BottomSheet>
  );
}

/* ───────────── three-dot corner menu ───────────── */

export function DotsMenu({
  visible, top, onClose, items,
}: {
  visible: boolean; top: number; onClose: () => void;
  items: { label: string; danger?: boolean; onPress: () => void }[];
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={{ position: 'absolute', right: 16, top, backgroundColor: colors.card, borderRadius: radius.card, padding: 6, minWidth: 160, ...(shadow as ViewStyle) }}>
        {items.map((item) => (
          <Press key={item.label} onPress={() => { onClose(); item.onPress(); }} accessibilityRole="button" style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.tile }}>
            <Text style={{ fontFamily: font.semi, fontSize: 14, color: item.danger ? colors.danger : colors.text }}>{item.label}</Text>
          </Press>
        ))}
      </View>
    </Modal>
  );
}