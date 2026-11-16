// Native map for "Near you". Uses real device location (via useUserLocation)
// and real job coordinates from the backend when available. Falls back to the
// existing phoney layout only if we have neither origin nor job coords.
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Circle, UrlTile, type Region } from 'react-native-maps';
import { J, S } from '@/lib/jobsTheme';
import { MAP_MAX_TILE_ZOOM, MAP_TILE_URL } from '@/lib/map-config';
import { MapAttribution } from '@/components/maps/map-attribution';
import { F } from '@/lib/profileTheme';
import { useUserLocation } from '@/lib/use-user-location';
import { defaultSearchCenter, validCoordinatePair } from '@/lib/job-geography';
import type { JobsMapJob, JobsMapProps } from './JobsMap.types';

const openStreetMapTiles = MAP_TILE_URL;
const KM = 1000;
const ZOOM_BY_RADIUS: Record<number, number> = { 1: 0.03, 3: 0.07, 5: 0.12, 10: 0.24 };

function validPair(job: JobsMapJob): job is JobsMapJob & { latitude: number; longitude: number } {
  return validCoordinatePair(job.latitude, job.longitude) !== null;
}

function pinLabel(job: JobsMapJob): string {
  if (job.unit === '/hr') return `${job.pay}/hr`;
  return job.pay;
}

export function JobsMap({ radiusKm, jobs, height = 400, center, onPressJob }: JobsMapProps) {
  const mapRef = useRef<MapView>(null);
  const { location: userLocation } = useUserLocation({ requestOnMount: true });
  const origin = userLocation ?? center ?? defaultSearchCenter;
  const delta = ZOOM_BY_RADIUS[radiusKm] ?? ZOOM_BY_RADIUS[5] ?? 0.12;
  const region: Region = useMemo(
    () => ({ latitude: origin.latitude, longitude: origin.longitude, latitudeDelta: delta, longitudeDelta: delta }),
    [origin.latitude, origin.longitude, delta],
  );
  const realJobs = useMemo(() => jobs.filter(validPair), [jobs]);

  // Recenter once the device fix or radius changes, not on every marker move.
  useEffect(() => {
    mapRef.current?.animateToRegion(region, 350);
  }, [region]);

  return (
    <View style={[m.wrap, { height }]}>
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
      >
        <UrlTile maximumZ={MAP_MAX_TILE_ZOOM} minimumZ={2} shouldReplaceMapContent urlTemplate={openStreetMapTiles} />
        {origin && (
          <Circle
            center={origin}
            radius={radiusKm * KM}
            strokeColor="rgba(14,124,134,0.8)"
            strokeWidth={1.5}
            lineDashPattern={[6, 6]}
            fillColor="rgba(14,124,134,0.10)"
          />
        )}
        {realJobs.map((j) => (
          <Marker
            key={j.id}
            coordinate={{ latitude: j.latitude, longitude: j.longitude }}
            onPress={() => onPressJob?.(j.id)}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={m.pin}>
              <Text style={m.pinT}>{pinLabel(j)}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
      {userLocation ? (
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
}

const m = StyleSheet.create({
  wrap: { backgroundColor: '#E4EFEE', overflow: 'hidden' },
  pin: { backgroundColor: '#fff', paddingHorizontal: S.md, paddingVertical: 6, borderRadius: 999, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  pinT: { fontFamily: F.b600, fontSize: 13, color: J.fg },
  locBadge: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: 999 },
  locBadgeT: { fontFamily: F.b400, fontSize: 11, color: J.muted },
  attribution: { position: 'absolute', right: S.sm, bottom: 4, fontFamily: F.b400, fontSize: 9, color: J.muted },
});
