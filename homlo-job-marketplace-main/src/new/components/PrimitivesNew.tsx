import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, PressableProps, StyleProp, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Animated, {
  Easing, FadeIn, FadeOut, cancelAnimation, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { useIsFocused } from 'expo-router';
import { Skeleton } from '@/src/design/primitives';
import { featureIcons, type FeatureIconName } from '@/src/components/icons';
import { SectionIcon, type SectionIconName } from '@/src/components/icons/SectionIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIconNew, AppIconNameNew } from '../icons/AppIconNew';
import { TextNew, hasKhmerNew } from './TextNew';
import { AccentNew, accentNew, colorsNew, radiusNew, shadowNew } from '../theme/tokensNew';
import { motionNew } from '../theme/motionNew';
import { familyNew } from '../theme/fontsNew';

const APressable = Animated.createAnimatedComponent(Pressable);
const SELECTED_INK = '#0B6F8A';

/* ---------- press feedback: 0.975 buttons/rows, 0.985 cards ---------- */
type PSProps = Omit<PressableProps, 'style'> & { scaleTo?: number; style?: StyleProp<ViewStyle> };
export function PressableScaleNew({ scaleTo = motionNew.pressButton, style, onPressIn, onPressOut, ...rest }: PSProps) {
  const s = useSharedValue(1);
  const reduced = useReducedMotion();
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      accessibilityRole="button"
      hitSlop={8}
      {...rest}
      onPressIn={(e) => { if (!reduced) s.set(withTiming(scaleTo, { duration: 120 })); onPressIn?.(e); }}
      onPressOut={(e) => { s.set(reduced ? 1 : withSpring(1, { damping: 14, stiffness: 260 })); onPressOut?.(e); }}
      style={[style, a]}
    />
  );
}

/* ---------- primary pill button (48px) with optional diagonal light sweep ---------- */
type ButtonProps = {
  label?: string; onPress?: () => void; variant?: 'primary' | 'tint'; sweep?: boolean;
  leftIcon?: AppIconNameNew; rightIcon?: AppIconNameNew; iconOnly?: boolean; disabled?: boolean;
  style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
};
export function ButtonNew({ label, onPress, variant = 'primary', sweep, leftIcon, rightIcon, iconOnly, disabled, style, accessibilityLabel }: ButtonProps) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!sweep || reduced || !w) return;
    x.value = withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), withDelay(3100, withTiming(0, { duration: 0 }))), -1);
    return () => cancelAnimation(x);
  }, [sweep, reduced, w, x]);
  const sw = useAnimatedStyle(() => ({ transform: [{ translateX: -60 + x.value * (w + 120) }, { skewX: '-20deg' }] }));
  const primary = variant === 'primary';
  const fg = primary ? colorsNew.white : colorsNew.deep;
  return (
    <PressableScaleNew
      onPress={disabled ? undefined : onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={[{
        height: 48, minWidth: 48, width: iconOnly ? 48 : undefined, borderRadius: radiusNew.pill, overflow: 'hidden',
        backgroundColor: primary ? colorsNew.primary : colorsNew.tint, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center', gap: 8, paddingHorizontal: iconOnly ? 0 : 20, opacity: disabled ? 0.5 : 1,
      }, style]}
    >
      {leftIcon && <AppIconNew name={leftIcon} color={fg} />}
      {!!label && <TextNew variant="title" weight="semibold" color={fg}>{label}</TextNew>}
      {rightIcon && <AppIconNew name={rightIcon} color={fg} />}
      {sweep && !reduced && (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, width: 40 }, sw]}>
          <LinearGradient colors={['transparent', 'rgba(255,255,255,0.35)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
      )}
    </PressableScaleNew>
  );
}

/* ---------- round 44px icon button (back, heart, close) ---------- */
export function RoundButtonNew({ icon, onPress, bg = colorsNew.bg, color = colorsNew.deep, dot, badgeCount, size = 44, accessibilityLabel, style }: {
  icon: AppIconNameNew; onPress?: () => void; bg?: string; color?: string; dot?: boolean; badgeCount?: number; size?: number; accessibilityLabel?: string; style?: StyleProp<ViewStyle>;
}) {
  const count = badgeCount ?? 0;
  return (
    <PressableScaleNew onPress={onPress} accessibilityLabel={accessibilityLabel ?? icon}
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <AppIconNew name={icon} color={color} />
      {count > 0 ? (
        <View style={{ position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colorsNew.deep, alignItems: 'center', justifyContent: 'center' }}>
          <TextNew variant="caption" weight="bold" color={colorsNew.white} style={{ fontSize: 10, lineHeight: 13 }}>{count > 99 ? '99+' : count}</TextNew>
        </View>
      ) : dot ? (
        <View style={{ position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: colorsNew.sun }} />
      ) : null}
    </PressableScaleNew>
  );
}

