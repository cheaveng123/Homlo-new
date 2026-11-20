/**
 * Explore building blocks (presentational). Search pill with a rotating word, icon
 * tabs with a sliding amber indicator, section header with an arrow button, photo
 * job cards for horizontal rails, employer cards and the "didn't find it" banner.
 */
import React, { useEffect, useState } from 'react';
import { Image, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { TextNew } from '@/src/new/components/TextNew';
import { PressableScaleNew } from '@/src/new/components/PrimitivesNew';
import { Skeleton } from '@/src/design/primitives';
import { SMOOTH, smooth } from '@/src/design/motion';
import { haptic } from '@/lib/haptics';
import {
  AdMegaphone, ArrowRight, BellArt,
  PersonGlyph, PhotoGlyph, SearchGlyph, SectionIcon, SmallPin, type SectionIconName,
} from './ExploreGlyphs';
import { EmployersTabIcon, JobsTabIcon, MapTabIcon } from './TabIcons3D';
import { EX, shadowCard, shadowSearch, shadowSoft } from './tokens';
import { FilterGlyph as HomeFilterGlyph } from '@/src/new/components/home/HomeHeaderNew';

/* ───────── search pill ───────── */

const WORDS = ['jobs', 'near you', 'part-time', 'cafés', 'drivers'];

function RotatingWord() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % WORDS.length), 2600);
    return () => clearInterval(id);
  }, []);
  return (
    <Animated.View key={i} entering={reduced ? undefined : FadeInDown.duration(320)} exiting={reduced ? undefined : FadeOutUp.duration(220)}>
      <TextNew variant="title" heading weight="extrabold" color={EX.cyanDeep} style={st.searchText}>{WORDS[i]}</TextNew>
    </Animated.View>
  );
}

export function ExploreSearch({ onPress, onFilter }: { onPress: () => void; onFilter: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <PressableScaleNew onPress={onPress} scaleTo={0.99} accessibilityLabel="Search jobs" style={[st.search, shadowSearch]}>
      <SearchGlyph />
      <View style={st.searchRow}>
        <TextNew variant="title" heading weight="bold" color={EX.navy} style={st.searchText}>Search </TextNew>
        <RotatingWord />
      </View>
      <PressableScaleNew onPress={onFilter} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
        scaleTo={0.92} accessibilityLabel="Filters" style={st.filter}>
        <HomeFilterGlyph on={pressed} />
      </PressableScaleNew>
    </PressableScaleNew>
  );
}

/* ───────── tabs ───────── */

export type ExploreTab = 'jobs' | 'map' | 'employers';
const TABS: { key: ExploreTab; label: string }[] = [
  { key: 'jobs', label: 'Jobs' },
  { key: 'map', label: 'Job map' },
  { key: 'employers', label: 'Employers' },
];

function TabIcon({ k, active }: { k: ExploreTab; active: boolean }) {
  if (k === 'jobs') return <JobsTabIcon active={active} />;
  if (k === 'map') return <MapTabIcon active={active} />;
  return <EmployersTabIcon active={active} />;
}

function TabItem({ k, i, label, active, onPress, progress }: {
  k: ExploreTab; i: number; label: string; active: boolean; onPress: () => void; progress?: SharedValue<number>;
}) {
  const reduced = useReducedMotion();
  const s = useSharedValue(active ? 1.04 : 0.94);
  const o = useSharedValue(active ? 1 : 0.82);
  useEffect(() => {
    s.value = reduced ? (active ? 1.04 : 0.94) : smooth(active ? 1.04 : 0.94, 300);
    o.value = reduced ? (active ? 1 : 0.82) : withTiming(active ? 1 : 0.82, { duration: 300 });
  }, [active, reduced, s, o]);
  // As the header folds away the icons rise in a gentle left-to-right wave, then settle.
  const a = useAnimatedStyle(() => {
    const p = progress ? progress.value : 0;
    const t = i * 0.14;
    const wave = reduced ? 0 : interpolate(p, [t, 0.45 + t, 1], [0, -5, 0], Extrapolation.CLAMP);
    return { opacity: o.value, transform: [{ translateY: wave }, { scale: s.value }] };
  });
  return (
    <Pressable onPress={onPress} style={st.tab} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label}>
      <Animated.View style={a}><TabIcon k={k} active={active} /></Animated.View>
      <TextNew variant="body" heading weight={active ? 'extrabold' : 'bold'} color={active ? EX.navy : EX.muted} style={st.tabLabel}>{label}</TextNew>
    </Pressable>
  );
}

