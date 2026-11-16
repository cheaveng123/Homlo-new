/**
 * ExploreCategoryJobsWaveGradientHeaderScreen.tsx
 * Homlo Jobs - "Explore jobs" category detail page (gradient header, slow shine, slow wave,
 * floating custom icon, scroll-linked collapse transition).
 *
 * Visual layer only. Data fetching, navigation, search, sorting, employer taps and job taps
 * all stay with the route in `app/category-listing.tsx`, which owns the tRPC query and passes
 * the app's real data and handlers in as props.
 *
 * Custom icon: assets/images/detailcategorypage.png - see ICON_SOURCE below.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, ViewStyle } from 'react-native';
import Animated, {
  Easing, FadeInDown, interpolate, Extrapolation, useAnimatedReaction, useAnimatedScrollHandler,
  useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { AppIcon } from '@/components/ui/AppIcon';
import { LegacyRowListSkeleton } from '@/src/new/components/NewSkeletons';

import { colors } from '@/theme';
import { fonts } from '@/lib/typography';

/* ───────────── custom icon ───────────── */
/**
 * `assets/images/detail-category-icons.png` was not available, so the page ships with
 * `detailcategorypage.png` instead. Swap this one line to change the artwork:
 *   require('../../assets/images/detail-category-icons.png')
 */
const ICON_SOURCE: number | null = require('../../assets/images/detailcategorypage.png');

/**
 * Rendered size of the floating artwork, in dp.
 *
 * The source PNG is 1536x1024 (3:2) on a transparent background, with a near-circular
 * opaque blob spanning y 14%-92% of the frame and averaging `#7A997D`. Since `resizeMode`
 * is `contain`, the *width* is the binding dimension and the blob's real height lands at
 * roughly two thirds of this. Enlarged 30% from the original 110 so it reads as a proper
 * hero piece beside the category title on a 390pt phone without squeezing the copy.
 */
const ICON_SIZE = 143;

/* ───────────── wave geometry ───────────── */
/** Height of the paper-coloured wave that closes the hero (see WaveEdge). */
const WAVE_H = 48;
/** The wave's centreline — the exact seam where the green hero meets the paper page. */
const WAVE_MID = WAVE_H / 2;

/* ───────────── tokens ───────────── */
// The hero greens are carried over from the page this screen replaces, so the redesign
// still reads as the same surface. `forest` / `mint` have no canonical name in `@/theme`
// (it ships a different green and a pale mint), so they stay explicit here with the same
// hexes used across the job surfaces.
const HERO = { deep: '#116B47', base: '#1D8A5C', light: '#2FAE79' };
const FOREST = '#0E3B2E';
const MINT = '#0F9D62';
const ON_HERO = 'rgba(255,255,255,0.85)';

const AView = Animated.View;
const SMOOTH = Easing.bezier(0.22, 1, 0.36, 1);

/* ───────────── types ───────────── */
/** Mirrors the listing shape `app/category-listing.tsx` already builds. */
export type ExploreJob = {
  id: string;
  title: string;
  employerName: string;
  employerColor: string;
  payLabel: string;
  locationLabel?: string | null;
  positionsLeft?: number | null;
  positionsTotal?: number | null;
};
export type ExploreEmployer = { id: string; initial: string; name: string; bg: string };

type Props = {
  /** Small nav title above the category name. Defaults to "Explore jobs". */
  title?: string;
  /** e.g. "Plumbing & trades jobs". */
  categoryTitle: string;
  /** e.g. "128 jobs near you". */
  countLabel?: string;
  employers: ExploreEmployer[];
  jobs: ExploreJob[];
  jobsLoading?: boolean;
  onBack: () => void;
  /** Optional: the route currently has no search destination, so this stays inert. */
  onSearchPress?: () => void;
  onEmployerPress?: (id: string) => void;
  onJobPress: (id: string) => void;
  /** Optional: the route has no sort control yet, so this stays inert. */
  onSortPress?: () => void;
  /**
   * Required, and intentionally so: the app has a real job card, so there is no built-in
   * fallback here that could silently ship a placeholder instead of it. `onPress` is supplied
   * by the screen so the tap path lives in one place (`onJobPress`) rather than being
   * re-implemented at every call site.
   */
  renderJobCard: (job: ExploreJob, index: number, onPress: () => void) => React.ReactNode;
};

