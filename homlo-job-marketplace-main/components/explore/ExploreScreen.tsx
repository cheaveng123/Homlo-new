import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AutoPager, EmployerBubbles, Icon, Job, JobCard,
  JobRowGroup, PressableScale, SearchPill, SectionTitle, SegmentedSwitch, Ticket, TopPick, ViewMode,
} from './ExploreUI';
import { c, fonts, sp, tints, Tint, type } from './tokens';
import { useFeedClient } from '@/lib/feed-client';
import { useSearchLocation } from '@/hooks/use-search-location';
import { normalizePublishedJob } from '@/lib/job-record';
import { trpc } from '@/lib/trpc';
import { JobEventRecorder, impressionViewabilityConfig, makeOnViewableItemsChanged } from '@/backend/feed/otter_event_recorder';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFirstLoadSkeletonFlag } from '@/lib/useFirstLoadSkeletonFlag';
import { ExploreCardRowSkeleton, ExploreRowGroupSkeleton } from '@/src/new/components/NewSkeletons';

const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const cardPages = (jobs: Job[], tint: Tint, onPressJob: (j: Job) => void) =>
  chunk(jobs, 2).map((pair, i) => (
    <View key={i} style={styles.pair}>
      {pair.map((j) => <JobCard key={j.id} job={j} tint={tint} onPress={() => onPressJob(j)} />)}
    </View>
  ));
