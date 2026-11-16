// Page 3 of 4: Jobs near you. Map with price pins, 1 / 3 / 5 km radius circles, hill edge into the list.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, FlatList } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/ui/AppIcon';
import { JobsMap } from '@/components/jobs/JobsMap';
import { SelectorCircle, SelectorText, SectionTitle, JobCard, LogoSquare, DistanceBadge } from '@/components/jobs/JobsUI';
import { payText, typeLabel, travelText, useSavedJobs } from '@/lib/jobsData';
import { J, S, TS, shadowMd } from '@/lib/jobsTheme';
import { F } from '@/lib/profileTheme';
import { useFeedClient } from '@/lib/feed-client';
import { useSearchLocation } from '@/hooks/use-search-location';
import { haversineDistance } from '@/lib/job-geography';
import { normalizePublishedJob } from '@/lib/job-record';
import { trpc } from '@/lib/trpc';
import { JobEventRecorder, impressionViewabilityConfig, makeOnViewableItemsChanged } from '@/backend/feed/otter_event_recorder';
import { useFirstLoadSkeletonFlag } from '@/lib/useFirstLoadSkeletonFlag';
import { JobsUiListSkeleton } from '@/src/new/components/NewSkeletons';

const RADII = [1, 3, 5];

export default function NearYouScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saved, toggle } = useSavedJobs();
  const { coordinates, locationLabel } = useSearchLocation();
  const client = useFeedClient();

  const [radius, setRadius] = useState(3);
  const [jobs, setJobs] = useState<Array<{ jobId: string }>>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [noLocation, setNoLocation] = useState(false);

  // Initialize event recorder
  const recorder = useMemo(() => {
    return new JobEventRecorder({
      send: (batch) => client.sendEvents(batch),
    });
  }, [client]);

  // Fetch initial page when radius changes
  useEffect(() => {
    let active = true;
    setLoading(true);
    setJobs([]);
    setCursor(null);
    setHasMore(true);
    setNoLocation(false);
    client
      .near({
        lat: coordinates.latitude,
        lng: coordinates.longitude,
        prefs: null,
        limit: 20,
      })
      .then((page) => {
        if (active) {
          if (page.status === 'no_location') {
            setNoLocation(true);
            setJobs([]);
            setHasMore(false);
          } else {
            setJobs(page.items);
            setCursor(page.nextCursor);
            setHasMore(!!page.nextCursor);
          }
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
    return () => { active = false; };
  }, [client, coordinates.latitude, coordinates.longitude, radius]);

  // Load more
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await client.near({
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
          console.warn("[NearYou] normalizePublishedJob failed", cause);
        }
      }
    }
    return map;
  }, [jobRecords]);

  const openJob = (id: string) => router.push({ pathname: '/job/[id]', params: { id } } as never);

  const displayJobs = useMemo(() =>
    jobs.map((j) => jobMap.get(j.jobId)).filter((j): j is any => !!j),
    [jobs, jobMap]
  );

  const distanceFor = useCallback(
    (job: any): number | null => {
      const lat = Number(job?.latitude);
      const lng = Number(job?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return haversineDistance(coordinates, { latitude: lat, longitude: lng });
    },
    [coordinates],
  );

  const showSkeleton = useFirstLoadSkeletonFlag({
    loading,
    data: jobs.length ? displayJobs : undefined,
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: S.xxl }}>
        <View>
          <JobsMap
            radiusKm={radius}
            jobs={displayJobs}
            height={400}
            center={coordinates}
            onPressJob={openJob}
          />

          <View style={[n.topRow, { top: insets.top + S.sm }]}>
            <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={n.circleBtn}>
              <AppIcon name="back" size={22} color={J.fg} />
            </Pressable>
            <View style={n.search}>
              <AppIcon name="search" size={20} color={J.muted} />
              <Text style={n.searchT}>Within <Text style={{ fontFamily: F.h700, color: J.fg }}>{radius} km</Text> of {locationLabel}</Text>
            </View>
          </View>

          <View style={n.radii}>
            {RADII.map((r) => (
              <SelectorCircle key={r} size={52} selected={radius === r} onPress={() => setRadius(r)} tint={J.tint}>
                <SelectorText>{`${r} km`}</SelectorText>
              </SelectorCircle>
            ))}
          </View>

          <View style={n.hill} pointerEvents="none">
            <Svg width="100%" height={34} viewBox="0 0 390 34" preserveAspectRatio="none"><Path d="M0 30Q195 -10 390 30V34H0z" fill="#fff" /></Svg>
          </View>
        </View>

        <View style={{ marginTop: S.sm }}>
          {noLocation ? (
            <SectionTitle>Enable location to see nearby jobs</SectionTitle>
          ) : showSkeleton ? (
            <SectionTitle>{`Jobs within ${radius} km`}</SectionTitle>
          ) : (
            <SectionTitle>{`${displayJobs.length} jobs within ${radius} km`}</SectionTitle>
          )}
        </View>
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          {showSkeleton ? (
            <JobsUiListSkeleton gap={S.md} style={{ paddingHorizontal: 0 }} />
          ) : noLocation ? (
            <View style={{ alignItems: 'center', padding: 48, gap: 12 }}>
              <AppIcon name="pin" size={48} color={J.muted} />
              <Text style={{ fontFamily: F.b600, fontSize: 14, color: J.muted }}>Location permission required</Text>
              <Text style={{ fontFamily: F.b400, fontSize: 13, color: J.muted, textAlign: 'center', paddingHorizontal: 32 }}>
                Allow location access in settings to see jobs near you.
              </Text>
            </View>
          ) : (
            <>
              {displayJobs.map((j) => {
                const km = distanceFor(j);
                return (
                  <JobCard
                    key={j.id} lead={<LogoSquare letter={j.company[0]} tint={j.tint} />}
                    title={j.title} subtitle={`${j.company} · ${j.location?.split(',')[0]}`} chips={[payText(j), typeLabel(j)]}
                    right={km === null ? undefined : <DistanceBadge km={km} note={travelText(km)} />}
                    saved={saved.has(j.id)} onToggleSave={() => toggle(j.id)}
                    boosted={j.boosted}
                    onPress={() => openJob(j.id)}
                  />
                );
              })}
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

const n = StyleSheet.create({
  topRow: { position: 'absolute', left: S.lg, right: S.lg, flexDirection: 'row', gap: S.sm },
  circleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 12, elevation: 4 },
  search: { flex: 1, height: 44, borderRadius: 22, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 12, elevation: 4 },
  searchT: { fontFamily: F.b400, fontSize: TS.body, color: J.muted },
  radii: { position: 'absolute', left: S.lg, bottom: 48, flexDirection: 'row', gap: S.sm, backgroundColor: 'rgba(255,255,255,0.94)', padding: 10, borderRadius: 999, ...shadowMd, shadowOpacity: 0.14 },
  hill: { position: 'absolute', left: 0, right: 0, bottom: -1 },
});