// ListingScreen.tsx
// Shared template for listing pages (Category detail, Job type detail):
//   Top bar → location pill → title (+ optional art) + subtitle → optional
//   toolbar → "Top employers hiring" → white jobs sheet that slides over the
//   header as you scroll. Pages pass copy, jobs and handlers; layout and motion
//   live here so every listing page moves the same way.
import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type ViewToken } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation, FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle,
  runOnJS, useAnimatedReaction, useReducedMotion, useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SMOOTH, smooth } from '@/src/design/motion';
import { haptic } from '@/lib/haptics';
import type { VistaJob } from '../vistaCategoryData';
import { AreaSheet, type AreaRow } from './AreaSheet';
import { EmptyArt } from './EmptyArt';
import { BackGlyph, MoreGlyph } from './glyphs';
import { JobCard } from './JobCard';
import { LocationPill } from './LocationPill';
import { LogoMark } from './LogoMark';
import { AP, AREAS, CITY, F, LINE, areaOf, plural } from './tokens';

export type ListingScreenProps = {
  title: string;
  /** Muted line under the title, given the total job count. */
  subtitle: (count: number) => string;
  /** Sheet heading, given the visible (area-filtered) job count. */
  heading: (count: number) => string;
  /** Lower-case noun for the area sheet: "Jobs in {areaSubject} by area of Phnom Penh." */
  areaSubject: string;
  /** Optional picture to the right of the title (kept small, no tile). */
  art?: React.ReactNode;
  /** Optional row under the subtitle (e.g. a search field). */
  toolbar?: React.ReactNode;
  jobs: VistaJob[];
  loading?: boolean;
  onBack?: () => void;
  onMore?: () => void;
  onOpenJob?: (job: VistaJob) => void;
  onOpenEmployer?: (job: VistaJob) => void;
  isSaved?: (jobId: string) => boolean;
  onToggleSave?: (job: VistaJob) => void;
};

const BAR_H = 68; // top bar height below the safe-area inset
const OVERLAP = 26; // the jobs sheet overlaps the gradient block by this much
const SHEET_R = 26;
const VIEW_CONFIG = { itemVisiblePercentThreshold: 10 };

type EmployerItem = { company: string; count: number; job: VistaJob };

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<VistaJob>);

function RoundButton({ label, onPress, children }: { label: string; onPress?: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.round, pressed && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  );
}

const EmployerAvatar = memo(function EmployerAvatar({ item, onPress }: { item: EmployerItem; onPress: (e: EmployerItem) => void }) {
  const scale = useSharedValue(1);
  const pic = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={() => onPress(item)}
      onPressIn={() => { scale.set(smooth(0.94, 140)); }}
      onPressOut={() => { scale.set(smooth(1, 200)); }}
      accessibilityRole="button"
      accessibilityLabel={`${item.company}, ${plural(item.count, 'job', 'jobs')}`}
      style={s.emp}
    >
      <Animated.View style={pic}>
        <LogoMark company={item.company} uri={item.job.logoUrl} size={68} radius={34} />
      </Animated.View>
      <Text style={s.empName} numberOfLines={2}>{item.company}</Text>
      <Text style={s.empCount}>{plural(item.count, 'job', 'jobs')}</Text>
    </Pressable>
  );
});

