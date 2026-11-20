import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { tints } from './tokens';
import { peekFeedRead, useFeedClient } from '@/lib/feed-client';
import { useSearchLocation } from '@/hooks/use-search-location';
import { normalizePublishedJob } from '@/lib/job-record';
import { trpc } from '@/lib/trpc';
import { useRefetchMissingJobs } from "@/hooks/use-refetch-missing-jobs";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jobsJoinSettled, sectionLoadState } from '@/lib/useFirstLoadSkeletonFlag';
import { haversineKm } from '@/lib/nearestJobs';
import { haptic } from '@/lib/haptics';
import { useJobStore } from '@/components/job-store';
import { TextNew } from '@/src/new/components/TextNew';
import { PressableScaleNew } from '@/src/new/components/PrimitivesNew';
import { RevealOnScroll, ScrollRevealProvider } from '@/src/new/components/home/ScrollRevealNew';
import { ExploreSearch, ExploreTabs, type ExploreJobCard, type ExploreTab } from './v2/ExploreParts';
import { FilterStrip, JobListCard, JobListSkeleton } from './v2/ExploreListParts';
import { EmployerShowcase, FeaturedCarousel } from './v2/ExploreFeature';
import { ChevronDown, HeartOutline, PinGlyph } from './v2/ExploreGlyphs';
import { EX } from './v2/tokens';

/** Explore view-model: the card fields plus what the screen needs to route. */
type Job = ExploreJobCard & { company: string; initials: string; logoColor: string; posted?: string; tag?: string; arrangement?: string };

type Props = {
  locationLabel?: string;
  newJobsLabel?: string;
  /** Number of jobs the user has saved — shown as a badge on the heart icon. */
  savedCount?: number;
  onLocation?: () => void;
  onOpenSaved?: () => void;
  onSearch?: () => void;
  onFilterPress?: () => void;
  onOpenMap?: () => void;
};

/** Session seed for the Explore shuffle, cached after the first storage read. */
let exploreSeedMemo: string | null = null;