export function ExploreTabs({ value, onChange, progress }: { value: ExploreTab; onChange: (t: ExploreTab) => void; progress?: SharedValue<number> }) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const idx = Math.max(0, TABS.findIndex((t) => t.key === value));
  const x = useSharedValue(0);
  useEffect(() => { x.value = reduced ? (idx * w) / 3 : smooth((idx * w) / 3, 300); }, [idx, w, reduced, x]);
  const ind = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={st.tabs} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {TABS.map((t, ti) => (
        <TabItem key={t.key} k={t.key} i={ti} progress={progress} label={t.label} active={t.key === value} onPress={() => { if (t.key !== value) { haptic.selection(); onChange(t.key); } }} />
      ))}
      {w > 0 && (
        <Animated.View pointerEvents="none" style={[st.indWrap, { width: w / 3 }, ind]}>
          <View style={st.ind} />
        </Animated.View>
      )}
    </View>
  );
}

/* ───────── section header ───────── */

export function SectionHeader({ title, icon, onGo }: { title: string; icon: SectionIconName; onGo?: () => void }) {
  const nudge = useSharedValue(0);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: nudge.value }] }));
  return (
    <View style={st.sh}>
      <TextNew variant="header" heading weight="extrabold" color={EX.navy} numberOfLines={1} style={st.shTitle}>{title}</TextNew>
      <SectionIcon name={icon} />
      <LinearGradient colors={[EX.line, 'rgba(230,237,239,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.shLine} />
      {onGo && (
        <PressableScaleNew
          onPress={onGo}
          onPressIn={() => { nudge.set(withTiming(3, { duration: 120 })); }}
          onPressOut={() => { nudge.set(smooth(0)); }}
          scaleTo={0.94}
          accessibilityLabel={`See all ${title}`}
          style={[st.go, shadowSoft]}
        >
          <Animated.View style={a}><ArrowRight /></Animated.View>
        </PressableScaleNew>
      )}
    </View>
  );
}

/* ───────── photo job card ───────── */

export type ExploreJobCard = {
  id: string;
  title: string;
  pay: string;
  distance: string;
  locationKnown: boolean;
  image?: string;
  positionsTotal: number;
  positionsFilled: number;
  boosted?: boolean;
  saved?: boolean;
};

/** Soft sheen that sweeps across an empty photo every few seconds. */
function Sheen() {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withSequence(withDelay(2400, withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) })), withTiming(0, { duration: 0 })), -1, false);
  }, [reduced, t]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: -180 + 360 * t.value }, { skewX: '-18deg' }] }));
  if (reduced) return null;
  return (
    <Animated.View pointerEvents="none" style={[st.sheen, a]}>
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

function PhotoHeart({ saved, onPress }: { saved?: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (saved && !reduced) s.value = withSequence(withTiming(1.2, { duration: 140 }), withTiming(1, { duration: 220, easing: SMOOTH }));
  }, [saved, reduced, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable onPress={onPress} hitSlop={8} style={st.heart} accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved' : 'Save job'} accessibilityState={{ selected: !!saved }}>
      <Animated.View style={[st.heartHalo, a]}>
        <Svg width={28} height={28} viewBox="0 0 28 28">
          <Path d="M14 22.5s-8-4.8-8-10.5a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8c0 5.7-8 10.5-8 10.5Z"
            fill={saved ? '#fff' : 'rgba(255,255,255,0.12)'} stroke="#fff" strokeWidth={1.9} strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

function Positions({ total, filled }: { total: number; filled: number }) {
  if (total <= 0) return null;
  const open = Math.max(0, total - filled);
  const shown = Math.min(total, 4);
  return (
    <View style={st.pos}>
      {Array.from({ length: shown }, (_, i) => <PersonGlyph key={i} taken={i < Math.min(filled, shown)} />)}
      <TextNew variant="meta" heading weight="bold" color={open === 1 && total > 1 ? EX.amberText : EX.cyanDeep} style={{ marginLeft: 4, fontSize: 13 }}>
        {filled}/{total}
      </TextNew>
    </View>
  );
}

export function RailCard({ job, onPress, onToggleSave }: { job: ExploreJobCard; onPress: () => void; onToggleSave: () => void }) {
  const hot = !!job.boosted;
  return (
    <PressableScaleNew onPress={onPress} scaleTo={0.985} accessibilityLabel={`${job.title}, ${job.pay}`} style={st.card}>
      <View style={[st.photo, shadowCard]}>
        <View style={st.photoClip}>
          <LinearGradient colors={['#EEF5F7', '#D2E1E6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, st.center]}>
            <PhotoGlyph />
            <TextNew variant="caption" heading weight="bold" color="#6D8C97" style={{ fontSize: 11, marginTop: 4 }}>Photo</TextNew>
          </LinearGradient>
          {job.image ? <Image source={{ uri: job.image }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Sheen />}
          {/* lit top edge: amber on promoted listings */}
          <View style={[st.topLight, { backgroundColor: hot ? EX.amber : 'rgba(255,255,255,0.85)' }]} />
          <View style={[st.price, hot && st.priceHot, shadowSoft]}>
            <TextNew variant="meta" heading weight="extrabold" color={EX.navy} numberOfLines={1}>{job.pay}</TextNew>
          </View>
        </View>
        <PhotoHeart saved={job.saved} onPress={onToggleSave} />
      </View>
      <View style={st.meta}>
        <TextNew variant="title" heading weight="bold" color={EX.navy} numberOfLines={1}>{job.title}</TextNew>
        <View style={st.locRow}>
          <SmallPin known={job.locationKnown} />
          <TextNew variant="meta" color={EX.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{job.locationKnown ? job.distance : 'To be confirmed'}</TextNew>
        </View>
        <Positions total={job.positionsTotal} filled={job.positionsFilled} />
        {hot && (
          <View style={st.ad}>
            <AdMegaphone />
            <TextNew variant="caption" heading weight="extrabold" color={EX.amberText}>Ad</TextNew>
          </View>
        )}
      </View>
    </PressableScaleNew>
  );
}

export const CARD_W = 156;
export const CARD_GAP = 14;

export function Rail({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={CARD_W + CARD_GAP}
      contentContainerStyle={st.rail}
    >
      {children}
    </ScrollView>
  );
}

export function RailSkeleton() {
  return (
    <View style={[st.rail, { flexDirection: 'row' }]}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: CARD_W, gap: 8 }}>
          <Skeleton height={176} radius={24} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="50%" height={12} />
        </View>
      ))}
    </View>
  );
}

/* ───────── employers ───────── */

export function EmployerCard({ name, initials, color, onPress }: { name: string; initials: string; color: string; onPress: () => void }) {
  return (
    <PressableScaleNew onPress={onPress} scaleTo={0.97} accessibilityLabel={name} style={[st.emp, shadowCard]}>
      <View style={st.empLight} />
      <View style={[st.empLogo, { backgroundColor: color }]}>
        <TextNew variant="title" heading weight="extrabold" color={EX.white}>{initials}</TextNew>
      </View>
      <TextNew variant="title" heading weight="bold" color={EX.navy} numberOfLines={1} style={{ marginTop: 10 }}>{name}</TextNew>
      <View style={st.empLink}>
        <TextNew variant="meta" heading weight="bold" color={EX.amberText}>View profile</TextNew>
        <ArrowRight size={14} color={EX.amberText} />
      </View>
    </PressableScaleNew>
  );
}

/* ───────── banner ───────── */

export function NotFoundBanner({ onPress }: { onPress: () => void }) {
  return (
    <View style={st.banner}>
      <LinearGradient colors={['#183A55', '#0F2A40']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 24 }]} />
      <LinearGradient colors={['rgba(245,165,36,0)', EX.amber, 'rgba(245,165,36,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.bannerLight} />
      <View style={st.bell}><BellArt /></View>
      <TextNew variant="header" heading weight="extrabold" color={EX.white} style={{ maxWidth: 220, fontSize: 19, lineHeight: 24 }}>Didn&rsquo;t find it yet?</TextNew>
      <TextNew variant="body" color="#B8D6E0" style={{ maxWidth: 230, marginTop: 4, marginBottom: 14 }}>
        Narrow it down by pay, hours and distance with filters.
      </TextNew>
      <PressableScaleNew onPress={onPress} scaleTo={0.95} accessibilityLabel="Open filters" style={st.bannerBtn}>
        <TextNew variant="body" heading weight="extrabold" color={EX.navy}>Open filters</TextNew>
        <ArrowRight size={16} />
      </PressableScaleNew>
    </View>
  );
}

const st = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  search: {
    height: 54, borderRadius: 27, backgroundColor: EX.white,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 56,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchText: { fontSize: 17, lineHeight: 22 },
  filter: {
    position: 'absolute', right: 5, top: 5, width: 44, height: 44, borderRadius: 22,
    backgroundColor: EX.navy, alignItems: 'center', justifyContent: 'center',
  },
  tabs: { flexDirection: 'row', paddingTop: 12 },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingBottom: 12, minHeight: 44 },
  tabLabel: { fontSize: 14, lineHeight: 18 },
  indWrap: { position: 'absolute', left: 0, bottom: 0, alignItems: 'center' },
  ind: { width: 44, height: 3, borderRadius: 2, backgroundColor: EX.navy },
  sh: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginTop: 22, marginBottom: 4 },
  shTitle: { fontSize: 21, lineHeight: 26, flexShrink: 1, letterSpacing: -0.2 },
  shLine: { flex: 1, height: 1, minWidth: 12 },
  go: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: EX.line, backgroundColor: EX.white, alignItems: 'center', justifyContent: 'center' },
  rail: { gap: CARD_GAP, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18 },
  card: { width: CARD_W },
  photo: { height: 176, borderRadius: 24, backgroundColor: '#E3ECEF' },
  photoClip: { ...StyleSheet.absoluteFill, borderRadius: 24, overflow: 'hidden' },
  sheen: { position: 'absolute', top: -20, bottom: -20, width: 90 },
  topLight: { position: 'absolute', left: '14%', right: '14%', top: 0, height: 2 },
  price: { position: 'absolute', left: 10, bottom: 10, maxWidth: CARD_W - 20, backgroundColor: EX.white, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  priceHot: { backgroundColor: EX.amber },
  heart: { position: 'absolute', top: 8, right: 8, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  heartHalo: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  meta: { paddingTop: 10, paddingHorizontal: 4, gap: 3 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pos: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3 },
  ad: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  emp: { flex: 1, backgroundColor: EX.white, borderWidth: 1, borderColor: EX.line, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 14 },
  empLight: { position: 'absolute', left: '14%', right: '14%', top: 0, height: 2, backgroundColor: EX.amber, opacity: 0.7 },
  empLogo: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  empLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  banner: { marginTop: 28, marginHorizontal: 16, borderRadius: 24, paddingVertical: 18, paddingHorizontal: 16, overflow: 'hidden' },
  bannerLight: { position: 'absolute', left: '14%', right: '14%', top: 0, height: 2 },
  bell: { position: 'absolute', right: 16, top: 16 },
  bannerBtn: { alignSelf: 'flex-start', height: 42, borderRadius: 21, backgroundColor: EX.amber, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
