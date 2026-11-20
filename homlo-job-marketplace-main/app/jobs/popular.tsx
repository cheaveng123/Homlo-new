// Popular ranking: "Most applied to" jobs. Reached from the home page's
// "Popular" section "See all". Fed by the anonymous popularity-based backend.
//
// Design (photo-first travel-style layout):
//   header  back · "Popular jobs" + subtitle · saved
//   period  "Pick a period" + dark pill chips (Today / This week / This month)
//   top 5   swipeable tall photo cards (title over a dark fade, save heart,
//           "View job" pill + round arrow); off-centre cards ease smaller
//   rest    "More popular jobs" list of photo cards with a round arrow button
//   paging  "Load more" (20 per page, unchanged)
// Motion: house no-bounce curve; cards fade up; Reduce Motion skips the carousel scaling.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { useJobStore } from '@/components/job-store';
import { AppIcon } from '@/components/ui/AppIcon';
import { LogoMark } from '@/components/vista/category/LogoMark';
import { AP, CITY, F, LINE, plural } from '@/components/vista/category/tokens';
import { toVistaJob, type PublishedJobLike } from '@/components/vista/toVistaJob';
import { useSearchLocation } from '@/hooks/use-search-location';
import { resolveJobImage } from '@/lib/job-banner';
import { logJobEvent } from '@/lib/event-logging';
import { peekFeedRead, useFeedClient } from '@/lib/feed-client';
import { haptic } from '@/lib/haptics';
import { goBack } from '@/lib/navigation';
import { trpc } from '@/lib/trpc';
import { useRefetchMissingJobs } from "@/hooks/use-refetch-missing-jobs";
import { jobsJoinSettled, sectionLoadState } from '@/lib/useFirstLoadSkeletonFlag';
import { PressableScale, Reveal } from '@/src/design/motion';
import { JobsUiListSkeleton } from '@/src/new/components/NewSkeletons';

type Period = 'today' | 'week' | 'month';
const PERIODS: { id: Period; label: string; phrase: string }[] = [
  { id: 'today', label: 'Today', phrase: 'today' },
  { id: 'week', label: 'This week', phrase: 'this week' },
  { id: 'month', label: 'This month', phrase: 'this month' },
];

const FEATURED = 5;
const CARD_GAP = 14;
const SIDE = 20;
const DARK = '#0F2333';
const SOFT = '#F2F5F6';

type PopularItem = {
  id: string;
  title: string;
  company: string;
  place: string | null;
  pay: number;
  payUnit: string;
  logoUrl: string | null | undefined;
  image: string;
  boosted: boolean;
};

const payLabel = (j: PopularItem) => (j.pay ? `$${j.pay.toLocaleString('en-US')}` : 'Pay on request');

/* ---------------- top 5: tall photo cards ---------------- */

