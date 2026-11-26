import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from '@/lib/native/linear-gradient';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useIsFocused } from '@/lib/router';
import { TextNew } from '@/src/new/components/TextNew';
import { featureIcons, PhotoGlyph, type FeatureIconName } from '@/src/components/icons';
import { PressableScale } from './motion';
import { heroGradient, palette, radii, shadows } from './tokens';

export { DashTabsNew as Tabs, type DashTab as TabItem } from '@/src/new/components/dashboard/DashTabsNew';
export { Reveal, PressableScale, useShake } from './motion';

/* ───────── Card ───────── */

let glowSeq = 0;
/** 2pt top line + soft radial top glow. `amber` marks featured/promoted items. */
export function TopLight({ tone = 'cyan' }: { tone?: 'cyan' | 'amber' }) {
  const id = React.useMemo(() => `tl${glowSeq++}`, []);
  const amber = tone === 'amber';
  const c = amber ? palette.amber : palette.cyan;
  const inset = amber ? '6%' : '12%';
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.clip]}>
      <Svg width="100%" height={70} style={s.abs}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="0%" rx="60%" ry="100%">
            <Stop offset="0" stopColor={c} stopOpacity={amber ? 0.2 : 0.1} />
            <Stop offset="1" stopColor={c} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy={0} rx="60%" ry={70} fill={`url(#${id})`} />
      </Svg>
      <LinearGradient
        colors={['transparent', amber ? 'rgba(245,165,36,0.85)' : 'rgba(8,145,178,0.7)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.topLine, { left: inset, right: inset }]}
      />
    </View>
  );
}

export function Card({ children, light, padding = 14, style }: {
  children: React.ReactNode; light?: 'cyan' | 'amber'; padding?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.card, shadows.card, { padding }, style]}>
      {light ? <TopLight tone={light} /> : null}
      {children}
    </View>
  );
}

/* ───────── Hero + Sheet ───────── */

/** Cyan gradient hero with a soft top-right glow. Pair with <Sheet overlap>. */
export function Hero({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.hero, style]}>
      <LinearGradient {...heroGradient} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="heroGlowP" cx="92%" cy="0%" rx="70%" ry="60%">
            <Stop offset="0" stopColor={palette.heroGlow} stopOpacity={0.9} />
            <Stop offset="1" stopColor={palette.heroGlow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#heroGlowP)" />
      </Svg>
      {children}
    </View>
  );
}

/** White sheet, top radius 26. `overlap` pulls it 26pt over the hero above it. */
export function Sheet({ children, overlap, style }: { children: React.ReactNode; overlap?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.sheet, overlap && { marginTop: -26 }, style]}>{children}</View>;
}

/* ───────── Text pieces ───────── */

export function SectionTitle({ title, right, style }: { title: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.sectionRow, style]}>
      <TextNew variant="section" heading weight="bold" color={palette.ink} style={s.sectionText}>{title}</TextNew>
      {right}
    </View>
  );
}

export function CountPill({ count, active }: { count: number | string; active?: boolean }) {
  return (
    <View style={[s.pill, { backgroundColor: active ? palette.cyanTint : palette.pillIdle }]}>
      <TextNew variant="caption" heading weight="bold" color={active ? palette.cyanDeep : palette.muted} style={s.pillText}>{count}</TextNew>
    </View>
  );
}

/* ───────── Rows & buttons ───────── */

export function ListRow({ icon, title, subtitle, right, onPress, divider = true, accessibilityLabel }: {
  icon?: React.ReactNode; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; divider?: boolean; accessibilityLabel?: string;
}) {
  const body = (
    <View style={[s.row, divider && s.rowDivider]}>
      {icon ? <View style={s.rowIcon}>{icon}</View> : null}
      <View style={s.rowText}>
        <TextNew variant="body" weight="medium" color={palette.ink} numberOfLines={1}>{title}</TextNew>
        {subtitle ? <TextNew variant="meta" color={palette.muted} numberOfLines={1}>{subtitle}</TextNew> : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale scale={0.985} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}>
      {body}
    </PressableScale>
  );
}