/* ───────────── header background: gradient + slow shine + soft glow ───────────── */
function HeaderBackdrop({ width, height, reduceMotion }: { width: number; height: number; reduceMotion: boolean }) {
  const shine = useSharedValue(0);
  const glow = useSharedValue(0);

  // Reduce Motion: never start the loops, so the band and the glow hold still.
  useEffect(() => {
    if (reduceMotion) return;
    shine.value = withRepeat(withSequence(
      withTiming(1, { duration: 8500, easing: Easing.inOut(Easing.quad) }),
      withTiming(1, { duration: 5500 }),           // rest between sweeps
      withTiming(0, { duration: 0 }),
    ), -1);
    glow.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduceMotion, shine, glow]);

  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shine.value, [0, 1], [-width * 0.9, width * 1.3]) }, { skewX: '-20deg' }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(glow.value, [0, 1], [0, -60]) },
      { translateY: interpolate(glow.value, [0, 1], [0, 50]) },
      { scale: interpolate(glow.value, [0, 1], [1, 1.15]) },
    ],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      <LinearGradient
        colors={[HERO.deep, HERO.base, HERO.light]}
        locations={[0, 0.7, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <AView style={[{ position: 'absolute', top: -height * 0.4, height: height * 1.8, width: width * 0.55 }, shineStyle]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </AView>
      <AView style={[{ position: 'absolute', right: -120, top: -140, width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(124,255,181,0.14)' }, glowStyle]} />
    </View>
  );
}

/* ───────────── slow-moving wave edge ───────────── */
function WaveEdge({ width, reduceMotion }: { width: number; reduceMotion: boolean }) {
  const x = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    x.value = withRepeat(withTiming(-width, { duration: 26000, easing: Easing.linear }), -1);
  }, [width, reduceMotion, x]);

  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // Two tiles' worth of wave, slid one tile-width at a time so the loop is seamless.
  const d = useMemo(() => {
    const h = width / 2;
    return `M0 ${WAVE_MID} q${h / 2} -22 ${h} 0 t${h} 0 t${h} 0 t${h} 0 L${width * 2} ${WAVE_H} L0 ${WAVE_H} Z`;
  }, [width]);

  return (
    <View style={styles.wave} pointerEvents="none">
      <AView style={[{ width: width * 2, height: WAVE_H }, st]}>
        <Svg width={width * 2} height={WAVE_H} viewBox={`0 0 ${width * 2} ${WAVE_H}`}>
          <Path d={d} fill={colors.pageBg} />
        </Svg>
      </AView>
    </View>
  );
}

/* ───────────── floating custom icon ───────────── */
function FloatingIcon({ reduceMotion, style }: { reduceMotion: boolean; style?: ViewStyle }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    t.value = withRepeat(withSequence(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
    ), -1);
  }, [reduceMotion, t]);

  // With reduce motion on, the icon sits perfectly still rather than holding a static tilt.
  const st = useAnimatedStyle(() => (reduceMotion
    ? {}
    : {
      transform: [
        { translateY: interpolate(t.value, [0, 1], [0, -7]) },
        { rotate: `${interpolate(t.value, [0, 1], [-1.5, 1.5])}deg` },
      ],
    }));

  return (
    <AView style={[{ width: ICON_SIZE, height: ICON_SIZE }, style, st]}>
      {/* Feathered halo. The artwork is a hard-edged, pale sage blob on an otherwise
          saturated green gradient, so its silhouette terminates abruptly and reads as
          pasted on. This radial wash in the blob's own tone sits behind it and fades to
          nothing well before the container edge, so the shape melts into the hero rather
          than ending on a visible contour. The radius tracks the blob's real footprint
          (~133x78pt once `contain` has fitted the 3:2 art into the square box), so the
          glow hugs the shape instead of hanging as a ball around empty padding. */}
      <Svg width={ICON_SIZE} height={ICON_SIZE} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="iconHalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#9BD9B4" stopOpacity={0.55} />
            <Stop offset="0.45" stopColor="#8ACFA6" stopOpacity={0.34} />
            <Stop offset="0.75" stopColor="#5CBE8C" stopOpacity={0.12} />
            <Stop offset="1" stopColor={HERO.base} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={ICON_SIZE / 2} cy={ICON_SIZE / 2} r={ICON_SIZE * 0.44} fill="url(#iconHalo)" />
      </Svg>
      {ICON_SOURCE ? (
        // Slightly knocked back so the pale artwork sits closer to the hero's value range
        // instead of punching a light hole in it.
        <Animated.Image
          source={ICON_SOURCE}
          style={{ width: '100%', height: '100%', opacity: 0.94 }}
          resizeMode="contain"
        />
      ) : null}
    </AView>
  );
}

