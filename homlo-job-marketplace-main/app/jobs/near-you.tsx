// Page 3 of 4: Jobs near you. Full-screen map with field pins (fixed 10 km radius), and the
// job list in a draggable bottom sheet (ride-hailing layout, Homlo tokens).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { StatusBar } from '@/lib/native/status-bar';
import { useRouter } from '@/lib/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/ui/AppIcon';
import { JobsMap } from '@/components/jobs/JobsMap';
import { payText, useSavedJobs } from '@/lib/jobsData';
import type { JobsMapHandle } from '@/components/jobs/JobsMap.types';
import { NEARBY_RADIUS_KM, MapJobRow, MapLocateButton, MapSelectedJob, MapSheet, MapSheetHeader, MapTopBar, formatKm, travelNote, useSheetSnaps } from '@/src/components/map/MapChrome';
import { palette } from '@/src/design/tokens';
import { TextNew } from '@/src/new/components/TextNew';
import { peekFeedRead, useFeedClient } from '@/lib/feed-client';
import { useSearchLocation } from '@/hooks/use-search-location';
import { haversineDistance } from '@/lib/job-geography';
import { normalizePublishedJob } from '@/lib/job-record';
import { trpc } from '@/lib/trpc';
import { useRefetchMissingJobs } from "@/hooks/use-refetch-missing-jobs";
import { useFirstLoadSkeletonFlag } from '@/lib/useFirstLoadSkeletonFlag';
import { JobsUiListSkeleton } from '@/src/new/components/NewSkeletons';


