import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Circle, UrlTile } from 'react-native-maps';
import { router } from 'expo-router';
import JobMapScreen, { PricePin } from '@/components/explore/JobMapScreen';
import type { Job } from '@/components/explore/ExploreUI';
import { MAP_TILE_URL } from '@/lib/map-config';
import {
  DEFAULT_CENTER, MAX_JOBS, MapJobWithDistance, getNearestJobs, useMapJobs,
} from '@/lib/nearestJobs';
import { logoColorFor } from '@/components/jobs/toJobCardData';
import { useUserLocation } from '@/lib/use-user-location';
import { locationService, type LocationState } from '@/lib/location-service';

const TEAL = '#0E7C86';

const RADII = ['1 km', '3 km', '5 km', '10 km'];
const KM: Record<string, number> = { '1 km': 1, '3 km': 3, '5 km': 5, '10 km': 10 };

type Coords = { latitude: number; longitude: number };

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] ?? '';
  const second = parts.length > 1 ? parts[1][0] ?? '' : '';
  return (first + second).toUpperCase();
}

function toJob(job: MapJobWithDistance): Job {
  return {
    id: job.id,
    title: job.title,
    company: job.employerName,
    pay: job.salaryLabel,
    distance: `${job.distanceKm.toFixed(1)} km`,
    initials: initialsOf(job.employerName),
    logoColor: logoColorFor(job.employerName),
  };
}

export default function JobsMapExperience() {
  const mapRef = useRef<MapView>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const allJobs = useMapJobs();
  const { location: userLocation, recenter } = useUserLocation({ requestOnMount: true });

  useEffect(() => {
    const handle = (state: LocationState) => {
      setAccuracy(state.accuracy ?? null);
    };
    const unsub = locationService.subscribe(handle);
    return () => unsub();
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
    const [radius, setRadius] = useState('5 km');
    const radiusKm = KM[radius] ?? 5;

    const origin: Coords = userLocation ?? DEFAULT_CENTER;

  // Nearest listed jobs to the user, restricted to the selected radius. Until a
  // location fix arrives the map still opens on Phnom Penh so it is never blank.
  const jobs = useMemo(
    () => getNearestJobs(allJobs, origin, MAX_JOBS).filter((j) => j.distanceKm <= radiusKm),
    [allJobs, origin, radiusKm],
  );

  useEffect(() => {
    if (!origin || !jobs.length) return;
    const timer = setTimeout(() => {
      setSelectedId(jobs[0].id);
      mapRef.current?.fitToCoordinates(
        [origin, ...jobs.map((j) => ({ latitude: j.lat, longitude: j.lng }))],
        { edgePadding: { top: 120, right: 50, bottom: 260, left: 50 }, animated: true },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [origin, jobs]);

  const focusJob = useCallback((job: MapJobWithDistance) => {
    mapRef.current?.animateToRegion(
      { latitude: job.lat - 0.004, longitude: job.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 },
      350,
    );
  }, []);

  const handleLocate = useCallback(() => {
    void recenter();
  }, [recenter]);

  const selected = jobs.find((j) => j.id === selectedId);

  const map = (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      mapType="none"
      showsUserLocation={false}
      showsMyLocationButton
      showsCompass={false}
      toolbarEnabled={false}
      initialRegion={{ ...DEFAULT_CENTER, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
    >
      <UrlTile maximumZ={19} minimumZ={2} shouldReplaceMapContent urlTemplate={MAP_TILE_URL} />
      {userLocation && (
        <Marker coordinate={userLocation} title="Your location" pinColor="#007AFF" />
      )}
      {userLocation && accuracy && typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy > 0 && (
        <Circle
          center={userLocation}
          radius={accuracy}
          strokeColor="rgba(0,122,255,0.4)"
          strokeWidth={1}
          fillColor="rgba(0,122,255,0.1)"
        />
      )}
      <Circle
        center={origin}
        radius={radiusKm * 1000}
        strokeColor={TEAL}
        strokeWidth={1.5}
        fillColor="rgba(14,124,134,0.07)"
        lineDashPattern={[6, 6]}
      />
      {jobs.map((job, i) => {
        const isSelected = job.id === selectedId;
        return (
          <Marker
            key={`${job.id}-${isSelected}`}
            coordinate={{ latitude: job.lat, longitude: job.lng }}
            onPress={() => {
              setSelectedId(job.id);
              focusJob(job);
            }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={isSelected ? 10 : 1}
          >
            <PricePin
              pay={job.salaryLabel.split('/')[0]}
              selected={isSelected}
              index={i}
            />
          </Marker>
        );
      })}
    </MapView>
  );

  return (
    <JobMapScreen
      map={map}
      radii={RADII}
      radius={radius}
      onRadius={setRadius}
      title={`${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} within ${radius}`}
      selected={selected ? toJob(selected) : undefined}
      onBack={() => router.back()}
      onViewList={() => router.back()}
      onSearch={() => {}}
      onLocate={handleLocate}
      onOpenJob={(job: Job) => router.push({ pathname: '/job/[id]', params: { id: job.id } } as never)}
    />
  );
}