/* ---------- chips: sm (28px tint) and lg (44px outline / selected teal) ---------- */
export function ChipNew({ label, tone = 'lagoon', size = 'sm', icon, selected, onPress, onLongPress, height }: {
  label: string; tone?: AccentNew; size?: 'sm' | 'lg'; icon?: AppIconNameNew; selected?: boolean; onPress?: () => void; onLongPress?: () => void; height?: number;
}) {
  const a = accentNew[tone];
  const lg = size === 'lg';
  const fg = lg ? (selected ? SELECTED_INK : colorsNew.text) : a.ink;
  const body = (
    <View style={{
      height: height ?? (lg ? 44 : 28), paddingHorizontal: lg ? 16 : 12, borderRadius: lg ? radiusNew.pill : radiusNew.chip,
      flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
      backgroundColor: lg ? (selected ? colorsNew.tint : colorsNew.white) : a.bg,
      borderWidth: lg ? 1 : 0, borderColor: selected ? colorsNew.tint : colorsNew.border,
    }}>
      {icon && <AppIconNew name={icon} size={lg ? 18 : 14} color={fg} />}
      <TextNew variant={lg ? 'body' : 'caption'} weight={lg ? 'medium' : 'semibold'} color={fg}>{label}</TextNew>
    </View>
  );
  return onPress ? <PressableScaleNew onPress={onPress} onLongPress={onLongPress} accessibilityState={{ selected: !!selected }}>{body}</PressableScaleNew> : body;
}

export function TagNew({ label, bg = colorsNew.clay, color = colorsNew.white }: { label: string; bg?: string; color?: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
      <TextNew variant="caption" weight="bold" color={color}>{label}</TextNew>
    </View>
  );
}

export function AvatarNew({ initials, size = 44, bg = colorsNew.primary, border, radius }: { initials: string; size?: number; bg?: string; border?: boolean; radius?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius ?? size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: border ? 2 : 0, borderColor: colorsNew.white }}>
      <TextNew variant={size < 40 ? 'caption' : 'body'} weight="semibold" color={colorsNew.white}>{initials}</TextNew>
    </View>
  );
}

export function IconDiscNew({ icon, tone = 'lagoon', size = 44, round }: { icon: AppIconNameNew; tone?: AccentNew; size?: number; round?: boolean }) {
  const a = accentNew[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: round ? size / 2 : size < 40 ? 12 : 14, backgroundColor: a.bg, alignItems: 'center', justifyContent: 'center' }}>
      <AppIconNew name={icon} color={a.ink} size={size < 40 ? 20 : 22} />
    </View>
  );
}

/* ---------- section title: custom section icon (or utility icon / amber dot) + fading line + optional action ---------- */
export function SectionTitleNew({ title, icon, glyph, actionLabel, onAction, style }: { title: string; icon?: AppIconNameNew; glyph?: SectionIconName; actionLabel?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, marginBottom: 12 }, style]}>
      {glyph ? null : icon ? <AppIconNew name={icon} size={20} color={colorsNew.deep} /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colorsNew.sun }} />}
      <TextNew variant="section" accessibilityRole="header">{title}</TextNew>
      {/* custom section icon sits right of the title, in plain slate */}
      {glyph ? <SectionIcon name={glyph} size={20} tone="mono" /> : null}
      <LinearGradient colors={[colorsNew.border, 'rgba(228,236,236,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
      {!!actionLabel && (
        <PressableScaleNew onPress={onAction} accessibilityLabel={`${actionLabel}: ${title}`} style={{ minHeight: 44, justifyContent: 'center' }}>
          <TextNew variant="meta" weight="semibold" color={colorsNew.primary}>{actionLabel}</TextNew>
        </PressableScaleNew>
      )}
    </View>
  );
}