export default function ExploreScreen({
  locationLabel = 'Phnom Penh',
  newJobsLabel = '1,240 new jobs today',
  savedCount = 0,
  onLocation,
  onOpenSaved,
  onSearch,
  onFilterPress,
  onOpenMap,
}: Props = {}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { coordinates } = useSearchLocation();
  const client = useFeedClient();
  const [tab, setTab] = useState<ExploreTab>('jobs');
  // PERF: the session seed is remembered in memory, and the first fetch waits
  // for it. Before, every mount fetched once WITHOUT a seed, then the seed
  // arrived from storage, the list was cleared and fetched a second time.
  const [seed, setSeed] = useState<string | null>(exploreSeedMemo);
  const firstPageArgs = { lat: coordinates.latitude, lng: coordinates.longitude, prefs: null, limit: 20, seed: seed || undefined };
  // PERF: seed the first render from the last result, then re-validate.
  const cachedFirst = seed === null ? undefined : peekFeedRead<{ items: { jobId: string }[]; nextCursor: string | null }>('explore', firstPageArgs);
  const [jobs, setJobs] = useState<{ jobId: string }[]>(() => cachedFirst?.items ?? []);
  const [cursor, setCursor] = useState<string | null>(() => cachedFirst?.nextCursor ?? null);
  const [loading, setLoading] = useState(!cachedFirst);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => (cachedFirst ? !!cachedFirst.nextCursor : true));

  // Get or generate seed for this session
  useEffect(() => {
    if (exploreSeedMemo !== null) return;
    let active = true;
    AsyncStorage.getItem('explore_seed')
      .then((stored) => {
        const next = stored || Math.random().toString(36).substring(2, 15);
        if (!stored) void AsyncStorage.setItem('explore_seed', next);
        exploreSeedMemo = next;
        if (active) setSeed(next);
      })
      .catch(() => {
        exploreSeedMemo = '';
        if (active) setSeed('');
      });
    return () => { active = false; };
  }, []);

  // Reset the list when the query changes. Done during render (React's
  // recommended pattern) instead of synchronously inside the fetch effect.
  const queryKey = `${coordinates.latitude}|${coordinates.longitude}|${seed}`;
  const [prevQueryKey, setPrevQueryKey] = useState(queryKey);
  if (prevQueryKey !== queryKey) {
    setPrevQueryKey(queryKey);
    setLoading(!cachedFirst);
    setJobs(cachedFirst?.items ?? []);
    setCursor(cachedFirst?.nextCursor ?? null);
    setHasMore(cachedFirst ? !!cachedFirst.nextCursor : true);
  }

  // Fetch (or re-validate) the initial page once the seed is known.
  useEffect(() => {
    if (seed === null) return;
    let active = true;
    client
      .explore({ lat: coordinates.latitude, lng: coordinates.longitude, prefs: null, limit: 20, seed: seed || undefined })
      .then((page) => {
        if (active) {
          setJobs(page.items);
          setCursor(page.nextCursor);
          setHasMore(!!page.nextCursor);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [client, coordinates.latitude, coordinates.longitude, seed]);

  // Load more
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await client.explore({
        lat: coordinates.latitude,
        lng: coordinates.longitude,
        prefs: null,
        cursor,
        limit: 20,
        seed: seed || undefined,
      });
      setJobs((prev) => {
        const seen = new Set(prev.map((j) => j.jobId));
        const newItems = page.items.filter((item) => !seen.has(item.jobId));
        return [...prev, ...newItems];
      });
      setCursor(page.nextCursor);
      setHasMore(!!page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [client, coordinates.latitude, coordinates.longitude, cursor, hasMore, loadingMore, seed]);

  // Fetch job details
  const jobIds = useMemo(() => jobs.map((j) => j.jobId), [jobs]);
  const { data: jobRecords } = trpc.homlo.publicJobs.useQuery(undefined, {
    enabled: jobIds.length > 0,
  });
  useRefetchMissingJobs(jobIds, (jobRecords as any)?.jobs);

  const jobMap = useMemo(() => {
    const map = new Map<string, Job>();
    const records = (jobRecords as any)?.jobs ?? [];
    if (Array.isArray(records)) {
      for (const record of records) {
        try {
          const job = normalizePublishedJob(record);
          map.set(job.id, {
            id: job.id,
            title: job.title,
            company: job.company,
            pay: job.pay,
            image: job.image || undefined,
            locationKnown: job.location !== 'Location to be confirmed',
            positionsTotal: job.positionsTotal ?? 0,
            positionsFilled: job.positionsFilled ?? 0,
            posted: job.posted,
            tag: job.tag,
            arrangement: job.arrangement,
            // Real distance from the searcher when the job has a map position (was a random number).
            distance: typeof job.latitude === 'number' && typeof job.longitude === 'number'
              ? `${Math.max(1, Math.round(haversineKm(coordinates.latitude, coordinates.longitude, job.latitude, job.longitude)))} km`
              : job.location ? 'Nearby' : 'Remote',
            initials: job.company.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
            logoColor: tints.lagoon.ink,
            boosted: job.boosted,
          });
        } catch (cause) {
          console.warn("[Explore] normalizePublishedJob failed", cause);
        }
      }
    }
    return map;
  }, [jobRecords, coordinates.latitude, coordinates.longitude]);

  const displayJobs = useMemo(() =>
    jobs.map((j) => jobMap.get(j.jobId)).filter((j): j is Job => !!j),
    [jobs, jobMap]
  );

  // Ids without their job records is "not ready", never "no jobs".
  const showSkeleton = sectionLoadState({
    settled: jobsJoinSettled({ idsSettled: !loading, idCount: jobs.length, recordsLoaded: jobRecords !== undefined }),
    count: displayJobs.length,
  }) === 'loading';

  const { isSaved, toggleSaved } = useJobStore();
  const openJob = useCallback((j: Job) => router.push({ pathname: '/job/[id]', params: { id: j.id } } as never), [router]);
  // Same visitor ("second person") view the job detail's "About this employer" card opens.
  const openEmployer = useCallback(
    (employerId: string) => router.push(`/employer/${employerId}` as never),
    [router],
  );
  const onToggleSave = useCallback((id: string) => { haptic.selection(); toggleSaved(id); }, [toggleSaved]);

  // Coming back from the map always shows Jobs as selected.
  useFocusEffect(useCallback(() => { setTab('jobs'); }, []));

  const onTab = (t: ExploreTab) => {
    if (t === 'map') {
      if (onOpenMap) onOpenMap();
      else router.push('/jobs-map' as never); // ← the app's EXISTING job map route
      return;
    }
    setTab(t);
  };

  /* ───── scroll: the header scrolls away, the tab bar pins under the status bar ───── */
  const { height: viewportH } = useWindowDimensions();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
  const [headerH, setHeaderH] = useState(0);
  const pinY = insets.top;
  const pinAt = Math.max(1, headerH - pinY);
  // The real tab bar scrolls with the page; a fixed copy takes over at the top once it reaches there.
  // The copy only accepts touches while shown (React state), so taps never land on a stale position.
  const pinnedFx = useAnimatedStyle(() => ({ opacity: y.value >= pinAt - 0.5 ? 1 : 0 }));
  const [pinned, setPinned] = useState(false);
  useAnimatedReaction(() => y.value >= pinAt - 0.5, (now, prev) => { if (now !== prev) runOnJS(setPinned)(now); }, [pinAt]);

  /* scroll motion: the header folds away softly; the warm shade drifts slower than the page */
  const progress = useDerivedValue(() => Math.min(1, Math.max(0, y.value / pinAt)));
  const warmFx = useAnimatedStyle(() => ({ transform: [{ translateY: y.value > 0 ? y.value * 0.45 : 0 }] }));
  const headFx = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, pinAt * 0.55], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(y.value, [-120, 0, pinAt], [1.04, 1, 0.94], Extrapolation.CLAMP) }],
  }));
  const searchFx = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [pinAt * 0.25, pinAt * 0.9], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(y.value, [0, pinAt], [1, 0.95], Extrapolation.CLAMP) }],
  }));

  /** Tapping a tab pushes the header up so only the tabs stay at the top. */
  const collapseToTabs = useCallback(() => {
    if (y.value < pinAt) scrollRef.current?.scrollTo({ y: pinAt, animated: true });
  }, [pinAt, scrollRef, y]);

  const onTabPress = (t: ExploreTab) => {
    onTab(t);
    if (t !== 'map') collapseToTabs();
  };

  // Featured: promoted listings first, then the freshest; the list below shows the rest.
  const featured = useMemo(
    () => [...displayJobs].sort((p, q) => Number(!!q.boosted) - Number(!!p.boosted)).slice(0, 5),
    [displayJobs],
  );
  const list = useMemo(() => {
    const top = new Set(featured.map((j) => j.id));
    return displayJobs.filter((j) => !top.has(j.id));
  }, [displayJobs, featured]);

  // Employers come from the live public job feed: one entry per employer name,
  // busiest first. The id is the slug form the employer pages already resolve
  // (emp-<name>), so the profile and its "view all jobs" page load real listings.
  const employers = useMemo(() => {
    const palette: { color: string; cover: [string, string] }[] = [
      { color: EX.navy, cover: ['#21486A', '#14324A'] },
      { color: '#2B5577', cover: ['#F7B54A', '#E8870F'] },
      { color: EX.cyanDeep, cover: ['#1BA6C4', '#0B6F8A'] },
      { color: EX.cyan, cover: ['#5E86A8', '#2E5476'] },
      { color: '#3D6283', cover: ['#34B39E', '#1F8A79'] },
    ];
    const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const counts = new Map<string, number>();
    for (const j of jobMap.values()) {
      const name = j.company?.trim();
      if (!name || name === 'Homlo employer') continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const names = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 5);
    const list = names.length > 0 ? names : ['Riverstone Hotel', 'Common Grounds', 'Maison Local', 'Cloud Desk', 'Kiri Labs'];
    return list.map((name, i) => ({
      id: `emp-${slug(name)}`,
      name,
      initials: name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      ...palette[i % palette.length],
    }));
  }, [jobMap]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120, minHeight: viewportH + pinAt }}
      >
        <ScrollRevealProvider scrollY={y} viewportH={viewportH}>
          {/* white header with a warm shade at the very top */}
          <View onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)} style={[styles.header, { paddingTop: insets.top + 6 }]}>
            {/* the warm shade continues far above the top, so pulling down never reveals white */}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, warmFx]}>
              <View style={styles.warmAbove} />
              <LinearGradient colors={['#FFE9C7', '#FFF6E6', '#FFFFFF']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Animated.View style={[styles.headTop, headFx]}>
              <View style={{ flexShrink: 1 }}>
                <TextNew variant="hero" heading weight="extrabold" color={EX.navy} style={styles.title}>Explore jobs</TextNew>
                <PressableScaleNew onPress={onLocation} scaleTo={0.97} accessibilityLabel={`Your area: ${locationLabel}`} style={styles.loc}>
                  <PinGlyph size={16} color={EX.cyanDeep} />
                  <TextNew variant="body" heading weight="bold" color={EX.navy} numberOfLines={1} style={{ flexShrink: 1 }}>{locationLabel}</TextNew>
                  <ChevronDown size={14} color={EX.slate} />
                </PressableScaleNew>
              </View>
              <Pressable onPress={onOpenSaved} style={[styles.heart, styles.heartShadow]} accessibilityRole="button" accessibilityLabel="Saved jobs">
                <HeartOutline color={EX.navy} />
                {savedCount > 0 && (
                  <View style={styles.badge}>
                    <TextNew variant="caption" heading weight="extrabold" color={EX.white} style={{ fontSize: 11, lineHeight: 14 }}>
                      {savedCount > 99 ? '99+' : savedCount}
                    </TextNew>
                  </View>
                )}
              </Pressable>
            </Animated.View>
            <Animated.View style={[{ marginTop: 16 }, searchFx]}>
              <ExploreSearch onPress={onSearch ?? (() => {})} onFilter={onFilterPress ?? (() => {})} />
            </Animated.View>
          </View>

          {/* the tab bar in its natural place; a hairline separates it from the results */}
          <View style={styles.tabsInline}>
            <ExploreTabs value={tab} onChange={onTabPress} progress={progress} />
            <View style={styles.hairline} />
          </View>

          {tab === 'jobs' ? (
            <View style={{ paddingTop: 18 }}>
              {showSkeleton ? (
                <JobListSkeleton />
              ) : displayJobs.length === 0 ? (
                <View style={styles.empty}>
                  <TextNew variant="section" heading weight="extrabold" color={EX.navy} align="center">No jobs around here yet</TextNew>
                  <TextNew variant="body" color={EX.muted} align="center" style={{ marginTop: 4 }}>Try another area or widen your filters.</TextNew>
                </View>
              ) : (
                <>
                  <RevealOnScroll>
                    <TextNew variant="header" heading weight="extrabold" color={EX.navy} style={styles.h2}>Featured for you</TextNew>
                    <FeaturedCarousel
                      jobs={featured}
                      isSaved={isSaved}
                      onOpen={(id) => { const j = featured.find((f) => f.id === id); if (j) openJob(j); }}
                      onToggleSave={onToggleSave}
                    />
                  </RevealOnScroll>
                  {list.length > 0 && (
                    <>
                      <RevealOnScroll>
                        <TextNew variant="header" heading weight="extrabold" color={EX.navy} style={styles.h2}>More near {locationLabel}</TextNew>
                      </RevealOnScroll>
                      <View style={styles.list}>
                        {list.map((j, i) => (
                          <RevealOnScroll key={j.id} index={i % 4}>
                            <JobListCard job={j} index={i} saved={isSaved(j.id)} onPress={() => openJob(j)} onToggleSave={() => onToggleSave(j.id)} />
                          </RevealOnScroll>
                        ))}
                      </View>
                    </>
                  )}
                </>
              )}

              {loadingMore && <TextNew variant="body" color={EX.muted} align="center" style={{ padding: 16 }}>Loading more…</TextNew>}
              {hasMore && !loadingMore && !showSkeleton && (
                <PressableScaleNew onPress={loadMore} scaleTo={0.96} accessibilityLabel="Load more jobs" style={styles.more}>
                  <TextNew variant="body" heading weight="bold" color={EX.navy}>Load more jobs</TextNew>
                </PressableScaleNew>
              )}
              {!showSkeleton && <FilterStrip onPress={onFilterPress ?? (() => {})} />}
            </View>
          ) : (
            <View style={{ paddingTop: 20 }}>
              <RevealOnScroll>
                <EmployerShowcase employers={employers} location={locationLabel} onOpen={openEmployer} />
              </RevealOnScroll>
            </View>
          )}
        </ScrollRevealProvider>
      </Animated.ScrollView>

      {/* status-bar backdrop once the tabs have pinned */}
      <Animated.View pointerEvents="none" style={[styles.status, { height: insets.top }, pinnedFx]} />

      {/* pinned copy of the tab bar, shown once the real one reaches the top */}
      <Animated.View pointerEvents={pinned ? 'auto' : 'none'} style={[styles.tabs, { top: insets.top }, styles.tabsShadow, pinnedFx]}>
        <ExploreTabs value={tab} onChange={onTabPress} progress={progress} />
        <View style={styles.hairline} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: EX.white },
  header: { paddingHorizontal: 16, paddingBottom: 16, overflow: 'visible' },
  warmAbove: { position: 'absolute', left: 0, right: 0, top: -1600, height: 1601, backgroundColor: '#FFE9C7' },
  h2: { fontSize: 20, lineHeight: 25, paddingHorizontal: 16, marginBottom: 10 },
  headTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  loc: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, minHeight: 28, alignSelf: 'flex-start' },
  heart: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    backgroundColor: EX.white, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E3D8C4',
  },
  heartShadow: { shadowColor: '#7A4A10', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  badge: {
    position: 'absolute', top: -4, right: -4, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11,
    backgroundColor: EX.navy, borderWidth: 2, borderColor: EX.white, alignItems: 'center', justifyContent: 'center',
  },
  tabs: { position: 'absolute', left: 0, right: 0, backgroundColor: EX.white, zIndex: 10, elevation: 10 },
  tabsInline: { backgroundColor: EX.white },
  tabsShadow: { backgroundColor: EX.white, shadowColor: '#12303C', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: '#C9D6DB' },
  status: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: EX.white, zIndex: 11 },
  results: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 14, marginBottom: 10 },
  list: { gap: 12, paddingHorizontal: 16 },
  empty: { paddingVertical: 40, paddingHorizontal: 32 },
  more: {
    alignSelf: 'center', marginTop: 16, height: 44, paddingHorizontal: 22, borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#C9D6DB', backgroundColor: EX.white, alignItems: 'center', justifyContent: 'center',
  },
  empCard: {
    marginHorizontal: 16, paddingHorizontal: 14, borderRadius: 18, backgroundColor: EX.white,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9E3E7',
  },
});