export function ListingScreen({
  title, subtitle, heading, areaSubject, art, toolbar,
  jobs, loading, onBack, onMore, onOpenJob, onOpenEmployer, isSaved, onToggleSave,
}: ListingScreenProps) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const all = jobs;
  const [area, setArea] = useState<string | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);
  const visible = useMemo(() => (area ? all.filter((j) => areaOf(j) === area) : all), [all, area]);

  const employers = useMemo<EmployerItem[]>(() => {
    const map = new Map<string, EmployerItem>();
    for (const job of all) {
      const hit = map.get(job.company);
      if (hit) {
        hit.count += 1;
        if (!hit.job.logoUrl && job.logoUrl) hit.job = job;
      } else {
        map.set(job.company, { company: job.company, count: 1, job });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [all]);

  const areaRows = useMemo<AreaRow[]>(() => [
    { key: undefined, label: `All ${CITY}`, count: all.length },
    ...AREAS.map((a) => ({ key: a.name, label: a.name, count: all.filter((j) => areaOf(j) === a.name).length })),
  ], [all]);

  // ---- scroll motion -------------------------------------------------------
  const scrollY = useSharedValue(0);
  const upperH = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.set(e.contentOffset.y); });
  // Faded header stops taking touches (state-driven, avoids stale Fabric hit-tests).
  const [headerLive, setHeaderLive] = useState(true);
  useAnimatedReaction(
    () => scrollY.value < 110,
    (live, prev) => { if (live !== prev) runOnJS(setHeaderLive)(live); },
  );

  const barFade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [70, 120], [0, 1], Extrapolation.CLAMP),
  }));
  const parallax = useAnimatedStyle(() => {
    if (reduce) return {};
    const y = Math.max(scrollY.value, 0);
    return { opacity: Math.max(0, 1 - y / 170), transform: [{ translateY: y * 0.42 }] };
  });
  // Pull-down past the top: stretch the gradient so no white shows above it.
  const stretch = useAnimatedStyle(() => {
    const y = Math.min(scrollY.value, 0);
    const h = upperH.value || 1;
    return { transform: [{ translateY: y / 2 }, { scaleY: (h - y) / h }] };
  });
  // Sheet corners ease 26 → 0 as its top reaches the top bar.
  const sheetCorners = useAnimatedStyle(() => {
    const r = Math.min(SHEET_R, Math.max(0, upperH.value - OVERLAP - scrollY.value));
    return { borderTopLeftRadius: r, borderTopRightRadius: r };
  });

  // ---- card reveal (once per card, as it enters the screen) ----------------
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  // Stable identity (FlatList rejects a changing onViewableItemsChanged).
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setRevealed((prev) => {
      let next: Set<string> | null = null;
      for (const v of viewableItems) {
        const id = (v.item as VistaJob | undefined)?.id;
        if (id && !prev.has(id)) {
          next ??= new Set(prev);
          next.add(id);
        }
      }
      return next ?? prev;
    });
  }, []);

  // ---- handlers (pass-through to the route) --------------------------------
  const openJob = useCallback((job: VistaJob) => onOpenJob?.(job), [onOpenJob]);
  const toggleSave = useCallback((job: VistaJob) => onToggleSave?.(job), [onToggleSave]);
  const openEmployer = useCallback((e: EmployerItem) => onOpenEmployer?.(e.job), [onOpenEmployer]);
  const pickArea = useCallback((next: string | undefined) => {
    haptic.selection();
    setArea(next);
    setSheetOpen(false);
  }, []);

  const enter = (i: number) => (reduce ? undefined : FadeInDown.delay(i * 70).duration(420).easing(SMOOTH));
  const name = title;
  const isLoading = !!loading && all.length === 0;

  const header = (
    <View>
      <View style={s.upper} onLayout={(e) => { upperH.set(e.nativeEvent.layout.height); }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, stretch]}>
          <LinearGradient colors={['#FFFFFF', '#F7F9FA', '#F1F5F6']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={parallax} pointerEvents={headerLive ? "auto" : "none"}>
          {art ? (
            <Animated.View entering={enter(1)} style={s.art} pointerEvents="none">{art}</Animated.View>
          ) : null}
          <Animated.View entering={enter(0)} style={s.gutter}>
            <LocationPill area={area} city={CITY} onPress={() => setSheetOpen(true)} />
          </Animated.View>
          <Animated.View entering={enter(1)} style={s.gutter}>
            <Text style={[s.title, art ? s.titleBesideArt : null]} accessibilityRole="header">{name}</Text>
            <Text style={s.sub}>{isLoading ? 'Loading jobs…' : subtitle(all.length)}</Text>
          </Animated.View>
          {toolbar ? (
            <Animated.View entering={enter(2)} style={[s.gutter, { marginTop: 16 }]}>{toolbar}</Animated.View>
          ) : null}
          {employers.length > 0 ? (
            <Animated.View entering={enter(toolbar ? 3 : 2)}>
              <Text style={[s.section, s.gutter, { marginTop: 16 }]}>Top employers hiring</Text>
              <FlatList
                horizontal
                data={employers}
                keyExtractor={(e) => e.company}
                renderItem={({ item }) => <EmployerAvatar item={item} onPress={openEmployer} />}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
              />
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>

      <Animated.View style={[s.sheet, sheetCorners]}>
        <Text style={s.section}>{heading(visible.length)}</Text>
      </Animated.View>
    </View>
  );

  const footer = (
    <View style={[s.footer, { paddingBottom: insets.bottom + 32 }]}>
      {isLoading ? (
        <Text style={s.loading}>Loading jobs…</Text>
      ) : visible.length === 0 ? (
        area ? (
          <EmptyArt
            title="No jobs in this area"
            body="New jobs will show up here. Try another area to see more."
            actionLabel={`Show all ${CITY}`}
            onAction={() => { haptic.selection(); setArea(undefined); }}
          />
        ) : (
          <EmptyArt title="No open jobs right now" body="New jobs will show up here." />
        )
      ) : null}
    </View>
  );

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />

      <View style={[s.bar, { paddingTop: insets.top, height: insets.top + BAR_H }]}>
        <RoundButton label="Back" onPress={onBack}><BackGlyph size={22} color={AP.navy} /></RoundButton>
        <Animated.Text style={[s.barTitle, barFade]} numberOfLines={1}>{name}</Animated.Text>
        {onMore ? (
          <RoundButton label="More options" onPress={onMore}><MoreGlyph size={22} color={AP.navy} /></RoundButton>
        ) : (
          <View style={s.barSpacer} />
        )}
        <Animated.View pointerEvents="none" style={[s.barLine, barFade]} />
      </View>

      <AnimatedFlatList
        data={visible}
        keyExtractor={(j) => j.id}
        renderItem={({ item, index }) => (
          <View style={s.cell}>
            <JobCard
              job={item}
              index={index}
              revealed={reduce || revealed.has(item.id)}
              saved={isSaved?.(item.id) ?? false}
              onOpen={openJob}
              onToggleSave={toggleSave}
            />
          </View>
        )}
        extraData={revealed}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={VIEW_CONFIG}
        showsVerticalScrollIndicator={false}
        style={s.list}
      />

      <AreaSheet
        open={sheetOpen}
        subject={areaSubject}
        rows={areaRows}
        selected={area}
        onPick={pickArea}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  bar: {
    backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, zIndex: 2,
  },
  barTitle: { flex: 1, textAlign: 'center', fontFamily: F.h, fontSize: 16, color: AP.navy },
  barLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: LINE },
  round: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  list: { flex: 1, backgroundColor: '#FFFFFF' },
  gutter: { paddingHorizontal: 16 },
  upper: { paddingTop: 4, paddingBottom: 40 },
  // Art sits top-right, where the gradient is still white, so its soft halo blends in.
  art: { position: 'absolute', top: 0, right: 16, width: 112, height: 84, alignItems: 'center', justifyContent: 'center' },
  titleBesideArt: { paddingRight: 112 },
  barSpacer: { width: 44, height: 44 },
  title: { fontFamily: F.h, fontSize: 28, lineHeight: 32, letterSpacing: -0.45, color: AP.navy },
  sub: { fontFamily: F.m, fontSize: 13, color: AP.muted, marginTop: 2 },
  section: { fontFamily: F.h, fontSize: 18, color: AP.navy, marginBottom: 12 },
  emp: { width: 84, alignItems: 'center' },
  empName: { fontFamily: F.hb, fontSize: 13, lineHeight: 16, color: AP.navy, textAlign: 'center', marginTop: 8 },
  empCount: { fontFamily: F.m, fontSize: 12, color: AP.muted, marginTop: 1 },
  sheet: {
    marginTop: -OVERLAP, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 22,
    borderTopLeftRadius: SHEET_R, borderTopRightRadius: SHEET_R,
    // iOS shadowRadius is about half a CSS blur: 10 here matches the mock's 20px blur.
    shadowColor: AP.ink, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: -4 }, elevation: 2,
  },
  cell: { backgroundColor: '#FFFFFF', paddingHorizontal: 16 },
  footer: { backgroundColor: '#FFFFFF', paddingHorizontal: 16 },
  loading: { fontFamily: F.m, fontSize: 13, color: AP.muted, textAlign: 'center', paddingVertical: 24 },
});
