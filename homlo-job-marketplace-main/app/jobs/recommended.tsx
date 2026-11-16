// Page 1 of 4: Recommended. Hero "Top match", category selector circles, match-gauge list.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, IconName } from '@/components/ui/AppIcon';
import { Button } from '@/components/profile/ProfileUI';
import { OverlapCard, Gauge, SelectorCircle, SectionTitle, JobCard, LogoSquare, Chips } from '@/components/jobs/JobsUI';
import { payText, typeLabel, useSavedJobs } from '@/lib/jobsData';
import { haptic } from '@/lib/haptics';
import { J, S, TS, TINTS } from '@/lib/jobsTheme';
import { F } from '@/lib/profileTheme';
import { fonts } from '@/lib/typography';
import SunriseBannerHeroMk7 from '@/components/recommended/SunriseBannerHeroMk7';
import { useFeedClient } from '@/lib/feed-client';
import { useSearchLocation } from '@/hooks/use-search-location';
import { normalizePublishedJob } from '@/lib/job-record';
import { trpc } from '@/lib/trpc';
import { JobEventRecorder, impressionViewabilityConfig, makeOnViewableItemsChanged } from '@/backend/feed/otter_event_recorder';
import { useFirstLoadSkeletonFlag } from '@/lib/useFirstLoadSkeletonFlag';
import { JobsUiListSkeleton } from '@/src/new/components/NewSkeletons';

const CATS: { id: string; label: string; icon: IconName }[] = [
  { id: 'all', label: 'All', icon: 'grid' },
  { id: 'cafe', label: 'Café', icon: 'cup' },
  { id: 'hotel', label: 'Hotel', icon: 'hotel' },
  { id: 'retail', label: 'Retail', icon: 'bag' },
  { id: 'delivery', label: 'Delivery', icon: 'bike' },
  { id: 'office', label: 'Office', icon: 'laptop' },
];

export default function RecommendedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saved, toggle } = useSavedJobs();
  const { coordinates } = useSearchLocation();
  const client = useFeedClient();

  const [cat, setCat] = useState('all');
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

  const flatListRef = useRef<FlatList>(null);
  const viewabilityRef = useRef(impressionViewabilityConfig);
    const onViewableRef = useRef(
      makeOnViewableItemsChanged<{ jobId: string }>(recorder, (item) => item.jobId)
    );

  // Fetch initial page
  useEffect(() => {
    let active = true;
    setLoading(true);
    client
      .recommended({
        lat: coordinates.latitude,
        lng: coordinates.longitude,
        prefs: null,
        limit: 20,
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
  const list = useMemo(() => {
    const filtered = jobs
      .map((j) => jobMap.get(j.jobId))
      .filter((j): j is any => !!j);
    if (cat === 'all') return filtered;
    // Map categories to CATS ids
    const catMap: Record<string, string> = {
      'Hospitality': 'cafe',
      'Hotel': 'hotel',
      'Retail': 'retail',
      'Delivery': 'delivery',
      'Technology': 'office',
      'Sales': 'office',
      'Marketing': 'office',
      'Customer Service': 'office',
      'Administration': 'office',
    };
    return filtered.filter((j) => catMap[j.category] === cat);
  }, [jobs, jobMap, cat]);

  const openJob = (id: string) => router.push({ pathname: '/job/[id]', params: { id } } as never);

  const showSkeleton = useFirstLoadSkeletonFlag({
    loading,
    data: jobs.length ? list : undefined,
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Pressable
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={[s.backBtn, { top: 28, left: S.lg }]}
      >
        <AppIcon name="back" size={22} color="#fff" />
      </Pressable>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: S.xxl }}
      >
        <SunriseBannerHeroMk7
          title="Recommended"
          edgeColor="#fff"
          headingFont={fonts.heading.extrabold}
          bodyFont={fonts.body.regular}
        />

        {top && (
          <OverlapCard>
            <View style={s.eyebrow}>
              <AppIcon name="bolt" size={14} color={J.eyebrowInk} />
              <Text style={s.eyebrowT}>Top match</Text>
            </View>
            <View style={s.heroRow}>
              <Gauge value={85} size={96} />
              <View style={{ flex: 1 }}>
                <Text style={s.heroTitle} numberOfLines={1}>{top.title}</Text>
                <Text style={s.heroSub} numberOfLines={1}>
                  {top.company} · {top.location?.split(',')[0]} · 5 km
                </Text>
              </View>
            </View>
            <Chips items={['✓ Coffee skills', '✓ Weekends', '✓ Khmer + English']} tone="tint" />
            <View style={s.actions}>
              <Button
                label="Quick apply"
                icon="bolt"
                shine
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: '/job/[id]/apply', params: { id: top.id } } as never)}
              />
              <Pressable style={s.saveSq} accessibilityLabel="Save top match" onPress={() => toggle(top.id)}>
                <AppIcon name={saved.has(top.id) ? 'check' : 'plus'} size={22} color={J.deep} />
              </Pressable>
            </View>
          </OverlapCard>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: S.xl }}
          contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: 4, paddingBottom: 4, gap: S.md }}
        >
          {CATS.map((c, i) => (
            <SelectorCircle key={c.id} label={c.label} selected={cat === c.id} tint={TINTS[i % 4][0]} size={66} onPress={() => { haptic.selection(); setCat(c.id); }}>
              <AppIcon name={c.icon} size={34} color={J.deep} />
            </SelectorCircle>
          ))}
        </ScrollView>

        <SectionTitle>Matched to your skills</SectionTitle>
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          {showSkeleton ? (
            <JobsUiListSkeleton gap={S.md} style={{ paddingHorizontal: 0 }} />
          ) : (
            <>
              {list.map((j) => (
                <JobCard
                  key={j.id}
                  lead={<LogoSquare letter={j.company[0]} tint={j.tint} />}
                  title={j.title}
                  subtitle={`${j.company} · ${j.location?.split(',')[0]}`}
                  chips={[payText(j), typeLabel(j)]}
                  right={<Gauge value={85} />}
                  boosted={j.boosted}
                  onPress={() => openJob(j.id)}
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
  eyebrow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: J.cream, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  eyebrowT: { fontFamily: F.b600, fontSize: TS.caption, color: J.eyebrowInk },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: S.lg, marginVertical: S.md },
  heroTitle: { fontFamily: F.h700, fontSize: 18, color: J.fg },
  heroSub: { fontFamily: F.b400, fontSize: TS.meta, color: J.muted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: S.sm, marginTop: 14 },
  saveSq: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: J.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});