function FeatureCard({
  job,
  index,
  width,
  scrollX,
  animate,
  saved,
  onOpen,
  onToggleSave,
}: {
  job: PopularItem;
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  animate: boolean;
  saved: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  const step = width + CARD_GAP;
  const st = useAnimatedStyle(() => {
    if (!animate) return {};
    const d = (scrollX.value - index * step) / step;
    return {
      transform: [{ scale: interpolate(Math.abs(d), [0, 1], [1, 0.92], Extrapolation.CLAMP) }],
      opacity: interpolate(Math.abs(d), [0, 1], [1, 0.7], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View style={[{ width, marginRight: CARD_GAP }, st]}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${job.title} at ${job.company}`} style={s.feature}>
        <Image source={{ uri: job.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(15,35,51,0)', 'rgba(15,35,51,0.15)', 'rgba(15,35,51,0.88)']}
          locations={[0.3, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={s.featureTop}>
          <View style={s.rankPill}>
            <AppIcon name="chart" size={13} strokeWidth={2.2} color={AP.amberDeep} />
            <Text style={s.rankPillText}>#{index + 1} most applied</Text>
          </View>
          <Pressable
            onPress={onToggleSave}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save job'}
            style={s.heart}
          >
            <AppIcon name="heart" size={19} strokeWidth={2} color={saved ? '#FF6B6B' : '#FFFFFF'} />
          </Pressable>
        </View>

        <View style={s.featureBottom}>
          <View style={s.companyRow}>
            <LogoMark company={job.company} uri={job.logoUrl} size={26} radius={8} />
            <Text style={s.featureCompany} numberOfLines={1}>{job.company}</Text>
          </View>
          <Text style={s.featureTitle} numberOfLines={2}>{job.title}</Text>
          <View style={s.featureMeta}>
            <Text style={s.featurePay}>{payLabel(job)}</Text>
            {job.pay ? <Text style={s.featureUnit}>{job.payUnit}</Text> : null}
            {job.place ? (
              <>
                <View style={s.dot} />
                <AppIcon name="pin" size={13} strokeWidth={2} color="rgba(255,255,255,0.85)" />
                <Text style={s.featurePlace} numberOfLines={1}>{job.place}</Text>
              </>
            ) : null}
          </View>
          <View style={s.featureActions}>
            <View style={s.viewPill}>
              <Text style={s.viewPillText}>View job</Text>
            </View>
            <View style={s.arrowWhite}>
              <AppIcon name="arrow" size={18} strokeWidth={2.2} color={DARK} />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ---------------- the rest: photo list cards ---------------- */

function ListCard({ job, index, rank, saved, onOpen, onToggleSave }: {
  job: PopularItem; index: number; rank: number; saved: boolean; onOpen: () => void; onToggleSave: () => void;
}) {
  return (
    <Reveal index={index}>
      <PressableScale accessibilityRole="button" accessibilityLabel={`${job.title} at ${job.company}`} onPress={onOpen} scale={0.98} style={s.row}>
        <View style={s.thumb}>
          <Image source={{ uri: job.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={s.thumbRank}>
            <Text style={s.thumbRankText}>#{rank}</Text>
          </View>
        </View>
        <View style={s.rowBody}>
          <Text style={s.rowTitle} numberOfLines={2}>{job.title}</Text>
          <Text style={s.rowMeta} numberOfLines={1}>
            {job.company}
            {job.place ? ` · ${job.place}` : ''}
          </Text>
          <View style={s.rowPayLine}>
            <Text style={s.rowPay}>{payLabel(job)}</Text>
            {job.pay ? <Text style={s.rowUnit}>{job.payUnit}</Text> : null}
            {job.boosted ? (
              <View style={s.adTag}>
                <Text style={s.adText}>Ad</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={s.rowSide}>
          <Pressable onPress={onToggleSave} hitSlop={10} accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved' : 'Save job'}>
            <AppIcon name="heart" size={18} strokeWidth={2} color={saved ? '#FF6B6B' : '#9AAAB1'} />
          </Pressable>
          <View style={s.arrowDark}>
            <AppIcon name="arrow" size={16} strokeWidth={2.2} color="#FFFFFF" />
          </View>
        </View>
      </PressableScale>
    </Reveal>
  );
}

/* ---------------- screen ---------------- */

export default function PopularRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const { coordinates } = useSearchLocation();
  const client = useFeedClient();
  const { isSaved, toggleSaved, savedIds } = useJobStore();

  const [period, setPeriod] = useState<Period>('week');
  // PERF: seed the first render from the last result, then re-validate.
  const cachedFirst = peekFeedRead<{ items: { jobId: string }[]; nextCursor: string | null }>('popular', { lat: coordinates.latitude, lng: coordinates.longitude, prefs: null, limit: 20, period });
  const [jobs, setJobs] = useState<{ jobId: string }[]>(() => cachedFirst?.items ?? []);
  const [cursor, setCursor] = useState<string | null>(() => cachedFirst?.nextCursor ?? null);
  const [loading, setLoading] = useState(!cachedFirst);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => (cachedFirst ? !!cachedFirst.nextCursor : true));

  // Reset the list when the query changes. Done during render (React's
  // recommended pattern) instead of synchronously inside the fetch effect.
  const queryKey = `${coordinates.latitude}|${coordinates.longitude}|${period}`;
  const [prevQueryKey, setPrevQueryKey] = useState(queryKey);
  if (prevQueryKey !== queryKey) {
    setPrevQueryKey(queryKey);
    setLoading(!cachedFirst);
    setJobs(cachedFirst?.items ?? []);
    setCursor(cachedFirst?.nextCursor ?? null);
    setHasMore(cachedFirst ? !!cachedFirst.nextCursor : true);
  }

  // Fetch the first page when the period changes.
  useEffect(() => {
    let active = true;
    client
      .popular({ lat: coordinates.latitude, lng: coordinates.longitude, prefs: null, limit: 20, period })
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
    return () => {
      active = false;
    };
  }, [client, coordinates.latitude, coordinates.longitude, period]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await client.popular({
        lat: coordinates.latitude,
        lng: coordinates.longitude,
        prefs: null,
        cursor,
        limit: 20,
        period,
      });
      setJobs((prev) => {
        const seen = new Set(prev.map((j) => j.jobId));
        return [...prev, ...page.items.filter((item) => !seen.has(item.jobId))];
      });
      setCursor(page.nextCursor);
      setHasMore(!!page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [client, coordinates.latitude, coordinates.longitude, cursor, hasMore, loadingMore, period]);

  // Job details for the ranked ids, kept in ranking order.
  const { data: jobRecords } = trpc.homlo.publicJobs.useQuery(undefined, { enabled: jobs.length > 0 });
  const rankedIds = useMemo(() => jobs.map((j) => j.jobId), [jobs]);
  useRefetchMissingJobs(rankedIds, (jobRecords as { jobs?: { id?: unknown }[] } | undefined)?.jobs);
  const popular = useMemo<PopularItem[]>(() => {
    type Rec = PublishedJobLike & { boosted?: boolean; banner_image?: string | null };
    const records = ((jobRecords as { jobs?: Rec[] } | undefined)?.jobs ?? []);
    const byId = new Map(records.map((r) => [r.id, r]));
    const out: PopularItem[] = [];
    for (const { jobId } of jobs) {
      const record = byId.get(jobId);
      if (!record) continue;
      const card = toVistaJob(record, coordinates);
      out.push({
        id: card.id,
        title: card.title,
        company: card.company,
        place: record.location_text?.split(',')[0]?.trim() || null,
        pay: card.pay,
        payUnit: card.payUnit ?? '/mo',
        logoUrl: card.logoUrl,
        image: resolveJobImage(record.banner_image),
        boosted: !!record.boosted,
      });
    }
    return out;
  }, [jobRecords, jobs, coordinates]);

  // Ids without their job records is "not ready", never "no jobs".
  const showSkeleton = sectionLoadState({
    settled: jobsJoinSettled({ idsSettled: !loading, idCount: jobs.length, recordsLoaded: jobRecords !== undefined }),
    count: popular.length,
  }) === 'loading';

  const featured = popular.slice(0, FEATURED);
  const rest = popular.slice(FEATURED);
  const phrase = PERIODS.find((p) => p.id === period)?.phrase ?? 'this week';
  const cardW = Math.min(width * 0.74, 340);

  const scrollX = useSharedValue(0);
  const onCarousel = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const open = (id: string) => {
    haptic.light();
    logJobEvent({ jobId: id, eventType: 'click', feedContext: 'popular' });
    router.push({ pathname: '/job/[id]', params: { id } } as never);
  };
  const save = (id: string) => {
    haptic.selection();
    toggleSaved(id);
  };

  return (
    <View style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }}>
        {/* header */}
        <Reveal index={0}>
          <View style={s.header}>
            <PressableScale accessibilityRole="button" accessibilityLabel="Go back" onPress={() => goBack(router)} scale={0.92} style={s.roundBtn}>
              <AppIcon name="back" size={20} strokeWidth={2} color={DARK} />
            </PressableScale>
            <View style={{ flex: 1 }}>
              <Text style={s.hello} accessibilityRole="header">Popular jobs</Text>
              <Text style={s.helloSub}>Most applied to in {CITY}</Text>
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Saved jobs, ${savedIds.length}`}
              onPress={() => router.push('/saved' as never)}
              scale={0.92}
              style={s.roundBtn}
            >
              <AppIcon name="heart" size={19} strokeWidth={2} color={DARK} />
              {savedIds.length > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{savedIds.length > 9 ? '9+' : savedIds.length}</Text>
                </View>
              )}
            </PressableScale>
          </View>
        </Reveal>

        {/* period */}
        <Reveal index={1}>
          <Text style={s.sectionLabel}>Pick a period</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {PERIODS.map((p) => {
              const on = period === p.id;
              return (
                <PressableScale
                  key={p.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    if (on) return;
                    haptic.selection();
                    setPeriod(p.id);
                  }}
                  scale={0.95}
                  style={[s.chip, on && s.chipOn]}
                >
                  <Text style={[s.chipText, on && s.chipTextOn]}>{p.label}</Text>
                </PressableScale>
              );
            })}
          </ScrollView>
        </Reveal>

        {showSkeleton ? (
          <View style={{ paddingHorizontal: SIDE, marginTop: 20 }}>
            <JobsUiListSkeleton gap={12} style={{ paddingHorizontal: 0 }} />
          </View>
        ) : popular.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <AppIcon name="chart" size={26} strokeWidth={1.9} color={AP.amberDeep} />
            </View>
            <Text style={s.emptyTitle}>{`No popular jobs ${phrase}`}</Text>
            <Text style={s.emptyBody}>Once people start applying, the most popular jobs show up here.</Text>
          </View>
        ) : (
          <>
            {/* top 5 */}
            <Reveal index={2}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>{`Top ${featured.length} ${phrase}`}</Text>
                <Text style={s.sectionCount}>{plural(popular.length, 'job', 'jobs')}</Text>
              </View>
              <Animated.ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={cardW + CARD_GAP}
                decelerationRate="fast"
                onScroll={onCarousel}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingHorizontal: SIDE }}
              >
                {featured.map((j, i) => (
                  <FeatureCard
                    key={j.id}
                    job={j}
                    index={i}
                    width={cardW}
                    scrollX={scrollX}
                    animate={!reduce}
                    saved={isSaved(j.id)}
                    onOpen={() => open(j.id)}
                    onToggleSave={() => save(j.id)}
                  />
                ))}
              </Animated.ScrollView>
            </Reveal>

            {/* the rest */}
            {rest.length > 0 && (
              <>
                <Reveal index={3}>
                  <View style={[s.sectionHead, { marginTop: 28 }]}>
                    <Text style={s.sectionTitle}>More popular jobs</Text>
                  </View>
                </Reveal>
                <View style={s.list}>
                  {rest.map((j, i) => (
                    <ListCard
                      key={j.id}
                      job={j}
                      index={i}
                      rank={FEATURED + i + 1}
                      saved={isSaved(j.id)}
                      onOpen={() => open(j.id)}
                      onToggleSave={() => save(j.id)}
                    />
                  ))}
                </View>
              </>
            )}

            {loadingMore && (
              <View style={s.moreRow}>
                <ActivityIndicator color={DARK} />
                <Text style={s.moreText}>Loading more…</Text>
              </View>
            )}
            {hasMore && !loadingMore && (
              <PressableScale accessibilityRole="button" onPress={() => void loadMore()} scale={0.96} style={s.loadMore}>
                <Text style={s.loadMoreText}>Load more</Text>
                <View style={s.loadMoreArrow}>
                  <AppIcon name="arrow" size={14} strokeWidth={2.2} color="#FFFFFF" style={{ transform: [{ rotate: '90deg' }] }} />
                </View>
              </PressableScale>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const shadow = {
  shadowColor: '#0F2333',
  shadowOpacity: 0.12,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 4,
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SIDE, paddingVertical: 8 },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: AP.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: F.s, fontSize: 10, color: '#FFFFFF' },
  hello: { fontFamily: F.h, fontSize: 24, letterSpacing: -0.4, color: DARK },
  helloSub: { fontFamily: F.m, fontSize: 13, color: AP.muted, marginTop: 1 },

  sectionLabel: { fontFamily: F.hb, fontSize: 18, color: DARK, paddingHorizontal: SIDE, marginTop: 20 },
  chips: { gap: 8, paddingHorizontal: SIDE, paddingTop: 12 },
  chip: { height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: SOFT, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: DARK },
  chipText: { fontFamily: F.s, fontSize: 13.5, color: '#4A5A63' },
  chipTextOn: { color: '#FFFFFF' },

  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: SIDE, marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontFamily: F.hb, fontSize: 18, color: DARK },
  sectionCount: { fontFamily: F.m, fontSize: 13, color: AP.muted },

  feature: { height: 380, borderRadius: 28, overflow: 'hidden', backgroundColor: '#DCE6EA', ...shadow },
  featureTop: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  rankPillText: { fontFamily: F.s, fontSize: 12, color: DARK },
  heart: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15,35,51,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureBottom: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureCompany: { flex: 1, fontFamily: F.s, fontSize: 13, color: 'rgba(255,255,255,0.92)' },
  featureTitle: { fontFamily: F.h, fontSize: 22, lineHeight: 27, letterSpacing: -0.3, color: '#FFFFFF', marginTop: 8 },
  featureMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  featurePay: { fontFamily: F.h, fontSize: 15, color: '#FFFFFF' },
  featureUnit: { fontFamily: F.m, fontSize: 12.5, color: 'rgba(255,255,255,0.8)' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.6)', marginHorizontal: 5 },
  featurePlace: { flexShrink: 1, fontFamily: F.m, fontSize: 12.5, color: 'rgba(255,255,255,0.85)' },
  featureActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  viewPill: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewPillText: { fontFamily: F.s, fontSize: 14.5, color: '#FFFFFF' },
  arrowWhite: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },

  list: { paddingHorizontal: SIDE, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: '#FFFFFF',
  },
  thumb: { width: 86, height: 86, borderRadius: 16, overflow: 'hidden', backgroundColor: '#DCE6EA' },
  thumbRank: {
    position: 'absolute',
    left: 6,
    top: 6,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
  },
  thumbRankText: { fontFamily: F.s, fontSize: 11, color: DARK },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: F.hb, fontSize: 15, lineHeight: 19, color: DARK },
  rowMeta: { fontFamily: F.m, fontSize: 12.5, color: AP.muted, marginTop: 3 },
  rowPayLine: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 7 },
  rowPay: { fontFamily: F.h, fontSize: 15, color: DARK },
  rowUnit: { fontFamily: F.m, fontSize: 12, color: AP.muted },
  adTag: { marginLeft: 6, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: '#FFF1D6', alignSelf: 'center' },
  adText: { fontFamily: F.s, fontSize: 10.5, color: AP.amberDeep },
  rowSide: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  arrowDark: { width: 34, height: 34, borderRadius: 17, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center' },

  moreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  moreText: { fontFamily: F.m, fontSize: 13.5, color: AP.muted },
  loadMore: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingLeft: 22,
    paddingRight: 6,
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: SOFT,
  },
  loadMoreText: { fontFamily: F.s, fontSize: 14.5, color: DARK },
  loadMoreArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 28, gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#FFF1D6', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: F.hb, fontSize: 17, color: DARK, marginTop: 8 },
  emptyBody: { fontFamily: F.b, fontSize: 14, lineHeight: 20, color: AP.muted, textAlign: 'center' },
});
