// Page 1 of 4: Recommended. Hero "Top match", category selector circles, match-gauge list.
// Visual style follows DESIGN_STYLE.md (parts in components/recommended/RecommendedParts).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JobFieldArtwork } from '@/components/shared/JobFieldArtwork';
import { JOB_FIELDS, resolveJobField } from '@/lib/job-fields';
import { useSavedJobs } from '@/lib/jobsData';
import { palette } from '@/src/design/tokens';
import { SMOOTH } from '@/src/design/motion';
import { F } from '@/components/vista/category/tokens';
import { BackGlyph } from '@/components/vista/category/glyphs';
import {
  CategoryRow, DotsGlyph, GridGlyph, MatchJobCard, OutlineButton, SectionHeader, enter,
} from '@/components/recommended/RecommendedParts';
import { TopMatchCard } from '@/components/recommended/TopMatchCard';
import { fonts } from '@/lib/typography';
import SunriseBannerHeroMk7 from '@/components/recommended/SunriseBannerHeroMk7';
import { peekFeedRead, useFeedClient } from '@/lib/feed-client';
import { useSearchLocation } from '@/hooks/use-search-location';
import { normalizePublishedJob } from '@/lib/job-record';
import { trpc } from '@/lib/trpc';
import { useRefetchMissingJobs } from "@/hooks/use-refetch-missing-jobs";
import { jobsJoinSettled, sectionLoadState } from '@/lib/useFirstLoadSkeletonFlag';
import { JobsUiListSkeleton } from '@/src/new/components/NewSkeletons';

/** Height of the compact top bar that glides in once the banner scrolls away. */
const TOP_BAR = 52;
/** How far the Top-match card overlaps the banner (OverlapCard's marginTop). */
const CARD_OVERLAP = 30;

/** Space reserved at the top of the banner for the back button. */
const BACK_CLEARANCE = 44;
/** Banner height below the status bar (default 290, plus room for the back button). */
const HERO_BODY = 290 + BACK_CLEARANCE;

/** Category row: "All", then the 3 job fields with the most matches, then "Others". */
const TOP_FIELDS = 3;
const fieldIdOf = (category: string | undefined) => resolveJobField(category)?.id ?? 'other';

