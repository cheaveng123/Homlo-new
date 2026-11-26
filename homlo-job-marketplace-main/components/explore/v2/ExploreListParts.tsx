/**
 * Explore list pieces: category chips, the results line, a detailed job card for the
 * vertical results list, and employer rows. Quiet, professional styling with small
 * purposeful motion: photos fade in as they load, position glyphs fill one by one,
 * promoted cards carry a slow light that glides along their top edge, the heart
 * beats once when saved.
 */
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import LinearGradient from '@/lib/native/linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { TextNew } from '@/src/new/components/TextNew';
import { PressableScaleNew } from '@/src/new/components/PrimitivesNew';
import { Skeleton } from '@/src/design/primitives';
import { SMOOTH } from '@/src/design/motion';
import { haptic } from '@/lib/haptics';
import { ArrowRight, PhotoGlyph } from './ExploreGlyphs';
import { CompanyIcon, PlaceIcon, PostedIcon, PromotedIcon, ScheduleIcon, SeatIcon, SettingIcon, useCardClock } from './CardIcons';
import type { ExploreJobCard } from './ExploreParts';
import { EX } from './tokens';

/* ───────── category chips ───────── */

export function CategoryChips<T extends string>({ items, value, onChange }: { items: { key: T; label: string; count: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
      {items.map((c) => {
        const on = c.key === value;
        return (
          <PressableScaleNew
            key={c.key}
            onPress={() => { if (!on) { haptic.selection(); onChange(c.key); } }}
            scaleTo={0.95}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${c.label}, ${c.count} jobs`}
            style={[st.chip, on && st.chipOn]}
          >
            <TextNew variant="meta" heading weight="bold" color={on ? EX.white : EX.navy}>{c.label}</TextNew>
            <TextNew variant="caption" heading weight="bold" color={on ? 'rgba(255,255,255,0.7)' : EX.muted}>{c.count}</TextNew>
          </PressableScaleNew>
        );
      })}
    </ScrollView>
  );
}

/* ───────── small details ───────── */


function HeartGlyph({ saved }: { saved: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"
        fill={saved ? EX.navy : 'none'} stroke={EX.navy} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

function SaveButton({ saved, onPress }: { saved: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (saved && !reduced) s.value = withSequence(withTiming(1.22, { duration: 140 }), withTiming(1, { duration: 240, easing: SMOOTH }));
  }, [saved, reduced, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable onPress={onPress} hitSlop={10} style={st.save} accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved' : 'Save job'} accessibilityState={{ selected: saved }}>
      <Animated.View style={a}><HeartGlyph saved={saved} /></Animated.View>
    </Pressable>
  );
}

/** Entrance for a seat glyph: pops in shortly after the card appears (staggered). */
function Seat({ index, children }: { taken: boolean; index: number; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) p.value = withDelay(250 + index * 90, withTiming(1, { duration: 380, easing: SMOOTH }));
  }, [reduced, index, p]);
  const a = useAnimatedStyle(() => ({ opacity: 0.3 + 0.7 * p.value, transform: [{ scale: 0.6 + 0.4 * p.value }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

/** Thumbnail: placeholder underneath, photo fades in once it has loaded. */
function Thumb({ uri }: { uri?: string }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(0);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: 1.04 - 0.04 * o.value }] }));
  return (
    <View style={st.thumb}>
      <LinearGradient colors={['#EEF5F7', '#D2E1E6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, st.center]}>
        <PhotoGlyph />
        <TextNew variant="caption" heading weight="bold" color="#6D8C97" style={{ fontSize: 10, lineHeight: 12, marginTop: 2 }}>Photo</TextNew>
      </LinearGradient>
      {!!uri && (
        <Animated.Image
          source={{ uri }}
          onLoad={() => { o.set(reduced ? 1 : withTiming(1, { duration: 420, easing: SMOOTH })); }}
          style={[StyleSheet.absoluteFill, a]}
          resizeMode="cover"
        />
      )}
    </View>
  );
}

/** A slow highlight that glides along the top edge of promoted cards. */
function EdgeGlint({ width }: { width: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced || !width) return;
    t.value = withRepeat(withSequence(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), withDelay(3200, withTiming(0, { duration: 0 }))), -1, false);
  }, [reduced, width, t]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: -80 + (width + 80) * t.value }] }));
  return (
    <View pointerEvents="none" style={st.edgeWrap}>
      <View style={st.edgeBase} />
      {!reduced && width > 0 && (
        <Animated.View style={[st.glint, a]}>
          <LinearGradient colors={['rgba(245,165,36,0)', EX.amber, 'rgba(245,165,36,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
    </View>
  );
}

/* ───────── job card ───────── */

export type ExploreListJob = ExploreJobCard & { company: string; posted?: string; tag?: string; arrangement?: string };

function DetailChip({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: 'amber' | 'slate' }) {
  return (
    <View style={[st.dchip, tone === 'amber' ? st.dchipAmber : st.dchipSlate]}>
      {icon}
      <TextNew variant="caption" heading weight="bold" color={tone === 'amber' ? EX.amberText : EX.navy} style={{ fontSize: 11.5, lineHeight: 14 }}>{label}</TextNew>
    </View>
  );
}

export function JobListCard({ job, saved, index = 0, onPress, onToggleSave }: { job: ExploreListJob; saved: boolean; index?: number; onPress: () => void; onToggleSave: () => void }) {
  const [w, setW] = useState(0);
  // One clock per card, offset so neighbouring cards play their details at different moments.
  const clock = useCardClock((index % 5) * 900);
  const promoted = !!job.boosted;
  const total = job.positionsTotal;
  const filled = Math.min(job.positionsFilled, total);
  const open = Math.max(0, total - filled);
  const shown = Math.min(total, 5);
  return (
    <PressableScaleNew
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={`${job.title} at ${job.company}, ${job.pay}`}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={[st.card, promoted && st.cardPromoted]}
    >
      {promoted && (
        <LinearGradient pointerEvents="none" colors={['#FFF6E4', '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.7 }} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />
      )}
      {promoted && <EdgeGlint width={w} />}
      <Thumb uri={job.image} />
      <View style={st.body}>
        <View style={st.topRow}>
          {promoted ? (
            <View style={st.promo}>
              <PromotedIcon clock={clock} />
              <TextNew variant="caption" heading weight="extrabold" color={EX.amberText}>Promoted</TextNew>
              <View style={st.dot} />
              <TextNew variant="caption" weight="medium" color={EX.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{job.company}</TextNew>
            </View>
          ) : (
            <View style={st.company}>
              <CompanyIcon clock={clock} />
              <TextNew variant="caption" weight="medium" color={EX.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{job.company}</TextNew>
            </View>
          )}
          <SaveButton saved={saved} onPress={onToggleSave} />
        </View>
        <TextNew variant="title" heading weight="bold" color={EX.navy} numberOfLines={1} style={st.title}>{job.title}</TextNew>
        <View style={st.metaRow}>
          <PlaceIcon clock={clock} known={job.locationKnown} />
          <TextNew variant="meta" color={EX.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
            {job.locationKnown ? job.distance : 'Location TBC'}
          </TextNew>
          {!!job.posted && (
            <>
              <View style={st.metaGap} />
              <PostedIcon clock={clock} />
              <TextNew variant="meta" color={EX.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{job.posted.replace(/^Posted\s+/i, '')}</TextNew>
            </>
          )}
        </View>
        {(!!job.tag || !!job.arrangement) && (
          <View style={st.dchips}>
            {!!job.tag && <DetailChip icon={<ScheduleIcon clock={clock} fullTime={/full/i.test(job.tag)} />} label={job.tag} tone="amber" />}
            {!!job.arrangement && <DetailChip icon={<SettingIcon clock={clock} arrangement={job.arrangement} />} label={job.arrangement} tone="slate" />}
          </View>
        )}
        <View style={st.divider} />
        <View style={st.bottomRow}>
          {total > 0 ? (
            <View style={st.seats}>
              {Array.from({ length: shown }, (_, i) => (
                <Seat key={i} index={i} taken={i < Math.min(filled, shown)}>
                  <SeatIcon clock={clock} index={i} taken={i < Math.min(filled, shown)} />
                </Seat>
              ))}
              <TextNew variant="caption" heading weight="bold" color={open === 1 && total > 1 ? EX.amberText : EX.cyanDeep} style={{ marginLeft: 5 }}>
                {open === 0 ? 'Filled' : `${open} open`}
              </TextNew>
            </View>
          ) : <View />}
          <TextNew variant="title" heading weight="extrabold" color={EX.navy} numberOfLines={1} style={st.pay}>{job.pay}</TextNew>
        </View>
      </View>
    </PressableScaleNew>
  );
}

export function JobListSkeleton() {
  return (
    <View style={{ gap: 12, paddingHorizontal: 16 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[st.card, { gap: 12 }]}>
          <Skeleton width={84} height={84} radius={14} />
          <View style={{ flex: 1, gap: 8, paddingTop: 4 }}>
            <Skeleton width="45%" height={10} />
            <Skeleton width="85%" height={15} />
            <Skeleton width="55%" height={11} />
            <Skeleton width="100%" height={12} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ───────── employer row ───────── */

export function EmployerRow({ name, initials, color, last, onPress }: { name: string; initials: string; color: string; last?: boolean; onPress: () => void }) {
  return (
    <PressableScaleNew onPress={onPress} scaleTo={0.985} accessibilityLabel={`${name}, view profile`} style={[st.empRow, !last && st.empLine]}>
      <View style={[st.empLogo, { backgroundColor: color }]}>
        <TextNew variant="meta" heading weight="extrabold" color={EX.white}>{initials}</TextNew>
      </View>
      <View style={{ flex: 1 }}>
        <TextNew variant="title" heading weight="bold" color={EX.navy} numberOfLines={1}>{name}</TextNew>
        <TextNew variant="caption" color={EX.muted}>Employer profile</TextNew>
      </View>
      <View style={st.empGo}><ArrowRight size={16} /></View>
    </PressableScaleNew>
  );
}

/* ───────── filter strip (end of results) ───────── */

export function FilterStrip({ onPress }: { onPress: () => void }) {
  return (
    <PressableScaleNew onPress={onPress} scaleTo={0.985} accessibilityLabel="Refine with filters" style={st.strip}>
      <View style={st.stripIcon}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke={EX.white} strokeWidth={1.9} strokeLinecap="round" />
          <Rect x={14} y={5} width={4} height={4} rx={2} fill={EX.amber} />
          <Rect x={8} y={15} width={4} height={4} rx={2} fill={EX.white} />
        </Svg>
      </View>
      <View style={{ flex: 1 }}>
        <TextNew variant="title" heading weight="bold" color={EX.navy}>Not quite right?</TextNew>
        <TextNew variant="caption" color={EX.muted}>Refine by pay, hours and distance</TextNew>
      </View>
      <ArrowRight size={18} />
    </PressableScaleNew>
  );
}

const st = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18,
    backgroundColor: EX.white, borderWidth: StyleSheet.hairlineWidth, borderColor: '#C9D6DB',
  },
  chipOn: { backgroundColor: EX.navy, borderColor: EX.navy },
  card: {
    flexDirection: 'row', gap: 12, padding: 12, borderRadius: 18, backgroundColor: EX.white,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9E3E7',
    shadowColor: '#12303C', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  cardPromoted: { borderColor: '#F0D9A8' },
  dchips: { flexDirection: 'row', gap: 6, marginTop: 7 },
  dchip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingLeft: 6, paddingRight: 8, paddingVertical: 4 },
  dchipAmber: { backgroundColor: '#FDF3E1' },
  metaGap: { width: 6 },
  dchipSlate: { backgroundColor: '#EDF1F4' },
  edgeWrap: { position: 'absolute', left: 18, right: 18, top: 0, height: 2, overflow: 'hidden' },
  edgeBase: { position: 'absolute', left: 0, right: 0, top: 0, height: 2, backgroundColor: 'rgba(245,165,36,0.35)' },
  glint: { position: 'absolute', top: 0, width: 80, height: 2 },
  thumb: { width: 84, height: 84, borderRadius: 14, overflow: 'hidden' },
  body: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 20 },
  company: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  promo: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  save: { width: 28, height: 24, alignItems: 'flex-end', justifyContent: 'center' },
  title: { marginTop: 2, fontSize: 16, lineHeight: 21 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#AAC3CB' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#DCE5E8', marginTop: 9, marginBottom: 8 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  seats: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  pay: { fontSize: 15.5, lineHeight: 20, flexShrink: 1, textAlign: 'right' },
  empRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  empLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DCE5E8' },
  empLogo: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  empGo: { width: 34, height: 34, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: '#C9D6DB', alignItems: 'center', justifyContent: 'center' },
  strip: {
    marginTop: 18, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18,
    backgroundColor: '#F3F6F8', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9E3E7',
  },
  stripIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: EX.navy, alignItems: 'center', justifyContent: 'center' },
});
