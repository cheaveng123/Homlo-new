/**
 * Home header in the Post page's style: a calm cyan gradient, frosted controls, custom
 * glyphs, and a search bar that sits on the edge of the white content sheet. On scroll the
 * background lags behind (parallax) while the content drifts up and fades into the sheet.
 * Pure UI.
 */
import { ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from '@/lib/native/linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { TextNew } from '../TextNew';
import { PressableScaleNew } from '../PrimitivesNew';
import { RotatingPlaceholderNew } from '../SearchPillNew';
import { SMOOTH, smooth } from '@/src/design/motion';

const C = {
  cyan: '#0891B2',
  cyanDeep: '#0B6F8A',
  glow: '#2DBAD4',
  navy: '#14324A',
  amber: '#F5A524',
  muted: '#6A7C84',
  white: '#FFFFFF',
} as const;

/* ───────── custom glyphs (1.8 line, rounded, one solid signature detail) ───────── */

/** Map pin: rounded drop, amber heart-dot, a little ground shadow. */
export function PinGlyph({ size = 18, color = C.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Ellipse cx={12} cy={21} rx={4} ry={1.2} fill={color} opacity={0.35} />
      <Path d="M12 2.8a6.8 6.8 0 0 1 6.8 6.8c0 4.6-5 9.1-6.2 10.1a.9.9 0 0 1-1.2 0C10.2 18.7 5.2 14.2 5.2 9.6A6.8 6.8 0 0 1 12 2.8Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={12} cy={9.6} r={2.6} fill={color} />
    </Svg>
  );
}

function ChevronGlyph({ size = 14, color = C.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="m4 6.2 4 3.8 4-3.8" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Heart with a small gloss tick in the upper-left lobe. */
function HeartGlyph({ size = 22, color = C.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20.2s-7.8-4.6-7.8-10.4a4.5 4.5 0 0 1 7.8-3 4.5 4.5 0 0 1 7.8 3c0 5.8-7.8 10.4-7.8 10.4Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M7.3 9.2a2 2 0 0 1 1.6-1.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** Magnifier: ring, angled handle, cyan spark inside the lens. */
function SearchGlyph({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={10.5} cy={10.5} r={6.3} stroke={C.navy} strokeWidth={1.9} />
      <Path d="m15.3 15.3 4.6 4.6" stroke={C.navy} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M8 8.6a3 3 0 0 1 2.4-1.5" stroke={C.cyan} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

/** Filter: two bold rails with round knobs that glide when pressed. 26pt, clear on navy. */
/** Exported so Explore uses the exact same filter icon as Home. */
export function FilterGlyph({ on }: { on: boolean }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => { t.value = reduced ? (on ? 1 : 0) : smooth(on ? 1 : 0, 320); }, [on, reduced, t]);
  const k1 = useAnimatedStyle(() => ({ transform: [{ translateX: 8 * t.value }] }));
  const k2 = useAnimatedStyle(() => ({ transform: [{ translateX: -8 * t.value }] }));
  const knob = (x: number, y: number, a: object) => (
    <Animated.View style={[st.knob, { left: x - 6, top: y - 6 }, a]} />
  );
  return (
    <View style={{ width: 26, height: 26 }}>
      <Svg width={26} height={26} viewBox="0 0 26 26" fill="none">
        <Path d="M4 8.5h18M4 17.5h18" stroke={C.white} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
      {knob(9, 8.5, k1)}
      {knob(17, 17.5, k2)}
    </View>
  );
}

/* ───────── controls ───────── */

function SavedButton({ count, onPress }: { count?: number; onPress: () => void }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (reduced || !count) return;
    s.value = withDelay(500, withSequence(withTiming(1.08, { duration: 160 }), withTiming(1, { duration: 260, easing: SMOOTH })));
  }, [count, reduced, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <PressableScaleNew onPress={onPress} scaleTo={0.92} accessibilityLabel="Saved jobs" style={st.glassBtn}>
      <Animated.View style={a}><HeartGlyph /></Animated.View>
      {!!count && count > 0 && (
        <View style={st.badge}>
          <TextNew variant="caption" heading weight="extrabold" color={C.navy} style={st.badgeText}>{count > 99 ? '99+' : count}</TextNew>
        </View>
      )}
    </PressableScaleNew>
  );
}

function LocationChip({ label, caption, onPress }: { label: string; caption: string; onPress: () => void }) {
  return (
    <PressableScaleNew onPress={onPress} scaleTo={0.97} accessibilityLabel={`${caption}: ${label}`} style={st.chip}>
      <View style={st.chipIcon}><PinGlyph size={18} /></View>
      <View style={{ flexShrink: 1 }}>
        <TextNew variant="caption" weight="medium" color="rgba(255,255,255,0.78)" style={st.chipCaption}>{caption}</TextNew>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TextNew variant="title" heading weight="extrabold" color={C.white} numberOfLines={1} style={st.chipCity}>{label}</TextNew>
          <ChevronGlyph />
        </View>
      </View>
    </PressableScaleNew>
  );
}

/** White search pill with the custom glyphs and the rotating placeholder. */
export function SearchBarHome({ prefix, words, placeholder, onPress, onFilter }: {
  prefix: string; words: string[]; placeholder?: ReactNode; onPress: () => void; onFilter: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <View style={st.searchShadow}>
      <PressableScaleNew onPress={onPress} scaleTo={0.99} accessibilityLabel="Search" style={st.search}>
        <SearchGlyph />
        <View style={{ flex: 1 }}>{placeholder ?? <RotatingPlaceholderNew prefix={prefix} words={words} />}</View>
        <PressableScaleNew onPress={onFilter} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
          scaleTo={0.92} accessibilityLabel="Filters" style={st.filter}>
          <FilterGlyph on={pressed} />
        </PressableScaleNew>
      </PressableScaleNew>
    </View>
  );
}

/* ───────── hero ───────── */

export const HERO_SHEET_OVERLAP = 28;

export function HomeHeroNew({ topInset, scrollY, title, locationCaption, locationLabel, onPressLocation, savedCount, onPressSaved }: {
  topInset: number; scrollY: SharedValue<number>; title: string; locationCaption: string; locationLabel: string;
  onPressLocation: () => void; savedCount?: number; onPressSaved: () => void;
}) {
  const reduced = useReducedMotion();
  const [h, setH] = useState(300);
  // Background: lags behind the scroll; stretches from the bottom when pulled down.
  const bg = useAnimatedStyle(() => {
    const y = scrollY.value;
    if (reduced) return {};
    if (y < 0) return { transform: [{ translateY: y / 2 }, { scaleY: 1 + -y / h }] };
    return { transform: [{ translateY: y * 0.4 }] };
  });
  // Content: drifts up a little slower than the page and fades out before the search bar pins.
  const content = useAnimatedStyle(() => {
    const y = Math.max(scrollY.value, 0);
    if (reduced) return { opacity: interpolate(y, [0, h * 0.5], [1, 0], Extrapolation.CLAMP) };
    return {
      opacity: interpolate(y, [0, h * 0.45], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: y * 0.35 },
        { scale: interpolate(y, [0, h * 0.5], [1, 0.95], Extrapolation.CLAMP) },
      ],
    };
  });
  return (
    <View style={[st.hero, { paddingTop: topInset + 14 }]} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, bg]}>
        <LinearGradient colors={['#0A7A95', '#0B87A3', '#0C8FAB']} locations={[0, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="homeHeroGlow" cx="92%" cy="0%" rx="70%" ry="60%">
              <Stop offset="0" stopColor={C.glow} stopOpacity={0.35} />
              <Stop offset="1" stopColor={C.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#homeHeroGlow)" />
        </Svg>
      </Animated.View>

      <Animated.View style={content}>
        <View style={st.topRow}>
          <TextNew variant="hero" heading weight="extrabold" color={C.white} style={st.title} numberOfLines={2}>{title}</TextNew>
          <SavedButton count={savedCount} onPress={onPressSaved} />
        </View>
        <View style={{ marginTop: 14, alignSelf: 'flex-start', maxWidth: '100%' }}>
          <LocationChip label={locationLabel} caption={locationCaption} onPress={onPressLocation} />
        </View>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingBottom: 26 + 26 + HERO_SHEET_OVERLAP, overflow: 'visible' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  glassBtn: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  badge: {
    position: 'absolute', top: -4, right: -4, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11,
    backgroundColor: C.white, borderWidth: 2, borderColor: '#0B87A3', alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 6, paddingRight: 16, paddingVertical: 6,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)',
  },
  chipIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  chipCaption: { fontSize: 11, lineHeight: 14 },
  chipCity: { fontSize: 17, lineHeight: 22, flexShrink: 1 },
  searchShadow: {
    borderRadius: 26, shadowColor: '#06425A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 22, elevation: 8,
  },
  search: {
    height: 52, borderRadius: 26, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 5,
  },
  knob: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: C.white, borderWidth: 2.5, borderColor: C.navy },
  filter: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
});