/* ---------- text field (52px, radius 16) ---------- */
export function FieldNew({ label, leftIcon, multiline, style, ...input }: TextInputProps & { label?: string; leftIcon?: AppIconNameNew }) {
  const [focus, setFocus] = useState(false);
  const f = useSharedValue(0);
  const reducedF = useReducedMotion();
  const khmer = hasKhmerNew(input.value);
  const borderAnim = useAnimatedStyle(() => ({ borderColor: interpolateColor(f.value, [0, 1], [colorsNew.border, colorsNew.primary]) }));
  const setFocused = (on: boolean) => { setFocus(on); f.set(reducedF ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: 180 })); };
  return (
    <View>
      {!!label && <TextNew variant="body" weight="semibold" style={{ marginTop: 16, marginBottom: 8 }}>{label}</TextNew>}
      <Animated.View style={[{
        minHeight: multiline ? 110 : 52, borderRadius: 14, backgroundColor: focus ? colorsNew.white : colorsNew.bg, borderWidth: focus ? 1.5 : 1,
        paddingHorizontal: 16, paddingTop: multiline ? 14 : 0,
        flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: 8,
      }, borderAnim]}>
        {leftIcon && <AppIconNew name={leftIcon} color={colorsNew.muted} />}
        <TextInput
          maxFontSizeMultiplier={1.3}
          placeholderTextColor={colorsNew.muted}
          multiline={multiline}
          {...input}
          onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
          style={[{ flex: 1, fontFamily: khmer ? familyNew.khmer.regular : familyNew.body.regular, fontSize: 14, color: colorsNew.text, minHeight: multiline ? 90 : 52, textAlignVertical: multiline ? 'top' : 'center' }, style]}
        />
      </Animated.View>
    </View>
  );
}

/* ---------- underlined tabs ---------- */
export function UnderlineTabsNew({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  const reduced = useReducedMotion();
  const [frames, setFrames] = useState<Record<string, { x: number; w: number }>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    const f = frames[active];
    if (!f) return;
    const cfg = { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) };
    const glide = placed.current && !reduced;
    x.set(glide ? withTiming(f.x, cfg) : f.x);
    w.set(glide ? withTiming(f.w, cfg) : f.w);
    placed.current = true;
  }, [active, frames, reduced, x, w]);
  const ind = useAnimatedStyle(() => ({ width: w.value, transform: [{ translateX: x.value }] }));
  return (
    <View style={{ flexDirection: 'row', gap: 24, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: colorsNew.border }}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <PressableScaleNew key={t.key} onPress={() => onChange(t.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            onLayout={(e: LayoutChangeEvent) => {
              const { x: fx, width } = e.nativeEvent.layout;
              setFrames((p) => (p[t.key]?.x === fx && p[t.key]?.w === width ? p : { ...p, [t.key]: { x: fx, w: width } }));
            }}
            style={{ minHeight: 48, justifyContent: 'center' }}>
            <TextNew variant="title" weight="semibold" color={on ? SELECTED_INK : colorsNew.muted}>{t.label}</TextNew>
          </PressableScaleNew>
        );
      })}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, bottom: -1, height: 3, borderRadius: 2, backgroundColor: colorsNew.primary }, ind]} />
    </View>
  );
}

/* ---------- step dots (active dot stretches) ---------- */
function Dot({ active, done }: { active: boolean; done: boolean }) {
  const st = useAnimatedStyle(() => ({ width: withTiming(active ? 24 : 10, { duration: motionNew.base }) }));
  return <Animated.View style={[{ height: 10, borderRadius: 5, backgroundColor: active || done ? colorsNew.primary : colorsNew.track }, st]} />;
}
export function StepDotsNew({ total, index }: { total: number; index: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }} accessibilityLabel={`${index + 1}/${total}`}>
      {Array.from({ length: total }).map((_, i) => <Dot key={i} active={i === index} done={i < index} />)}
    </View>
  );
}

