// Native map for "Near you". Uses real device location (via useUserLocation)
// and real job coordinates from the backend when available. Falls back to the
// existing phoney layout only if we have neither origin nor job coords.
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Circle, UrlTile, type Region } from 'react-native-maps';
import { J, S } from '@/lib/jobsTheme';
import { MAP_MAX_TILE_ZOOM, MAP_TILE_URL } from '@/lib/map-config';
import { MapAttribution } from '@/components/maps/map-attribution';
import { F } from '@/lib/profileTheme';
import { useUserLocation } from '@/lib/use-user-location';
import { JobMapPin } from '@/src/components/map/JobMapPin';
import { useMarkerTracking } from '@/src/components/map/useMarkerTracking';
import { defaultSearchCenter, validCoordinatePair } from '@/lib/job-geography';
import type { JobsMapHandle, JobsMapJob, JobsMapProps } from './JobsMap.types';

const openStreetMapTiles = MAP_TILE_URL;
const KM = 1000;
const ZOOM_BY_RADIUS: Record<number, number> = { 1: 0.03, 3: 0.07, 5: 0.12, 8: 0.19, 10: 0.24 };

function validPair(job: JobsMapJob): job is JobsMapJob & { latitude: number; longitude: number } {
  return validCoordinatePair(job.latitude, job.longitude) !== null;
}

/** Compact pin text: "$3 / hour" -> "$3/hr", "$150 / month" -> "$150/mo". */
function pinLabel(job: JobsMapJob): string {
  const raw = job.unit === '/hr' ? `${job.pay}/hr` : String(job.pay ?? '');
  return raw
    .replace(/\s*undefined\s*/gi, '')
    .replace(/\s*\/\s*(hour|hr)\b/i, '/hr')
    .replace(/\s*\/\s*day\b/i, '/day')
    .replace(/\s*\/\s*(month|mo)\b/i, '/mo')
    .trim();
}


type PlacedJob = JobsMapJob & { latitude: number; longitude: number };

/** Wider than this (degrees of longitude on screen) and pins drop their price label. */
const COMPACT_SPAN = 0.1;

function JobPinMarker({ job, index, selected, compact, onPress }: { job: PlacedJob; index: number; selected: boolean; compact: boolean; onPress?: (id: string) => void }) {
  const tracking = useMarkerTracking(`${job.id}:${selected}:${compact}`, index);
  return (
    <Marker
      coordinate={{ latitude: job.latitude, longitude: job.longitude }}
      onPress={() => onPress?.(job.id)}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracking}
      zIndex={selected ? 10 : 1}
    >
      <JobMapPin category={job.category} label={compact && !selected ? null : pinLabel(job)} index={index} selected={selected} />
    </Marker>
  );
}

export const JobsMap = forwardRef<JobsMapHandle, JobsMapProps>(function JobsMap(
  { radiusKm, jobs, height = 400, center, onPressJob, fill, selectedId = null, insets, showLocationBadge = true },
  ref,
) {
  const mapRef = useRef<MapView>(null);
  const { location: userLocation } = useUserLocation({ requestOnMount: true });
  const origin = userLocation ?? center ?? defaultSearchCenter;
  const delta = ZOOM_BY_RADIUS[radiusKm] ?? ZOOM_BY_RADIUS[5] ?? 0.12;
  const region: Region = useMemo(
    () => ({ latitude: origin.latitude, longitude: origin.longitude, latitudeDelta: delta, longitudeDelta: delta }),
    [origin.latitude, origin.longitude, delta],
  );
  const realJobs = useMemo(() => jobs.filter(validPair), [jobs]);
  // Zoomed out, pins go icon-only so neighbours stay readable; the selected one keeps its price.
  const [compact, setCompact] = useState(delta > COMPACT_SPAN);
  // Every job keeps its own pin; the selected one is drawn last so it sits on top.
  const ordered = useMemo(
    () => (selectedId ? [...realJobs.filter((j) => j.id !== selectedId), ...realJobs.filter((j) => j.id === selectedId)] : realJobs),
    [realJobs, selectedId],
  );
  const padTop = insets?.top ?? 0;
  const padBottom = insets?.bottom ?? 0;

  useImperativeHandle(
    ref,
    () => ({
      centerOn: (c) =>
        mapRef.current?.animateToRegion(
          { latitude: c.latitude, longitude: c.longitude, latitudeDelta: Math.min(delta, 0.04), longitudeDelta: Math.min(delta, 0.04) },
          320,
        ),
      recenter: () => mapRef.current?.animateToRegion(region, 320),
    }),
    [delta, region],
  );

  // Recenter once the device fix or radius changes, not on every marker move.
  useEffect(() => {
    mapRef.current?.animateToRegion(region, 350);
  }, [region]);

  return (
    <View style={[m.wrap, fill ? { flex: 1 } : { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapType="none"
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled
        scrollEnabled
        zoomEnabled
        // Keeps centring and the Apple/OSM credits clear of the floating top bar and sheet.
        mapPadding={{ top: padTop, bottom: padBottom, left: 0, right: 0 }}
        onRegionChangeComplete={(r) => setCompact(r.longitudeDelta > COMPACT_SPAN)}
      >
        <UrlTile maximumZ={MAP_MAX_TILE_ZOOM} minimumZ={2} shouldReplaceMapContent urlTemplate={openStreetMapTiles} />
        {origin && (
          <Circle
            center={origin}
            radius={radiusKm * KM}
            strokeColor="rgba(8,145,178,0.8)"
            strokeWidth={1.5}
            lineDashPattern={[6, 6]}
            fillColor="rgba(8,145,178,0.10)"
          />
        )}
        {ordered.map((j, i) => (
          <JobPinMarker key={j.id} job={j} index={i} selected={j.id === selectedId} compact={compact} onPress={onPressJob} />
        ))}
      </MapView>
      {!showLocationBadge ? null : userLocation ? (
        <View style={[m.locBadge, { bottom: S.lg + S.sm, left: S.lg }]}>
          <Text style={m.locBadgeT}>Using your current location</Text>
        </View>
      ) : (
        <View style={[m.locBadge, { bottom: S.lg + S.sm, left: S.lg }]}>
          <Text style={m.locBadgeT}>Showing around Phnom Penh</Text>
        </View>
      )}
      <MapAttribution />
    </View>
  );
});

const m = StyleSheet.create({
  wrap: { backgroundColor: '#E6EDEF', overflow: 'hidden' },
  locBadge: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: 999 },
  locBadgeT: { fontFamily: F.b400, fontSize: 11, color: J.muted },
  attribution: { position: 'absolute', right: S.sm, bottom: 4, fontFamily: F.b400, fontSize: 9, color: J.muted },
});
