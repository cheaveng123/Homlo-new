import React, { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import {
  Animated as RNAnimated,
  Easing as RNEasing,
  Modal,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  cancelAnimation,
  measure,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { familyNew } from '@/src/new/theme/fontsNew';
import { AppIcon, IconName } from './AppIcon';
import { colors, font, radius, shadow } from './theme';

const KHMER = /[\u1780-\u17FF\u19E0-\u19FF]/;
export function hasKhmer(value: unknown): boolean {
  return typeof value === 'string' && KHMER.test(value);
}
function khmerWeightFrom(family: string | undefined): keyof typeof familyNew.khmer {
  const m = family?.match(/_(\d{3})/);
  const n = m ? Number(m[1]) : family?.toLowerCase().includes('bold') ? 700 : 400;
  if (n >= 800) return 'extrabold';
  if (n >= 700) return 'bold';
  if (n >= 600) return 'semibold';
  if (n >= 500) return 'medium';
  return 'regular';
}

/* ───────────── text ───────────── */

export const ts = StyleSheet.create({
  hero: { fontFamily: font.head, fontSize: 24, lineHeight: 30, color: colors.deepTeal },
  section: { fontFamily: font.head, fontSize: 17, lineHeight: 22, color: colors.text },
  title: { fontFamily: font.bold, fontSize: 14, lineHeight: 19, color: colors.text },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  tag: { fontFamily: font.bold, fontSize: 12, lineHeight: 16, color: colors.clay },
  big: { fontFamily: font.head, fontSize: 20, lineHeight: 26, color: colors.clay },
});

/** Text with the app's default style; font scale capped at 130% so nothing clips.
 *  Latin uses the v2 families; Khmer content auto-switches to Noto Sans Khmer at the
 *  matching weight with taller line height (loaded at the root layout). */
export function Txt({ style, children, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style);
  const latinFamily = flat.fontFamily ?? ts.body.fontFamily;
  const flatLine = typeof flat.lineHeight === 'number' && flat.lineHeight > 0 ? flat.lineHeight : ts.body.lineHeight;
  const khmer = hasKhmer(
    React.Children.toArray(children)
      .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
      .join(''),
  );
  const familyStyle = khmer
    ? { fontFamily: familyNew.khmer[khmerWeightFrom(latinFamily)], lineHeight: Math.round(flatLine * 1.25) }
    : null;
  return (
    <Text maxFontSizeMultiplier={1.3} {...rest} style={[ts.body, familyStyle, style]}>
      {children}
    </Text>
  );
}

/* ───────────── pressables ───────────── */

type PressProps = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> };

/** Press feedback: scale 0.975. */
export function Press({ style, children, ...rest }: PressProps) {
  return (
    <Pressable {...rest} style={({ pressed }) => [style, pressed && { transform: [{ scale: 0.975 }] }]}>
      {children}
    </Pressable>
  );
}

export function RoundButton({
  icon, onPress, label, onDark, solid, size = 36, iconColor,
}: {
  icon: IconName; onPress?: () => void; label: string; onDark?: boolean; solid?: boolean; size?: number; iconColor?: string;
}) {
  const bg = solid ? colors.teal : onDark ? 'rgba(255,255,255,0.14)' : colors.white;
  const border = solid ? colors.teal : onDark ? 'rgba(255,255,255,0.3)' : colors.border;
  const ic = iconColor ?? (solid || onDark ? colors.white : colors.deepTeal);
  return (
    <Press
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: bg,
        borderWidth: 1, borderColor: border, alignItems: 'center', justifyContent: 'center',
      }}
    >
      <AppIcon name={icon} size={18} color={ic} />
    </Press>
  );
}

export function Chip({
  label, icon, selected, onPress,
}: { label: string; icon?: IconName; selected?: boolean; onPress?: () => void }) {
  return (
    <Press
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      style={[
        styles.chip,
        selected && { borderColor: colors.teal, borderWidth: 1.5, paddingVertical: 6.5, paddingHorizontal: 11.5 },
      ]}
    >
      {icon ? <AppIcon name={icon} size={14} color={colors.text} /> : null}
      <Txt style={[styles.chipText, selected && { color: colors.deepTeal }]}>{label}</Txt>
    </Press>
  );
}

export function PrimaryButton({
  label, onPress, disabled, icon, variant = 'primary', style,
}: {
  label: string; onPress?: () => void; disabled?: boolean; icon?: IconName;
  variant?: 'primary' | 'danger'; style?: StyleProp<ViewStyle>;
}) {
  const danger = variant === 'danger';
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.primary,
        danger ? { backgroundColor: colors.dangerTint } : shadow,
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <Txt style={[styles.primaryText, danger && { color: colors.danger }]}>{label}</Txt>
      {icon ? <AppIcon name={icon} size={16} color={colors.white} strokeWidth={2} /> : null}
    </Press>
  );
}

/* ───────────── small parts ───────────── */

export function Dot({ size = 8, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.sun }, style]} />;
}

export function LogoTile({
  initials, color, size = 40, round, fontSize,
}: { initials: string; color: string; size?: number; round?: boolean; fontSize?: number }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: round ? size / 2 : radius.tile,
        backgroundColor: color, alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Txt style={{ fontFamily: font.head, fontSize: fontSize ?? 14, color: colors.white }}>{initials}</Txt>
    </View>
  );
}