const rowPages = (jobs: Job[], onPressJob: (j: Job) => void) => chunk(jobs, 3).map((g, i) => <JobRowGroup key={i} jobs={g} onPress={onPressJob} />);

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
  const [view, setView] = useState<ViewMode>('list');
  const [jobs, setJobs] = useState<Array<{ jobId: string }>>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [seed, setSeed] = useState<string>('');

  // Initialize event recorder
  const recorder = useMemo(() => {
    return new JobEventRecorder({
      send: (batch) => client.sendEvents(batch),
    });
  }, [client]);

  // Get or generate seed for this session
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('explore_seed').then((stored) => {
      if (!active) return;
      if (stored) {
        setSeed(stored);
      } else {
        const newSeed = Math.random().toString(36).substring(2, 15);
        AsyncStorage.setItem('explore_seed', newSeed);
        setSeed(newSeed);
      }
    });
    return () => { active = false; };
  }, []);

  // Fetch initial page
  useEffect(() => {
    let active = true;
    setLoading(true);
    setJobs([]);
    setCursor(null);
    setHasMore(true);
    client
      .explore({
        lat: coordinates.latitude,
        lng: coordinates.longitude,
        prefs: null,
        limit: 20,
        seed: seed || undefined,
      })
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
        seed,
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
            distance: job.location ? `${Math.floor(Math.random() * 5) + 1} km` : 'Remote',
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
  }, [jobRecords]);

  const displayJobs = useMemo(() =>
    jobs.map((j) => jobMap.get(j.jobId)).filter((j): j is Job => !!j),
    [jobs, jobMap]
  );

  const showSkeleton = useFirstLoadSkeletonFlag({
    loading,
    data: jobs.length ? displayJobs : undefined,
  });

  const featuredA = displayJobs[0];
  const featuredB = displayJobs[1];

  const openJob = useCallback((j: Job) => router.push({ pathname: '/job/[id]', params: { id: j.id } } as never), [router]);
  // Same visitor ("second person") view the job detail's "About this employer" card opens.
  const openEmployer = useCallback(
    (employerId: string) => router.push(`/employer/${employerId}` as never),
    [router],
  );

  // Coming back from the map always shows List as selected.
  useFocusEffect(useCallback(() => { setView('list'); }, []));

  const onSwitch = (v: ViewMode) => {
    setView(v);
    if (v === 'map') {
      if (onOpenMap) onOpenMap();
      else router.push('/jobs-map' as never); // ← the app's EXISTING job map route
    }
  };

  const section = (title: string, dot: string, body: React.ReactNode) => (
    <View style={styles.section}>
      <SectionTitle title={title} dot={dot} onSeeAll={() => {}} />
      {body}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: sp.xl }} stickyHeaderIndices={[]}>
        {/* Header band, closed by a visible 2px line */}
        <View style={[styles.header, { paddingTop: insets.top + sp.s }]}>
          <View style={styles.between}>
            <PressableScale style={styles.location} accessibilityRole="button" onPress={onLocation}>
              <Icon name="pin" size={20} color={c.teal} />
              <Text style={[type.body, { fontFamily: fonts.semi, color: c.deep }]}>{locationLabel}</Text>
            </PressableScale>
            <View style={styles.row}>
              <Pressable
                style={styles.iconBtn}
                accessibilityLabel="Saved jobs"
                accessibilityRole="button"
                onPress={onOpenSaved}
              >
                <Icon name="heart" color={c.deep} />
                {savedCount > 0 && (
                  <View style={styles.savedBadge}>
                    <Text style={styles.savedBadgeText}>{savedCount > 99 ? '99+' : savedCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
          <View style={[styles.row, { marginTop: sp.s, gap: 6 }]}>
            <View style={styles.sunDot} />
            <Text style={[type.meta, { fontFamily: fonts.semi, color: c.creamEyebrow }]}>EXPLORE · {newJobsLabel}</Text>
          </View>
          <Text style={[type.hero, { color: c.deep, marginTop: sp.xs }]} maxFontSizeMultiplier={1.3}>Explore smarter</Text>
          <View style={{ marginTop: sp.m }}>
            <SearchPill onPress={onSearch ?? (() => {})} onFilterPress={onFilterPress ?? (() => {})} />
          </View>
        </View>

        <SegmentedSwitch value={view} onChange={onSwitch} style={{ marginHorizontal: sp.l, marginTop: sp.l }} />

        {section('Featured today', c.sun,
          <View style={styles.body}>
            <AutoPager pages={[
              <View key="a" style={styles.pair}>
                <Ticket
                  eyebrow="HIRING WEEK"
                  footer="Closes in 3 days"
                  onPress={featuredA ? () => openJob(featuredA) : undefined}
                  pay="$300–450"
                  title="Hotel & hospitality, 18 openings"
                />
                {featuredA && <TopPick job={featuredA} onPress={() => openJob(featuredA)} />}
              </View>,
              <View key="b" style={styles.pair}>
                <Ticket
                  eyebrow="NEW THIS WEEK"
                  footer="Starts Monday"
                  onPress={featuredB ? () => openJob(featuredB) : undefined}
                  pay="$220–350"
                  title="Retail & mall jobs, 12 openings"
                />
                {featuredB && <TopPick job={featuredB} onPress={() => openJob(featuredB)} />}
              </View>,
            ]} />
          </View>)}

        {section('Hospitality', c.teal, (
          <View style={styles.body}>
            {showSkeleton ? <ExploreCardRowSkeleton /> : <AutoPager auto={false} pages={cardPages(displayJobs.slice(0, 6), tints.lagoon, openJob)} />}
          </View>
        ))}
        {section('Food & Drink', c.sun, (
          <View style={styles.body}>
            {showSkeleton ? <ExploreRowGroupSkeleton /> : <AutoPager auto={false} pages={rowPages(displayJobs.slice(6, 12), openJob)} />}
          </View>
        ))}
        {section('Retail & Sales', c.clay, (
          <View style={styles.body}>
            {showSkeleton ? <ExploreCardRowSkeleton /> : <AutoPager auto={false} pages={cardPages(displayJobs.slice(12, 18), tints.clay, openJob)} />}
          </View>
        ))}
        {section('Top employers', c.teal, <View style={styles.body}><EmployerBubbles items={[
          { id: '1', name: 'Riverstone Hotel', initials: 'RH', color: tints.lagoon.ink },
          { id: '2', name: 'Common Grounds', initials: 'CG', color: tints.sunrise.ink },
          { id: '3', name: 'Maison Local', initials: 'ML', color: tints.clay.ink },
          { id: '4', name: 'Cloud Desk', initials: 'CD', color: c.teal },
          { id: '5', name: 'Kiri Labs', initials: 'KL', color: tints.lagoon.ink },
        ]} onPress={openEmployer} /></View>)}
        {section('Delivery & Drivers', c.teal, (
          <View style={styles.body}>
            {showSkeleton ? <ExploreRowGroupSkeleton /> : <AutoPager auto={false} pages={rowPages(displayJobs.slice(18, 24), openJob)} />}
          </View>
        ))}
        {section('Office & Admin', c.sun, (
          <View style={styles.body}>
            {showSkeleton ? <ExploreCardRowSkeleton /> : <AutoPager auto={false} pages={cardPages(displayJobs.slice(24, 30), tints.sunrise, openJob)} />}
          </View>
        ))}

        {loadingMore && <Text style={{ textAlign: 'center', color: c.muted, padding: 16 }}>Loading more...</Text>}
        {hasMore && !loadingMore && !showSkeleton && (
          <Pressable
            style={{ padding: 16, alignItems: 'center' }}
            onPress={loadMore}
          >
            <Text style={{ fontFamily: fonts.semi, fontSize: 14, color: c.teal }}>Load more</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.card },
  header: { backgroundColor: c.page, paddingHorizontal: sp.l, paddingBottom: sp.l, borderBottomWidth: 2, borderBottomColor: c.tint2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  location: { height: 44, paddingLeft: 10, paddingRight: 14, borderRadius: 999, backgroundColor: c.tint, flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  savedBadge: {
    position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 9, backgroundColor: c.clay, borderWidth: 2, borderColor: c.page,
    alignItems: 'center', justifyContent: 'center',
  },
  savedBadgeText: { ...type.caption, fontFamily: fonts.semi, color: c.white, fontSize: 10, lineHeight: 13 },
  sunDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.sun },
  section: { paddingHorizontal: sp.l, paddingTop: sp.xl },
  body: { marginTop: sp.s },
  pair: { flexDirection: 'row', gap: sp.m, alignItems: 'stretch' },
});