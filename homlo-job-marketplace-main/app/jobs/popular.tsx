// Popular ranking: "Most applied to" jobs. Reached from the home page's
// "Popular" section "See all". Fed by the new anonymous popularity-based backend.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, IconName } from '@/components/ui/AppIcon';
import { SectionTitle, JobCard, LogoSquare } from '@/components/jobs/JobsUI';
import { payText, typeLabel, useSavedJobs } from '@/lib/jobsData';
import { haptic } from '@/lib/haptics';
import { J, S, TS, TINTS } from '@/lib/jobsTheme';
import { F } from '@/lib/profileTheme';
import { useFeedClient } from '@/lib/feed-client';
import { useSearchLocation } from '@/hooks/use-search-location';
import { normalizePublishedJob } from '@/lib/job-record';
import { computePositionsLeft } from '@/lib/positions';
import { trpc } from '@/lib/trpc';
import { JobEventRecorder, impressionViewabilityConfig, makeOnViewableItemsChanged } from '@/backend/feed/otter_event_recorder';
import { useFirstLoadSkeletonFlag } from '@/lib/useFirstLoadSkeletonFlag';
import { JobsUiListSkeleton } from '@/src/new/components/NewSkeletons';

const PERIODS: { id: 'today' | 'week' | 'month'; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
];

const LOGO_BG = ['#0E3B2E', '#F5A623', '#C97A16', '#2FAE79', '#155743', '#6B4FA0'];

function hashOf(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'H';
  return parts.map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function PopularRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saved, toggle } = useSavedJobs();
  const { coordinates } = useSearchLocation();
  const client = useFeedClient();

  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [jobs, setJobs] = useState<Array<{ jobId: string }>>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Initialize event recorder
  const recorder = useMemo(() => {
    return new JobEventRecorder({
      send: (batch) => client.sendEvents(batch),
    });
  }, [client]);

  // Fetch initial page when period changes
  useEffect(() => {
    let active = true;
    setLoading(true);
    setJobs([]);
    setCursor(null);
    setHasMore(true);
    client
      .popular({
        lat: coordinates.latitude,
        lng: coordinates.longitude,
        prefs: null,
        limit: 20,
        period,
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
  }, [client, coordinates.latitude, coordinates.longitude, period]);

  // Load more
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
        const newItems = page.items.filter((item) => !seen.has(item.jobId));
        return [...prev, ...newItems];
      });
      setCursor(page.nextCursor);
      setHasMore(!!page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [client, coordinates.latitude, coordinates.longitude, cursor, hasMore, loadingMore, period]);

  // Fetch job details
  const jobIds = useMemo(() => jobs.map((j) => j.jobId), [jobs]);
  const { data: jobRecords } = trpc.homlo.publicJobs.useQuery(undefined, {
    enabled: jobIds.length > 0,
  });

  const jobMap = useMemo(() => {
    const map = new Map<string, any>();
    const records = (jobRecords as any)?.jobs ?? [];
    if (Array.isArray(records)) {
      for (const record of records) {
        try {
          const job = normalizePublishedJob(record);
          map.set(job.id, job);
        } catch (cause) {
          console.warn("[Popular] normalizePublishedJob failed", cause);
        }
      }
    }
    return map;
  }, [jobRecords]);

  const list = useMemo(() =>
    jobs.map((j) => jobMap.get(j.jobId)).filter((j): j is any => !!j),
    [jobs, jobMap]
  );

  const popular = list.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    pay: j.pay,
    boosted: j.boosted,
    positionsLeft:
      typeof j.positionsAvailable === "number"
        ? j.positionsAvailable
        : computePositionsLeft(j.positionsTotal, j.positionsFilled),
    initials: initialsOf(j.company),
    color: LOGO_BG[hashOf(j.company) % LOGO_BG.length],
  }));

  const showSkeleton = useFirstLoadSkeletonFlag({
    loading,
    data: jobs.length ? popular : undefined,
  });

  const onJobPress = (id: string) => {
    haptic.light();
    router.push({ pathname: '/job/[id]', params: { id } } as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Pressable
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={[s.backBtn, { top: insets.top + 8, left: S.lg }]}
      >
        <AppIcon name="back" size={22} color="#fff" />
      </Pressable>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: S.xxl, paddingTop: insets.top + 60 }}
      >
        {/* Period chips */}
        <View style={s.periodChips}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => { haptic.selection(); setPeriod(p.id); }}
              style={[s.periodChip, period === p.id && s.periodChipActive]}
            >
              <Text style={[s.periodChipText, period === p.id && s.periodChipTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        <SectionTitle>{`Popular ${period === 'today' ? 'today' : period === 'week' ? 'this week' : 'this month'}`}</SectionTitle>
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          {showSkeleton ? (
            <JobsUiListSkeleton gap={S.md} style={{ paddingHorizontal: 0 }} />
          ) : (
            <>
              {popular.map((j) => (
                  <JobCard
                    key={j.id}
                    lead={<LogoSquare letter={j.initials} tint={hashOf(j.company) % TINTS.length} />}
                    title={j.title}
                    subtitle={j.company}
                    chips={[j.pay]}
                    boosted={j.boosted}
                    onPress={() => onJobPress(j.id)}
                  />
              ))}
              {loadingMore && <Text style={{ textAlign: 'center', color: J.muted }}>Loading more...</Text>}
              {hasMore && !loadingMore && (
                <Pressable
                  style={{ padding: 16, alignItems: 'center' }}
                  onPress={loadMore}
                >
                  <Text style={{ fontFamily: F.b600, fontSize: 14, color: J.primary }}>Load more</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  backBtn: { position: 'absolute', zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  periodChips: { flexDirection: 'row', gap: S.md, paddingHorizontal: S.lg, marginTop: S.lg },
  periodChip: { paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: 999, backgroundColor: J.bg, borderWidth: 1, borderColor: J.border },
  periodChipActive: { backgroundColor: J.primary, borderColor: J.primary },
  periodChipText: { fontFamily: F.b600, fontSize: 13, color: J.fg },
  periodChipTextActive: { color: '#fff' },
});