export function Pill({ label, bg, ink }: { label: string; bg: string; ink: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.chip, paddingVertical: 3, paddingHorizontal: 10, alignSelf: 'flex-start' }}>
      <Txt style={{ fontFamily: font.semi, fontSize: 11, lineHeight: 15, color: ink }}>{label}</Txt>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ResultBar({
  countLabel, onFilters, onSort, filtersLabel = 'Filters', sortLabel = 'Sort', hideFilters,
}: {
  countLabel?: string; onFilters?: () => void; onSort?: () => void;
  filtersLabel?: string; sortLabel?: string; hideFilters?: boolean;
}) {
  return (
    <View style={styles.resultBar}>
      <Txt style={{ flex: 1, fontFamily: font.bold, color: colors.teal }}>{countLabel ?? ''}</Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {hideFilters ? null : <Chip label={filtersLabel} icon="filt" onPress={onFilters} />}
        <Chip label={sortLabel} onPress={onSort} />
      </View>
    </View>
  );
}

export function SearchRow({
  placeholder, onPress, onFilters, tinted = true,
}: { placeholder: string; onPress?: () => void; onFilters?: () => void; tinted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Press
        onPress={onPress}
        accessibilityRole="search"
        style={{
          flex: 1, height: 44, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center',
          gap: 8, paddingHorizontal: 14, backgroundColor: tinted ? colors.bg : colors.white,
        }}
      >
        <AppIcon name="search" size={16} color={colors.muted} />
        <Txt style={{ color: colors.muted }} numberOfLines={1}>{placeholder}</Txt>
      </Press>
      {onFilters ? <RoundButton icon="filt" onPress={onFilters} label="Filters" solid /> : null}
    </View>
  );
}

/* ───────────── motion helpers ───────────── */

/** Repeating 0→to animation (optionally reversing). Respects Reduce Motion (stays at `from`). */
export function useLoop(
  to: number, duration: number,
  opts: { reverse?: boolean; from?: number; delay?: number; easing?: (t: number) => number } = {},
): SharedValue<number> {
  const { reverse = false, from = 0, delay = 0, easing = Easing.linear } = opts;
  const v = useSharedValue(from);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    v.value = from;
    v.value = withDelay(delay, withRepeat(withTiming(to, { duration, easing }), -1, reverse));
    return () => cancelAnimation(v);
  }, [reduce, to, duration, reverse, from, delay]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

const ScrollCtx = createContext<SharedValue<number> | null>(null);

/** Vertical screen scroller: shares scrollY with <Parallax> and <Reveal>. */
export function ScreenScroll({
  children, background = colors.card, paddingBottom = 24,
}: { children: ReactNode; background?: string; paddingBottom?: number }) {
  const y = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  return (
    <ScrollCtx.Provider value={y}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: background }}
        contentContainerStyle={{ paddingBottom: paddingBottom + insets.bottom }}
      >
        {children}
      </Animated.ScrollView>
    </ScrollCtx.Provider>
  );
}

/** Header content that lifts (rate) and optionally fades (over `fade` px) while scrolling. */
export function Parallax({
  children, rate = -0.3, fade = 0, style,
}: { children: ReactNode; rate?: number; fade?: number; style?: StyleProp<ViewStyle> }) {
  const y = useContext(ScrollCtx);
  const reduce = useReducedMotion();
  const anim = useAnimatedStyle(() => {
    if (!y || reduce) return {};
    const v = Math.max(0, y.value);
    return {
      transform: [{ translateY: v * rate }],
      opacity: fade > 0 ? Math.max(0, 1 - v / fade) : 1,
    };
  });
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Fades and slides up (18px) once, the first time it scrolls into view. */
export function Reveal({
  children, style, delay = 0,
}: { children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const y = useContext(ScrollCtx);
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const ref = useAnimatedRef<Animated.View>();
  const p = useSharedValue(reduce || !y ? 1 : 0);
  const started = useSharedValue(false);
  const tick = useSharedValue(0);

  useAnimatedReaction(
    () => (y ? y.value : 0) + tick.value,
    () => {
      if (started.value) return;
      const m = measure(ref);
      if (!m) return;
      if (m.pageY < height - 40) {
        started.value = true;
        p.value = withDelay(delay, withTiming(1, { duration: 450 }));
      }
    },
  );

  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 18 }],
  }));

  return (
    <Animated.View
      ref={ref}
      collapsable={false}
      onLayout={() => {
        tick.value = tick.value + 1;
      }}
      style={[style, anim]}
    >
      {children}
    </Animated.View>
  );
}

/* ───────────── bottom sheet (28 top radius, grab bar) ───────────── */

export function BottomSheet({
  visible, onClose, children,
}: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const [mounted, setMounted] = useState(visible);
  // Stable animated value, created once (no ref read during render).
  const [prog] = useState(() => new RNAnimated.Value(0));
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // Mount as soon as it becomes visible (during render, not in the effect);
  // unmounting waits for the closing animation below.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      RNAnimated.timing(prog, { toValue: 1, duration: 260, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: true }).start();
    } else if (mounted) {
      RNAnimated.timing(prog, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(7,59,66,0.55)', opacity: prog }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </RNAnimated.View>
        <RNAnimated.View
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white,
            borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
            paddingTop: 10, paddingHorizontal: 16, paddingBottom: 18 + insets.bottom,
            transform: [{ translateY: prog.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }],
          }}
        >
          <View style={{ width: 40, height: 4, borderRadius: 4, backgroundColor: colors.track, alignSelf: 'center', marginBottom: 14 }} />
          {children}
        </RNAnimated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: radius.chip, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
  },
  chipText: { fontFamily: font.semi, fontSize: 12, lineHeight: 16, color: colors.text },
  primary: {
    height: 48, borderRadius: radius.pill, backgroundColor: colors.teal, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24,
  },
  primaryText: { fontFamily: font.bold, fontSize: 14, color: colors.white },
  card: {
    backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border,
    padding: 12, marginBottom: 12, ...shadow,
  },
  resultBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
