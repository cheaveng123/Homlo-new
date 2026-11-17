import React from 'react';
import { Image, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { TextNew } from '../TextNew';
import { BoostIcon } from '@/src/components/icons/BoostIcon';
import { PhotoGlyph } from '@/src/components/icons/DashIcons';
import { useBoostCountdown } from '@/components/boost/useBoostCountdown';
import { cardShadow, dash, easeOut } from './dashTokens';

export type DashCardJob = {
  id: string;
  title: string;
  dateLabel: string;
  imageUri?: string;
  /** Hidden when null (no positions data). */
  positions?: { total: number; filled: number } | null;
  /** Accepted/total label from formatPositionsLabel, e.g. "3/5 positions". */
  positionsLeftLabel?: string;
  boost?: { endsAt: string; startsAt?: string | null; serverNow?: string | null } | null;
};

type Props = {
  job: DashCardJob;
  index: number;
  scrollY: SharedValue<number>;
  listTop: SharedValue<number>;
  viewportH: SharedValue<number>;
  focused: boolean;
  onPress: () => void;
  onPressMenu: () => void;
  onBoostExpire?: () => void;
};

const MAX_PIPS = 8;

/* ───────── lighting ───────── */

function TopLighting({ boosted }: { boosted: boolean }) {
  const c = boosted ? dash.amber : dash.cyan;
  const inset = boosted ? '6%' : '12%';
  const gid = boosted ? 'cardGlowA' : 'cardGlowC';
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height={70} style={s.glow}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="0%" rx="60%" ry="100%">
            <Stop offset="0" stopColor={c} stopOpacity={boosted ? 0.2 : 0.1} />
            <Stop offset="1" stopColor={c} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy={0} rx="60%" ry={70} fill={`url(#${gid})`} />
      </Svg>
      <LinearGradient
        colors={['transparent', boosted ? 'rgba(245,165,36,0.85)' : 'rgba(8,145,178,0.7)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.topLine, { left: inset, right: inset }]}
      />
    </View>
  );
}

/** Amber haze above a boosted card (a gradient view: Android cannot tint shadows). */
function BoostHalo() {
  return (
    <View pointerEvents="none" style={s.halo}>
      <Svg width="100%" height={56}>
        <Defs>
          <RadialGradient id="halo" cx="50%" cy="55%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={dash.amber} stopOpacity={0.3} />
            <Stop offset="1" stopColor={dash.amber} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy={30} rx="50%" ry={26} fill="url(#halo)" />
      </Svg>
    </View>
  );
}

/* ───────── boost ───────── */

function BoostBlock({ boost, onExpire, focused, revealed }: {
  boost: NonNullable<DashCardJob['boost']>; onExpire?: () => void; focused: boolean; revealed: SharedValue<number>;
}) {
  const reduced = useReducedMotion();
  const { label, expired, remainingMs } = useBoostCountdown(boost.endsAt, boost.serverNow ?? undefined, onExpire);
  const start = boost.startsAt ? Date.parse(boost.startsAt) : NaN;
  const end = Date.parse(boost.endsAt);
  const total = end - start;
  // The bar needs a start date; without one we hide it rather than guess the duration.
  const ratio = Number.isFinite(total) && total > 0 ? Math.min(Math.max(remainingMs / total, 0), 1) : null;

  const fill = useSharedValue(reduced ? 1 : 0);
  const shimmer = useSharedValue(0);
  useAnimatedReaction(
    () => revealed.value,
    (v, prev) => {
      if (reduced || v !== 1 || prev === 1) return;
      fill.value = withDelay(350, withTiming(1, { duration: 1000, easing: easeOut }));
      shimmer.value = withDelay(1400, withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }), -1, false));
    },
  );
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  const shimmerStyle = useAnimatedStyle(() => ({ left: `${-40 + 140 * shimmer.value}%` }));

  if (expired || !label) return null;
  return (
    <View style={s.boostRow} accessibilityLabel={`Boosted, ${label} left`}>
      <BoostIcon size={34} active={focused} />
      <View style={s.boostBody}>
        <View style={s.boostTop}>
          <TextNew variant="meta" heading weight="bold" color="#A8620B" style={s.boostTitle}>Boosted</TextNew>
          <TextNew variant="caption" weight="semibold" color={dash.muted} numberOfLines={1}>{label} left</TextNew>
        </View>
        {ratio != null ? (
          <View style={s.track}>
            <Animated.View style={[s.fillWrap, { width: `${ratio * 100}%` }, fillStyle, s.fillOrigin]}>
              <LinearGradient colors={[dash.amber, '#EF8A3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              {!reduced ? (
                <Animated.View style={[s.shimmer, shimmerStyle]}>
                  <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                </Animated.View>
              ) : null}
            </Animated.View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ───────── positions ───────── */

function Pip({ filled, index, revealed }: { filled: boolean; index: number; revealed: SharedValue<number> }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);
  useAnimatedReaction(
    () => revealed.value,
    (v, prev) => {
      if (reduced || v !== 1 || prev === 1) return;
      t.value = withDelay(500 + index * 45, withTiming(1, { duration: 300, easing: easeOut }));
    },
  );
  const a = useAnimatedStyle(() => ({ transform: [{ scaleX: t.value }] }));
  return <Animated.View style={[s.pip, { backgroundColor: filled ? dash.cyan : '#D5E6EA' }, a]} />;
}

function Positions({ total, filled, label, revealed }: { total: number; filled: number; label: string; revealed: SharedValue<number> }) {
  // "3/5 positions": the count is bold ink, the word stays muted.
  const m = /^(\d+\/\d+)(.*)$/.exec(label);
  // Long rosters are drawn as MAX_PIPS pips filled in proportion, so the row never overflows.
  const count = Math.min(total, MAX_PIPS);
  const filledPips = total <= MAX_PIPS ? Math.min(filled, total) : Math.round((Math.min(filled, total) / total) * MAX_PIPS);
  return (
    <View style={s.posRow}>
      <TextNew variant="caption" color={dash.muted} numberOfLines={1} style={s.posText}>
        <TextNew variant="body" heading weight="bold" color={dash.ink}>{m ? m[1] : label}</TextNew>
        {m ? m[2] : null}
      </TextNew>
      <View style={s.pips} accessibilityLabel={`${filled} of ${total} filled`}>
        {Array.from({ length: count }, (_, i) => <Pip key={i} index={i} filled={i < filledPips} revealed={revealed} />)}
      </View>
    </View>
  );
}

/* ───────── card ───────── */

export function DashJobCardNew({ job, index, scrollY, listTop, viewportH, focused, onPress, onPressMenu, onBoostExpire }: Props) {
  const reduced = useReducedMotion();
  const y = useSharedValue(-1);
  const h = useSharedValue(0);
  const revealed = useSharedValue(reduced ? 1 : 0);
  const enter = useSharedValue(reduced ? 1 : 0);
  const press = useSharedValue(1);
  const boosted = !!job.boost;

  // Reveal once when 18% of the card is inside the viewport.
  useAnimatedReaction(
    () => {
      if (y.value < 0 || h.value === 0) return false;
      const top = listTop.value + y.value - scrollY.value;
      return top + h.value * 0.18 < viewportH.value && top + h.value * 0.82 > 0;
    },
    (visible) => {
      if (!visible || revealed.value === 1) return;
      revealed.value = 1;
      enter.value = withDelay(index * 50, withTiming(1, { duration: 600, easing: easeOut }));
    },
  );

  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: 22 * (1 - enter.value) }, { scale: (0.98 + 0.02 * enter.value) * press.value }],
  }));
  const photoStyle = useAnimatedStyle(() => {
    if (reduced || h.value === 0) return { transform: [{ scale: 1.12 }] };
    const center = listTop.value + y.value + h.value / 2 - scrollY.value;
    // Clamp to the 1.12x overscan so the photo edge never shows inside its frame.
    const room = h.value * 0.05;
    const shift = Math.min(room, Math.max(-room, -(center - viewportH.value / 2) * 0.045));
    return { transform: [{ translateY: shift }, { scale: 1.12 }] };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    y.value = e.nativeEvent.layout.y;
    h.value = e.nativeEvent.layout.height;
  };

  return (
    <Animated.View onLayout={onLayout} style={[s.outer, cardStyle]}>
      {boosted ? <BoostHalo /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={job.title}
        onPress={onPress}
        onPressIn={() => { if (!reduced) press.set(withTiming(0.985, { duration: 120 })); }}
        onPressOut={() => { if (!reduced) press.set(withSpring(1, { damping: 16, stiffness: 300 })); }}
        style={[s.card, cardShadow]}
      >
        <View style={s.clip} pointerEvents="none">
          <TopLighting boosted={boosted} />
        </View>
        <View style={s.row}>
          <View style={s.photo}>
            {job.imageUri ? (
              <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
                <Image source={{ uri: job.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              </Animated.View>
            ) : (
              <LinearGradient colors={['#EEF5F7', '#D2E1E6']} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={s.placeholder}>
                <View style={s.glyph}><PhotoGlyph /></View>
                <TextNew variant="caption" weight="semibold" color="#6D8C97" style={s.photoLabel}>Photo</TextNew>
              </LinearGradient>
            )}
          </View>

          <View style={s.details}>
            <View>
              <View style={s.topRow}>
                <TextNew variant="meta" color={dash.muted} numberOfLines={1} style={s.flex}>{job.dateLabel}</TextNew>
                <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={onPressMenu} hitSlop={8} style={s.menu}>
                  <View style={s.dots}>
                    {[0, 1, 2].map((i) => <View key={i} style={s.dotDot} />)}
                  </View>
                </Pressable>
              </View>
              <TextNew variant="header" heading weight="bold" color={dash.ink} numberOfLines={2} style={s.title}>{job.title}</TextNew>
              {job.boost ? <BoostBlock boost={job.boost} onExpire={onBoostExpire} focused={focused} revealed={revealed} /> : null}
            </View>
            {job.positions && job.positions.total > 0 ? (
              <Positions {...job.positions} label={job.positionsLeftLabel ?? `${job.positions.filled}/${job.positions.total}`} revealed={revealed} />
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  outer: { marginTop: 14 },
  halo: { position: 'absolute', left: 16, right: 16, top: -22, height: 56 },
  card: { borderRadius: 22, padding: 12, borderWidth: 1, borderColor: dash.line, backgroundColor: dash.surface },
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22, overflow: 'hidden' },
  glow: { position: 'absolute', top: 0, left: 0 },
  topLine: { position: 'absolute', top: 0, height: 2 },
  row: { flexDirection: 'row', gap: 14 },
  photo: { width: 92, minHeight: 116, alignSelf: 'stretch', borderRadius: 16, overflow: 'hidden', backgroundColor: '#E4EEF1' },
  placeholder: { flex: 1, alignItems: 'center' },
  glyph: { position: 'absolute', top: '50%', marginTop: -22 },
  photoLabel: { position: 'absolute', bottom: 10, fontSize: 11, lineHeight: 14 },
  details: { flex: 1, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', alignItems: 'center', minHeight: 30 },
  flex: { flex: 1 },
  menu: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  dots: { flexDirection: 'row', gap: 3 },
  dotDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: dash.muted },
  title: { fontSize: 20, lineHeight: 25, letterSpacing: -0.2, marginTop: 2, marginBottom: 8 },
  boostRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boostBody: { flex: 1 },
  boostTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  boostTitle: { fontSize: 13 },
  track: { marginTop: 6, height: 4, borderRadius: 2, backgroundColor: 'rgba(217,145,43,0.22)', overflow: 'hidden' },
  fillWrap: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fillOrigin: { transformOrigin: 'left' },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: '40%' },
  posRow: { marginTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  posText: { flexShrink: 1, fontSize: 12.5 },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { width: 13, height: 5, borderRadius: 3, transformOrigin: 'left' },
});