export default function NearYouScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saved, toggle } = useSavedJobs();
  const { coordinates, locationLabel } = useSearchLocation();
  const client = useFeedClient();

  const radius = NEARBY_RADIUS_KM;
  // PERF: seed the first render from the last result for this location, so a
  // revisit paints the list at once while the page re-validates.
  const firstPageArgs = { lat: coordinates.latitude, lng: coordinates.longitude, prefs: null, limit: 20 };
  const cachedFirst = peekFeedRead<{ items: { jobId: string }[]; nextCursor: string | null; status: string }>('near', firstPageArgs);
  const [jobs, setJobs] = useState<{ jobId: string }[]>(() => (cachedFirst?.status === 'no_location' ? [] : cachedFirst?.items ?? []));
  const [cursor, setCursor] = useState<string | null>(() => cachedFirst?.nextCursor ?? null);
  const [loading, setLoading] = useState(!cachedFirst);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => (cachedFirst ? !!cachedFirst.nextCursor : true));
  const [noLocation, setNoLocation] = useState(cachedFirst?.status === 'no_location');

  // Reset the list when the query changes. Done during render (React's
  // recommended pattern) instead of synchronously inside the fetch effect.
  const queryKey = `${coordinates.latitude}|${coordinates.longitude}|${radius}`;
  const [prevQueryKey, setPrevQueryKey] = useState(queryKey);
  if (prevQueryKey !== queryKey) {
    setPrevQueryKey(queryKey);
    setLoading(!cachedFirst);
    setJobs(cachedFirst && cachedFirst.status !== 'no_location' ? cachedFirst.items : []);
    setCursor(cachedFirst?.nextCursor ?? null);
    setHasMore(cachedFirst ? !!cachedFirst.nextCursor : true);
    setNoLocation(cachedFirst?.status === 'no_location');
  }

  // Fetch the first page when the search location changes
  useEffect(() => {
    let active = true;
    client
      .near({ lat: coordinates.latitude, lng: coordinates.longitude, prefs: null, limit: 20 })
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

  // The feed is sorted by distance but not capped by radius; the page promises
  // "within N km", so jobs with a known distance beyond it are left out.
  const radiusJobs = useMemo(
    () => displayJobs.filter((j) => {
      const km = distanceFor(j);
      return km === null || km <= radius;
    }),
    [displayJobs, distanceFor, radius],
  );

  const mapRef = useRef<JobsMapHandle>(null);
  const snaps = useSheetSnaps(212 + insets.bottom, insets.top + 8 + 52 + 12);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = radiusJobs.find((j) => j.id === selectedId) ?? null;
  const others = selected ? radiusJobs.filter((j) => j.id !== selected.id) : radiusJobs;
  const barBottom = insets.top + 8 + 52;

  const select = (id: string) => {
    const job = radiusJobs.find((j) => j.id === id);
    if (!job) return;
    setSelectedId(id);
    setSheetIndex(1);
    const lat = Number(job.latitude);
    const lng = Number(job.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) mapRef.current?.centerOn({ latitude: lat, longitude: lng });
  };

  const count = radiusJobs.length;
  const area = locationLabel || 'your area';

  return (
    <View style={{ flex: 1, backgroundColor: palette.page }}>
      <StatusBar style="dark" />
      <JobsMap
        ref={mapRef}
        fill
        radiusKm={radius}
        jobs={radiusJobs}
        center={coordinates}
        selectedId={selectedId}
        onPressJob={select}
        insets={{ top: barBottom, bottom: selected ? snaps[1] : snaps[0] }}
        showLocationBadge={false}
      />

      <MapTopBar top={insets.top + 8} title="Jobs near you" subtitle={`Within ${radius} km of ${area}`} onBack={() => router.back()} />
      <MapSheet
        snaps={snaps}
        index={sheetIndex}
        onIndexChange={setSheetIndex}
        bottomInset={insets.bottom}
        fab={<MapLocateButton onPress={() => mapRef.current?.recenter()} active={!noLocation} />}
        header={
          <MapSheetHeader
            title={noLocation ? 'Location is off' : showSkeleton ? 'Finding jobs near you' : `${count} ${count === 1 ? 'job' : 'jobs'} within ${radius} km`}
            subtitle={noLocation ? 'Turn on location to see jobs around you' : `Around ${area} · nearest first`}
          />
        }
      >
        {showSkeleton ? (
          <JobsUiListSkeleton gap={10} style={{ paddingHorizontal: 0 }} />
        ) : noLocation ? (
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
            <AppIcon name="pin" size={40} color={palette.slate} />
            <TextNew variant="body" color={palette.muted} align="center">
              Allow location access in settings to see jobs near you.
            </TextNew>
          </View>
        ) : (
          <>
            {selected ? (() => {
              const km = distanceFor(selected);
              return (
                <MapSelectedJob
                  category={selected.category}
                  title={selected.title}
                  subtitle={`${selected.company} · ${selected.location?.split(',')[0] ?? ''}`}
                  pay={payText(selected)}
                  distance={km === null ? null : formatKm(km)}
                  note={km === null ? null : travelNote(km)}
                  saved={saved.has(selected.id)}
                  onToggleSave={() => toggle(selected.id)}
                  onView={() => openJob(selected.id)}
                  onClose={() => {
                    setSelectedId(null);
                    setSheetIndex(0);
                  }}
                />
              );
            })() : null}
            {selected && others.length ? (
              <TextNew variant="meta" weight="semibold" color={palette.muted} style={{ marginTop: 6, marginLeft: 4 }}>
                Other jobs nearby
              </TextNew>
            ) : null}
            {others.map((j) => {
              const km = distanceFor(j);
              return (
                <MapJobRow
                  key={j.id}
                  category={j.category}
                  title={j.title}
                  subtitle={`${j.company} · ${j.location?.split(',')[0] ?? ''}`}
                  pay={payText(j)}
                  distance={km === null ? null : formatKm(km)}
                  onPress={() => select(j.id)}
                />
              );
            })}
            {count === 0 ? (
              <TextNew variant="body" color={palette.muted} align="center" style={{ paddingVertical: 24 }}>
                {`No jobs within ${radius} km yet. Check back soon.`}
              </TextNew>
            ) : null}
            {loadingMore ? <TextNew variant="meta" color={palette.muted} align="center">Loading more…</TextNew> : null}
            {hasMore && !loadingMore ? (
              <Pressable style={{ padding: 16, alignItems: 'center' }} onPress={loadMore} accessibilityRole="button">
                <TextNew variant="body" weight="semibold" color={palette.cyanDeep}>Load more</TextNew>
              </Pressable>
            ) : null}
          </>
        )}
      </MapSheet>
    </View>
  );
}