/* ───────────── screen ───────────── */
export default function ExploreCategoryJobsWaveGradientHeaderScreen({
  title = 'Explore jobs', categoryTitle, countLabel, employers, jobs, jobsLoading,
  onBack, onSearchPress, onEmployerPress, onJobPress, onSortPress, renderJobCard,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  const [compact, setCompact] = useState(false);
  // Hero is content-sized, so this only sizes the backdrop's glow/shine layer, which
  // is absolutely positioned and would otherwise scale off-screen. 250 (was 330) tracks
  // the hero shrinking again: the artwork left the flow to sit on the wave seam and
  // the paddings tightened.
  const headerH = 250 + insets.top;

  // "Plumbing & trades jobs" -> "Popular in Plumbing & trades", as before.
  const shortLabel = categoryTitle.replace(/ jobs$/i, '');

  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
  useAnimatedReaction(() => y.value > 140, (now, prev) => { if (now !== prev) scheduleOnRN(setCompact, now); });

  // Header content moves slower than the page (parallax) and softly fades/shrinks the icon.
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(y.value, [0, 300], [0, 90], Extrapolation.CLAMP) }],
    opacity: interpolate(y.value, [0, 200], [1, 0], Extrapolation.CLAMP),
  }));
  const iconWrap = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(y.value, [0, 220], [0, 36], Extrapolation.CLAMP) },
      { scale: interpolate(y.value, [0, 220], [1, 0.7], Extrapolation.CLAMP) },
    ],
  }));
  // Pull-down overscroll: header stretches instead of showing a blank gap.
  const stretch = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(y.value, [-200, 0], [-100, 0], Extrapolation.CLAMP) },
      { scale: interpolate(y.value, [-200, 0], [1.25, 1], Extrapolation.CLAMP) },
    ],
  }));
  const bar = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [90, 170], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [90, 170], [-10, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.root}>
      {/* Compact bar that fades in as the big header collapses. `compact` is the JS mirror of
          the fade, and it gates pointerEvents so the buttons can't be tapped while invisible. */}
      <AView
        style={[styles.compactBar, { paddingTop: insets.top + 8 }, bar]}
        pointerEvents={compact ? 'auto' : 'none'}
      >
        <LinearGradient
          colors={[HERO.deep, HERO.base]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Pressable onPress={onBack} style={styles.roundBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <AppIcon name="back" size={20} color={colors.cardBg} />
        </Pressable>
        <Text style={styles.compactTitle} numberOfLines={1}>{shortLabel}</Text>
        <Pressable onPress={onSearchPress} style={styles.roundBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Search within this category">
          <AppIcon name="search" size={18} color={colors.cardBg} />
        </Pressable>
      </AView>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Content-sized rather than a fixed height. The hero stack (nav, title, icon,
            search, employers) is taller than the old hard-coded height, so a wave pinned
            to the container's bottom edge cut straight through the employer row. Sizing to
            the content lets the wave sit in normal flow directly underneath it. */}
        <View>
          <AView style={[StyleSheet.absoluteFill, stretch]}>
            <HeaderBackdrop width={width} height={headerH} reduceMotion={reduceMotion} />
          </AView>

          <AView style={[{ paddingTop: insets.top + 6, paddingHorizontal: 20, paddingBottom: 10 }, contentStyle]}>
            <View style={styles.nav}>
              <Pressable onPress={onBack} style={styles.roundBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
                <AppIcon name="back" size={20} color={colors.cardBg} />
              </Pressable>
              <Text style={styles.navTitle} numberOfLines={1}>{title}</Text>
              <View style={{ width: 42 }} />
            </View>

            {/* Category copy only. The floating artwork no longer rides in the hero's
                flow — it is pinned to the wave seam further down, which is also what
                keeps the green block short. */}
            <View style={styles.mid}>
              <View style={styles.midCopy}>
                {countLabel ? <Text style={styles.count}>{countLabel}</Text> : null}
                <Text style={styles.cat}>{categoryTitle}</Text>
              </View>
            </View>

            <Pressable onPress={onSearchPress} style={styles.search} accessibilityRole="search" accessibilityLabel="Search within this category">
              <AppIcon name="search" size={18} color={ON_HERO} />
              <Text style={styles.searchTx}>Search within {shortLabel}</Text>
            </Pressable>

            <View style={styles.empBlock}>
              {/* Sort rides with the block's label instead of marooning itself on its
                  own row at the far right, so the hero reads as one stacked group. */}
              <View style={styles.empHead}>
                <Text style={styles.empLabel}>Top employers hiring</Text>
                <Pressable onPress={onSortPress} style={styles.sort} hitSlop={8} accessibilityRole="button" accessibilityLabel="Sort jobs">
                  <Text style={styles.sortTx}>Sort</Text>
                  <AppIcon name="chevron" size={14} color={MINT} style={{ transform: [{ rotate: "90deg" }] }} />
                </Pressable>
              </View>
              <View style={styles.empRowWrap}>
                <Animated.ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.empRow}
                >
                  {employers.map((e) => (
                    <Pressable
                      key={e.id}
                      onPress={() => onEmployerPress?.(e.id)}
                      style={styles.emp}
                      accessibilityRole="button"
                      accessibilityLabel={e.name}
                    >
                      <View style={[styles.empAv, { backgroundColor: e.bg }]}>
                        <Text style={styles.empInit}>{e.initial}</Text>
                      </View>
                      <Text style={styles.empName} numberOfLines={1}>{e.name}</Text>
                    </Pressable>
                  ))}
                </Animated.ScrollView>
              </View>
            </View>
          </AView>

          {/* Hero's bottom edge: a paper-coloured wave that resolves the gradient into the
              page below. Placed after the employers in flow, not absolutely positioned. */}
          <WaveEdge width={width} reduceMotion={reduceMotion} />

          {/* The custom artwork is pinned to the wave's centreline so it straddles the
              seam: half over the green hero, half over the paper page. Absolutely
              positioned so it adds no height to the green block. */}
          <AView style={[styles.iconOnLine, iconWrap]} pointerEvents="none">
            <FloatingIcon reduceMotion={reduceMotion} />
          </AView>
        </View>

        {/* paddingTop clears the artwork's overhang below the seam (at the enlarged
            size the icon dips ~17.5pt past the seam) and gives the first card
            breathing room. */}
        <View style={{ paddingHorizontal: 20, paddingTop: 26, gap: 16 }}>
          {jobsLoading ? (
            <LegacyRowListSkeleton gap={16} style={{ paddingHorizontal: 0 }} />
          ) : (
            jobs.map((job, i) => (
              <AView key={job.id} entering={FadeInDown.delay(Math.min(i, 6) * 70).duration(420).easing(SMOOTH)}>
                {renderJobCard(job, i, () => onJobPress(job.id))}
              </AView>
            ))
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

/* ───────────── styles ───────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  compactBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12,
  },
  compactTitle: { flex: 1, fontFamily: fonts.heading.extrabold, fontSize: 18, color: colors.cardBg },
  roundBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center',
  },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.heading.extrabold, fontSize: 20, color: colors.cardBg },
  // Hero vertical rhythm. The mid row is copy only — the artwork lives on the
  // wave seam (iconOnLine), so nothing in this stack competes with it.
  mid: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  midCopy: { flex: 1, paddingRight: 12 },
  count: { fontFamily: fonts.body.semibold, fontSize: 13, color: ON_HERO },
  cat: { fontFamily: fonts.heading.extrabold, fontSize: 26, lineHeight: 30, color: colors.cardBg, letterSpacing: -0.5, marginTop: 2 },
  search: {
    height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.17)',
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginTop: 14,
  },
  searchTx: { fontFamily: fonts.body.regular, fontSize: 15, color: ON_HERO },
  // zIndex keeps the seam artwork painted above the wave and the backdrop.
  empBlock: { zIndex: 1, marginTop: 18 },
  empHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empLabel: { fontFamily: fonts.body.semibold, fontSize: 13, color: colors.cardBg, opacity: 0.9 },
  empRowWrap: { marginTop: 8 },
  empRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 8 },
  emp: { width: 62, alignItems: 'center' },
  empAv: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  empInit: { fontFamily: fonts.heading.extrabold, fontSize: 18, color: colors.cardBg },
  empName: { fontFamily: fonts.body.medium, fontSize: 11, color: colors.cardBg },
  // The icon sits at the right edge of the hero, its centre held 30pt above the wave
  // seam so it rides almost entirely on the green gradient. At the enlarged 143dp its
  // lower edge dips ~17.5pt past the seam, which the job list's paddingTop clears.
  iconOnLine: {
    position: 'absolute',
    right: 20,
    bottom: WAVE_MID - ICON_SIZE / 2 + 30,
    zIndex: 2,
  },
  // Sits in normal flow at the foot of the hero, so it always clears the employer row.
  wave: { height: WAVE_H, overflow: 'hidden' },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortTx: { fontFamily: fonts.body.semibold, fontSize: 13, color: MINT },
});