/* ---------- accordion row (open by default, foldable) ---------- */
export function AccordionNew({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const r = useSharedValue(defaultOpen ? 1 : 0);
  const reduced = useReducedMotion();
  const chev = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 180}deg` }] }));
  return (
    <View style={{ marginHorizontal: 16, borderBottomWidth: 1, borderColor: colorsNew.border }}>
      <PressableScaleNew scaleTo={0.985} accessibilityState={{ expanded: open }}
        onPress={() => { r.value = withTiming(open ? 0 : 1, { duration: 250 }); setOpen(!open); }}
        style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TextNew variant="title" weight="semibold">{title}</TextNew>
        <Animated.View style={chev}><AppIconNew name="down" color={colorsNew.muted} /></Animated.View>
      </PressableScaleNew>
      {open && (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(250)} exiting={reduced ? undefined : FadeOut.duration(150)} style={{ paddingBottom: 16 }}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}

/* ---------- ticket (cream, dashed tear line, notches) ---------- */
export function TicketNew({ eyebrow, title, subtitle, stubTop, stubBottom, onPress }: { eyebrow: string; title: string; subtitle?: string; stubTop: string; stubBottom?: string; onPress?: () => void }) {
  return (
    <PressableScaleNew scaleTo={motionNew.pressCard} onPress={onPress} style={{ marginHorizontal: 16, backgroundColor: colorsNew.cream, borderRadius: radiusNew.hero, flexDirection: 'row', overflow: 'hidden' }}>
      <View style={{ flex: 1, padding: 16, gap: 2 }}>
        <TextNew variant="caption" weight="semibold" color={colorsNew.creamEyebrow}>{eyebrow}</TextNew>
        <TextNew variant="section" color={colorsNew.creamStrong}>{title}</TextNew>
        {!!subtitle && <TextNew variant="meta" color={colorsNew.creamInk}>{subtitle}</TextNew>}
      </View>
      <View style={{ width: 84, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 2, borderStyle: 'dashed', borderColor: '#E3B96A' }}>
        <View style={{ position: 'absolute', left: -9, top: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: colorsNew.white }} />
        <View style={{ position: 'absolute', left: -9, bottom: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: colorsNew.white }} />
        <TextNew variant="meta" heading weight="extrabold" color={colorsNew.creamStrong} align="center">{stubTop}</TextNew>
        {!!stubBottom && <TextNew variant="meta" heading weight="extrabold" color={colorsNew.creamStrong} align="center">{stubBottom}</TextNew>}
      </View>
    </PressableScaleNew>
  );
}

/* ---------- loading / empty / error ---------- */
export function SkeletonNew({ width = '100%', height = 16, radius = 8, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  // 1.4s shimmer sweep, shaped by the caller (static under Reduce Motion).
  return <Skeleton width={width} height={height} radius={radius} style={style} />;
}
const EMPTY_ART: Partial<Record<AppIconNameNew, FeatureIconName>> = { bell: 'inbox', chat: 'inbox', x: 'error', search: 'noResults', heart: 'noResults' } as Partial<Record<AppIconNameNew, FeatureIconName>>;
export function EmptyStateNew({ icon, title, actionLabel, onAction }: { icon: AppIconNameNew; title: string; actionLabel?: string; onAction?: () => void; tone?: AccentNew }) {
  const focused = useIsFocused();
  const Art = featureIcons[EMPTY_ART[icon] ?? 'noResults'];
  return (
    <View style={{ alignItems: 'center', gap: 12, padding: 32 }}>
      <Art size={72} active={focused} />
      <TextNew variant="title" weight="semibold" align="center">{title}</TextNew>
      {!!actionLabel && <ButtonNew label={actionLabel} variant="tint" onPress={onAction} />}
    </View>
  );
}

/* ---------- looping gentle float (decorative shapes) ---------- */
export function FloatingShapeNew({ style, dx = 10, dy = 14, duration = 9000 }: { style: StyleProp<ViewStyle>; dx?: number; dy?: number; duration?: number }) {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => { if (!reduced) t.value = withRepeat(withSequence(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration, easing: Easing.inOut(Easing.sin) })), -1); }, [duration, reduced, t]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: -dx * t.value }, { translateY: dy * t.value }, { rotate: `${t.value * 6}deg` }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, style, a]} />;
}

/* ---------- pulsing live dot ---------- */
export function PulseDotNew({ color = colorsNew.primary, size = 8 }: { color?: string; size?: number }) {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => { if (!reduced) t.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1); }, [reduced, t]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - t.value), transform: [{ scale: 0.6 + t.value * 1.6 }] }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

export const cardBoxNew: ViewStyle = { backgroundColor: colorsNew.card, borderRadius: radiusNew.card, borderWidth: 1, borderColor: colorsNew.border, overflow: 'hidden', ...shadowNew.sm };