export default function RecommendedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saved, toggle } = useSavedJobs();
  const { coordinates } = useSearchLocation();
  const client = useFeedClient();

  const [cat, setCat] = useState('all');
  // PERF: seed the first render from the last result, then re-validate.
  const cachedFirst = peekFeedRead<{ items: { jobId: string }[]; nextCursor: string | null }>('recommended', { lat: coordinates.latitude, lng: coordinates.longitude, prefs: null, limit: 20 });
  const [jobs, setJobs] = useState<{ jobId: string }[]>(() => cachedFirst?.items ?? []);
  const [cursor, setCursor] = useState<string | null>(() => cachedFirst?.nextCursor ?? null);
  const [loading, setLoading] = useState(!cachedFirst);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => (cachedFirst ? !!cachedFirst.nextCursor : true));

  // Reset the list when the query changes. Done during render (React's
  // recommended pattern) instead of synchronously inside the fetch effect.
  const queryKey = `${coordinates.latitude}|${coordinates.longitude}`;
  const [prevQueryKey, setPrevQueryKey] = useState(queryKey);
  if (prevQueryKey !== queryKey) {
    setPrevQueryKey(queryKey);
    setLoading(!cachedFirst);
  }

  // Fetch initial page
  useEffect(() => {
    let active = true;
    client
      .recommended({ lat: coordinates.latitude, lng: coordinates.longitude, prefs: null, limit: 20 })
      .then((page) => {
        if (active) {
          setJobs(page.items);
          setCursor(page.nextCursor);
          setHasMore(!!page.nextCursor);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
    return () => { active = false; };
  }, [client, coordinates.latitude, coordinates.longitude]);

  // Load more
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await client.recommended({
        lat: coordinates.latitude,
        lng: coordinates.longitude,
        prefs: null,
        cursor,
        limit: 20,
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
  }, [client, coordinates.latitude, coordinates.longitude, cursor, hasMore, loadingMore]);

  // Fetch job details
  const jobIds = useMemo(() => jobs.map((j) => j.jobId), [jobs]);
  const { data: jobRecords } = trpc.homlo.publicJobs.useQuery(undefined, {
    enabled: jobIds.length > 0,
  });
  useRefetchMissingJobs(jobIds, (jobRecords as any)?.jobs);

  const jobMap = useMemo(() => {
    const map = new Map<string, any>();
    const records = (jobRecords as any)?.jobs ?? [];
    if (Array.isArray(records)) {
      for (const record of records) {
        try {
          const job = normalizePublishedJob(record);
          map.set(job.id, job);
        } catch (cause) {
          console.warn("[Recommended] normalizePublishedJob failed", cause);
        }
      }
    }
    return map;
  }, [jobRecords]);

  const top = jobMap.get(jobs[0]?.jobId);
  const allJobs = useMemo(
    () => jobs.map((j) => jobMap.get(j.jobId)).filter((j): j is any => !!j),
    [jobs, jobMap],
  );
  // The 3 fields (of the 19) with the most recommended jobs right now.
  const topFields = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of allJobs) {
      const id = fieldIdOf(j.category);
      if (id !== 'other') counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, TOP_FIELDS)
      .map(([id]) => JOB_FIELDS.find((f) => f.id === id)!)
      .filter(Boolean);
  }, [allJobs]);
  const list = useMemo(() => {
    if (cat === 'all') return allJobs;
    if (cat === 'others') {
      const top = new Set<string>(topFields.map((f) => f.id));
      return allJobs.filter((j) => !top.has(fieldIdOf(j.category)));
    }
    return allJobs.filter((j) => fieldIdOf(j.category) === cat);
  }, [allJobs, topFields, cat]);
  // A selected field that drops out of the top 3 falls back to "All".
  if (cat !== 'all' && cat !== 'others' && topFields.length > 0 && !topFields.some((f) => f.id === cat)) {
    setCat('all');
  }

  const openJob = (id: string) => router.push({ pathname: '/job/[id]', params: { id } } as never);

  // Skeleton until the ranked ids AND their job records are in: ids without
  // records is "not ready", not "no jobs" (exactly what sign-in's cache clear
  // produces), so the list no longer flashes empty.
  const showSkeleton = sectionLoadState({
    settled: jobsJoinSettled({ idsSettled: !loading, idCount: jobs.length, recordsLoaded: jobRecords !== undefined }),
    count: list.length,
  }) === 'loading';

  // Parallax: the banner sits behind the scroll content. Scrolling up, the
  // content slides over it while the banner drifts up at half speed and fades.
  const reduced = useReducedMotion();
  const heroHeight = insets.top + HERO_BODY;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  // Scroll offset where the Top-match card meets the compact top bar: the
  // banner is fully gone and the bar is fully in. Releasing anywhere between 0
  // and this point snaps to one end, so the banner never rests half-faded.
  const topBarHeight = insets.top + TOP_BAR;
  const collapseAt = Math.max(1, heroHeight - CARD_OVERLAP - topBarHeight);

  const heroStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    // Fully faded well before the cards reach the top: no long half-transparent phase.
    const opacity = interpolate(y, [0, collapseAt * 0.7], [1, 0], Extrapolation.CLAMP);
    if (reduced) return { opacity };
    // Scrolling up: the banner drifts up at half speed while fading. Pulling down
    // at the top no longer zooms it in: it simply holds still behind the content.
    return {
      opacity,
      transform: [{ translateY: y > 0 ? -y * 0.5 : 0 }],
    };
  });

  // Compact bar glides down over the last stretch before the collapse point.
  const topBarStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const p = interpolate(y, [collapseAt - 70, collapseAt], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: reduced ? 0 : (1 - p) * -topBarHeight }] };
  });
  // The floating round back button hands over to the bar's back button.
  const floatingBackStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [collapseAt - 90, collapseAt - 40], [1, 0], Extrapolation.CLAMP),
  }));
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as never);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }}>
      <Animated.View
        pointerEvents="none"
        entering={reduced ? undefined : FadeIn.duration(450).easing(SMOOTH)}
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: heroHeight, transformOrigin: 'top' }, heroStyle]}
      >
        <SunriseBannerHeroMk7
          title="Recommended"
          edgeColor="#fff"
          bodyHeight={HERO_BODY}
          contentOffset={BACK_CLEARANCE}
          headingFont={fonts.heading.extrabold}
          bodyFont={fonts.body.regular}
        />
      </Animated.View>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        // Settles to "banner open" or "banner collapsed"; below that, free scrolling.
        snapToOffsets={[0, collapseAt]}
        snapToEnd={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Transparent window onto the banner behind the content. */}
        <View style={{ height: heroHeight }} />
        <View style={{ backgroundColor: palette.surface }}>
          {top && (
            <Animated.View entering={reduced ? undefined : enter(1)}>
              <TopMatchCard
                title={top.title}
                company={top.company}
                place={top.location?.split(',')[0] ?? ''}
                pay={top.pay}
                type={top.tag}
                image={top.image}
                spotsLeft={top.positionsAvailable}
                spotsTotal={top.positionsTotal}
                match={85}
                skills={['Coffee skills', 'Weekends', 'Khmer + English']}
                saved={saved.has(top.id)}
                onOpen={() => openJob(top.id)}
                onApply={() => router.push({ pathname: '/job/[id]/apply', params: { id: top.id } } as never)}
                onToggleSave={() => toggle(top.id)}
              />
            </Animated.View>
          )}

          <Animated.View entering={reduced ? undefined : enter(2)} style={{ marginTop: 22 }}>
            <CategoryRow
              items={[
                { id: 'all', label: 'All', icon: <GridGlyph /> },
                ...topFields.map((f) => ({ id: f.id, label: f.title, icon: <JobFieldArtwork xml={f.svg} size={40} /> })),
                { id: 'others', label: 'Others', icon: <DotsGlyph /> },
              ]}
              selected={cat}
              onSelect={setCat}
            />
          </Animated.View>

          <Animated.View entering={reduced ? undefined : enter(3)}>
            <SectionHeader title="Matched to your skills" count={showSkeleton ? undefined : `${list.length} jobs`} />
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              {showSkeleton ? (
                <JobsUiListSkeleton gap={12} style={{ paddingHorizontal: 0 }} />
              ) : (
                <>
                  {list.map((j, i) => (
                    <Animated.View key={j.id} entering={reduced || i > 3 ? undefined : enter(4 + i)}>
                      <MatchJobCard
                        title={j.title}
                        company={j.company}
                        place={j.location?.split(',')[0] ?? ''}
                        pay={j.pay}
                        type={j.tag}
                        match={85}
                        boosted={j.boosted}
                        onPress={() => openJob(j.id)}
                      />
                    </Animated.View>
                  ))}
                  {loadingMore && <Text style={s.loadingMore}>Loading more…</Text>}
                  {hasMore && !loadingMore && <OutlineButton label="Load more" onPress={loadMore} />}
                </>
              )}
            </View>
          </Animated.View>
        </View>
      </Animated.ScrollView>
      {/* Compact top bar: glides down once the banner has scrolled away. */}
      <Animated.View style={[s.topBar, { height: topBarHeight, paddingTop: insets.top }, topBarStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={4}
          onPress={goBack}
          style={({ pressed }) => [s.topBarBack, { opacity: pressed ? 0.7 : 1 }]}
        >
          <BackGlyph size={22} color={palette.navy} />
        </Pressable>
        <Text style={s.topBarTitle} numberOfLines={1}>Recommended</Text>
        <View style={{ width: 44 }} />
      </Animated.View>

      {/* Floating back button over the banner: below the status bar / Dynamic Island. */}
      <Animated.View style={[s.backBtnWrap, { top: insets.top + 8, left: 16 }, floatingBackStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={4}
          onPress={goBack}
          style={({ pressed }) => [s.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <BackGlyph size={22} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backBtnWrap: { position: 'absolute', zIndex: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(18,48,60,0.32)', alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12,
    backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: '#E3E9EC',
  },
  topBarBack: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#E3E9EC', backgroundColor: palette.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarTitle: { flex: 1, textAlign: 'center', fontFamily: F.h, fontSize: 16, color: palette.navy },
  loadingMore: { textAlign: 'center', fontFamily: F.m, fontSize: 13, color: palette.muted, paddingVertical: 12 },
});
