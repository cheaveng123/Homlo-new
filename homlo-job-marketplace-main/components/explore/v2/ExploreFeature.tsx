/**
 * Livelier Explore pieces:
 * - FeaturedCarousel: full-bleed photo cards that page horizontally; the centred card
 *   sits forward while its neighbours ease back (scale + dim), driven by scroll.
 * - EmployerShowcase: a featured employer with a drawn cover, then a two-column grid
 *   of cover cards. Covers carry a slow-drifting line pattern for depth.
 */
import React, { useEffect } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import LinearGradient from '@/lib/native/linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { TextNew } from '@/src/new/components/TextNew';
import { PressableScaleNew } from '@/src/new/components/PrimitivesNew';
import { SMOOTH } from '@/src/design/motion';
import { AdMegaphone, ArrowRight, PhotoGlyph } from './ExploreGlyphs';
import { EX } from './tokens';

/* ───────── featured carousel ───────── */

export type FeaturedJob = {
  id: string; title: string; company: string; pay: string; distance: string; locationKnown: boolean;
  image?: string; boosted?: boolean; positionsTotal: number; positionsFilled: number;
};

const GAP = 12;

function WhiteHeart({ saved }: { saved: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 28 28">
      <Path d="M14 22.5s-8-4.8-8-10.5a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8c0 5.7-8 10.5-8 10.5Z"
        fill={saved ? '#fff' : 'rgba(255,255,255,0.15)'} stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

function SaveOnPhoto({ saved, onPress }: { saved: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (saved && !reduced) s.value = withSequence(withTiming(1.22, { duration: 140 }), withTiming(1, { duration: 240, easing: SMOOTH }));
  }, [saved, reduced, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <PressableScaleNew onPress={onPress} scaleTo={0.9} accessibilityLabel={saved ? 'Remove from saved' : 'Save job'} style={st.photoSave}>
      <Animated.View style={[st.heartHalo, a]}><WhiteHeart saved={saved} /></Animated.View>
    </PressableScaleNew>
  );
}

function Slide({ job, index, x, cardW, saved, onPress, onToggleSave }: {
  job: FeaturedJob; index: number; x: SharedValue<number>; cardW: number; saved: boolean; onPress: () => void; onToggleSave: () => void;
}) {
  const reduced = useReducedMotion();
  const step = cardW + GAP;
  const a = useAnimatedStyle(() => {
    if (reduced) return {};
    const d = interpolate(x.value, [(index - 1) * step, index * step, (index + 1) * step], [1, 0, 1], Extrapolation.CLAMP);
    return { opacity: 1 - 0.25 * d, transform: [{ scale: 1 - 0.06 * d }] };
  });
  const total = job.positionsTotal;
  const open = Math.max(0, total - Math.min(job.positionsFilled, total));
  return (
    <Animated.View style={[{ width: cardW }, a]}>
      <PressableScaleNew onPress={onPress} scaleTo={0.985} accessibilityLabel={`${job.title} at ${job.company}, ${job.pay}`} style={[st.slide, st.slideShadow]}>
        <View style={st.slideClip}>
          <LinearGradient colors={['#E9F1F4', '#CFDEE4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, st.center]}>
            <PhotoGlyph />
          </LinearGradient>
          {!!job.image && <Image source={{ uri: job.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
          <LinearGradient colors={['rgba(10,24,36,0)', 'rgba(10,24,36,0.25)', 'rgba(10,24,36,0.82)']} locations={[0.25, 0.55, 1]} style={StyleSheet.absoluteFill} />
          {job.boosted && (
            <View style={st.promoTag}>
              <AdMegaphone color={EX.navy} />
              <TextNew variant="caption" heading weight="extrabold" color={EX.navy}>Promoted</TextNew>
            </View>
          )}
          <View style={st.slideBody}>
            <TextNew variant="caption" weight="medium" color="rgba(255,255,255,0.8)" numberOfLines={1}>{job.company}</TextNew>
            <TextNew variant="header" heading weight="extrabold" color={EX.white} numberOfLines={1} style={st.slideTitle}>{job.title}</TextNew>
            <View style={st.slideFoot}>
              <View style={st.payPill}>
                <TextNew variant="meta" heading weight="extrabold" color={EX.navy} numberOfLines={1}>{job.pay}</TextNew>
              </View>
              <TextNew variant="caption" weight="medium" color="rgba(255,255,255,0.88)" numberOfLines={1} style={{ flexShrink: 1 }}>
                {job.locationKnown ? job.distance : 'Location TBC'}{total > 0 ? `  ·  ${open === 0 ? 'Filled' : `${open} open`}` : ''}
              </TextNew>
            </View>
          </View>
        </View>
        <SaveOnPhoto saved={saved} onPress={onToggleSave} />
      </PressableScaleNew>
    </Animated.View>
  );
}

export function FeaturedCarousel({ jobs, isSaved, onOpen, onToggleSave }: {
  jobs: FeaturedJob[]; isSaved: (id: string) => boolean; onOpen: (id: string) => void; onToggleSave: (id: string) => void;
}) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(320, width - 64);
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { x.value = e.contentOffset.x; });
  return (
    <Animated.ScrollView
      horizontal
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={cardW + GAP}
      contentContainerStyle={{ paddingHorizontal: 16, gap: GAP, paddingTop: 6, paddingBottom: 22 }}
    >
      {jobs.map((j, i) => (
        <Slide key={j.id} job={j} index={i} x={x} cardW={cardW} saved={isSaved(j.id)} onPress={() => onOpen(j.id)} onToggleSave={() => onToggleSave(j.id)} />
      ))}
    </Animated.ScrollView>
  );
}

/* ───────── employer covers ───────── */

/** Cover art: gradient with soft arcs that drift slowly (depth without decoration). */
function Cover({ colors, height, radius }: { colors: [string, string]; height: number; radius: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced, t]);
  const drift = useAnimatedStyle(() => ({ transform: [{ translateX: -12 + 24 * t.value }, { translateY: 6 - 12 * t.value }] }));
  return (
    <View style={{ height, borderTopLeftRadius: radius, borderTopRightRadius: radius, overflow: 'hidden' }}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, drift]}>
        <Svg width="120%" height="140%" viewBox="0 0 200 100" style={{ marginLeft: '-10%', marginTop: -10 }}>
          <Circle cx={170} cy={10} r={44} stroke="#fff" strokeOpacity={0.18} strokeWidth={1} fill="none" />
          <Circle cx={170} cy={10} r={66} stroke="#fff" strokeOpacity={0.12} strokeWidth={1} fill="none" />
          <Circle cx={170} cy={10} r={90} stroke="#fff" strokeOpacity={0.08} strokeWidth={1} fill="none" />
        </Svg>
      </Animated.View>
      <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.6 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}

export type ShowcaseEmployer = { id: string; name: string; initials: string; color: string; cover: [string, string] };

export function EmployerShowcase({ employers, location, onOpen }: { employers: ShowcaseEmployer[]; location: string; onOpen: (id: string) => void }) {
  const [first, ...rest] = employers;
  if (!first) return null;
  const rows = Array.from({ length: Math.ceil(rest.length / 2) }, (_, r) => rest.slice(r * 2, r * 2 + 2));
  return (
    <View style={{ gap: 12, paddingHorizontal: 16 }}>
      <PressableScaleNew onPress={() => onOpen(first.id)} scaleTo={0.985} accessibilityLabel={`${first.name}, view profile`} style={[st.empBig, st.cardShadow]}>
        <Cover colors={first.cover} height={108} radius={22} />
        <View style={st.empBigBody}>
          <View style={[st.logoBig, { backgroundColor: first.color }]}>
            <TextNew variant="header" heading weight="extrabold" color={EX.white}>{first.initials}</TextNew>
          </View>
          <View style={{ flex: 1, paddingTop: 10 }}>
            <TextNew variant="caption" heading weight="bold" color={EX.amberText}>Featured employer</TextNew>
            <TextNew variant="header" heading weight="extrabold" color={EX.navy} numberOfLines={1} style={{ fontSize: 19, lineHeight: 24 }}>{first.name}</TextNew>
            <TextNew variant="meta" color={EX.muted} numberOfLines={1}>Hiring in {location}</TextNew>
          </View>
        </View>
        <View style={st.empBigFoot}>
          <TextNew variant="meta" heading weight="bold" color={EX.navy}>View company profile</TextNew>
          <View style={st.goNavy}><ArrowRight size={16} color={EX.white} /></View>
        </View>
      </PressableScaleNew>

      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 12 }}>
          {row.map((e) => (
            <PressableScaleNew key={e.id} onPress={() => onOpen(e.id)} scaleTo={0.97} accessibilityLabel={`${e.name}, view profile`} style={[st.empSmall, st.cardShadow]}>
              <Cover colors={e.cover} height={64} radius={20} />
              <View style={[st.logoSmall, { backgroundColor: e.color }]}>
                <TextNew variant="title" heading weight="extrabold" color={EX.white}>{e.initials}</TextNew>
              </View>
              <View style={st.empSmallBody}>
                <TextNew variant="title" heading weight="bold" color={EX.navy} numberOfLines={1}>{e.name}</TextNew>
                <View style={st.empLink}>
                  <TextNew variant="caption" heading weight="bold" color={EX.cyanDeep}>View profile</TextNew>
                  <ArrowRight size={13} color={EX.cyanDeep} />
                </View>
              </View>
            </PressableScaleNew>
          ))}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  slide: { height: 196, borderRadius: 24, backgroundColor: '#DCE6EA' },
  slideShadow: { shadowColor: '#12303C', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  slideClip: { ...StyleSheet.absoluteFill, borderRadius: 24, overflow: 'hidden' },
  promoTag: {
    position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: EX.amber, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3,
  },
  photoSave: { position: 'absolute', top: 8, right: 8, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  heartHalo: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  slideBody: { position: 'absolute', left: 14, right: 14, bottom: 14, gap: 2 },
  slideTitle: { fontSize: 20, lineHeight: 25 },
  slideFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  payPill: { backgroundColor: EX.white, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 3, maxWidth: '55%' },
  cardShadow: { shadowColor: '#12303C', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  empBig: { backgroundColor: EX.white, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9E3E7' },
  empBigBody: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, marginTop: -30 },
  logoBig: {
    width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: EX.white,
    shadowColor: '#12303C', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  empBigFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DCE5E8',
  },
  goNavy: { width: 32, height: 32, borderRadius: 16, backgroundColor: EX.navy, alignItems: 'center', justifyContent: 'center' },
  empSmall: { flex: 1, backgroundColor: EX.white, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9E3E7' },
  logoSmall: {
    position: 'absolute', top: 40, left: 12, width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: EX.white, shadowColor: '#12303C', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  empSmallBody: { paddingHorizontal: 12, paddingTop: 34, paddingBottom: 14, gap: 4 },
  empLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