export function PrimaryButton({ label, onPress, disabled, icon, variant = 'primary', style }: {
  label: string; onPress: () => void; disabled?: boolean; icon?: React.ReactNode; variant?: 'primary' | 'light'; style?: StyleProp<ViewStyle>;
}) {
  const light = variant === 'light';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[s.btn, shadows.lift, { backgroundColor: light ? palette.surface : palette.cyan, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {icon}
      <TextNew variant="title" heading weight="bold" color={light ? palette.cyanDeep : '#fff'}>{label}</TextNew>
    </PressableScale>
  );
}

/* ───────── States ───────── */

export function EmptyState({ icon = 'noResults', title, body, actionLabel, onAction }: {
  icon?: FeatureIconName; title: string; body?: string; actionLabel?: string; onAction?: () => void;
}) {
  const focused = useIsFocused();
  const Icon = featureIcons[icon];
  return (
    <View style={s.empty}>
      <Icon size={64} active={focused} />
      <TextNew variant="title" heading weight="bold" color={palette.ink} align="center" style={s.emptyTitle}>{title}</TextNew>
      {body ? <TextNew variant="body" color={palette.muted} align="center">{body}</TextNew> : null}
      {actionLabel && onAction ? <PrimaryButton label={actionLabel} onPress={onAction} style={s.emptyBtn} /> : null}
    </View>
  );
}

/** Shimmer skeleton block (1.4s sweep; static under Reduce Motion). */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduce) t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [reduce, t]);
  const sweep = useAnimatedStyle(() => ({ left: `${-60 + 160 * t.value}%` }));
  return (
    <View style={[{ width, height, borderRadius: radius, backgroundColor: '#E9F0F2', overflow: 'hidden' }, style]}>
      {!reduce ? (
        <Animated.View style={[s.shimmer, sweep]}>
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Neutral photo placeholder: never an owner avatar over a photo. */
export function PhotoPlaceholder({ style, label = 'Photo', compact }: { style?: StyleProp<ViewStyle>; label?: string; compact?: boolean }) {
  // `compact` (thumbnails under ~80pt): glyph only, centered.
  return (
    <LinearGradient colors={['#EEF5F7', '#D2E1E6']} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={[s.ph, compact && s.phCompact, style]}>
      {compact ? <PhotoGlyph /> : <View style={s.phGlyph}><PhotoGlyph /></View>}
      {compact ? null : <TextNew variant="caption" weight="semibold" color="#6D8C97" style={s.phLabel}>{label}</TextNew>}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  clip: { borderRadius: radii.card, overflow: 'hidden' },
  abs: { position: 'absolute', top: 0, left: 0 },
  topLine: { position: 'absolute', top: 0, height: 2 },
  card: { backgroundColor: palette.surface, borderRadius: radii.card, borderWidth: 1, borderColor: palette.line },
  hero: { overflow: 'hidden', paddingHorizontal: 16, paddingBottom: 50 },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, paddingTop: 22, paddingHorizontal: 16 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionText: { fontSize: 17, lineHeight: 22 },
  pill: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  pillText: { fontSize: 12, lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  rowIcon: { width: 28, alignItems: 'center' },
  rowText: { flex: 1, gap: 2 },
  btn: { height: 48, borderRadius: radii.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 22 },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 28, gap: 8 },
  emptyTitle: { marginTop: 6 },
  emptyBtn: { marginTop: 12, alignSelf: 'stretch' },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: '60%' },
  ph: { flex: 1, alignItems: 'center', overflow: 'hidden' },
  phCompact: { justifyContent: 'center' },
  phGlyph: { position: 'absolute', top: '50%', marginTop: -22 },
  phLabel: { position: 'absolute', bottom: 10, fontSize: 11, lineHeight: 14 },
});
