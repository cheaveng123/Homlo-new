import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';

import JobMapScreen from '@/components/explore/JobMapScreen';
import type { Job } from '@/components/explore/ExploreUI';
import { logoColorFor } from '@/components/jobs/toJobCardData';
import { MAP_ATTRIBUTION, MAP_STYLE_URL } from '@/lib/map-config';
import {
  DEFAULT_CENTER,
  MAX_JOBS,
  type MapJobWithDistance,
  getNearestJobs,
  useMapJobs,
} from '@/lib/nearestJobs';
import { useUserLocation } from '@/lib/use-user-location';

const RADII = ['1 km', '3 km', '5 km', '10 km'];
const KM: Record<string, number> = { '1 km': 1, '3 km': 3, '5 km': 5, '10 km': 10 };
const RADIUS_SOURCE = 'jobs-radius';
const RADIUS_LAYER = 'jobs-radius-layer';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return `${parts[0][0] ?? ''}${parts.length > 1 ? parts[1][0] ?? '' : ''}`.toUpperCase();
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

function circleGeoJson(center: { latitude: number; longitude: number }, radiusKm: number, steps = 64) {
  const earthRadiusKm = 6371;
  const angularDistance = radiusKm / earthRadiusKm;
  const latitude = (center.latitude * Math.PI) / 180;
  const longitude = (center.longitude * Math.PI) / 180;
  const ring: [number, number][] = [];
  for (let step = 0; step <= steps; step += 1) {
    const bearing = (step / steps) * Math.PI * 2;
    const pointLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(angularDistance) +
        Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const pointLongitude =
      longitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
        Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(pointLatitude),
      );
    ring.push([(pointLongitude * 180) / Math.PI, (pointLatitude * 180) / Math.PI]);
  }
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [ring] },
  };
}

function priceMarkerElement(pay: string, selected: boolean) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = pay;
  element.setAttribute('aria-label', `${pay} job`);
  element.style.background = selected ? '#0E7C86' : '#FFFFFF';
  element.style.color = selected ? '#FFFFFF' : '#14272B';
  element.style.border = '1px solid #E4ECEC';
  element.style.borderRadius = '999px';
  element.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.2)';
  element.style.cursor = 'pointer';
  element.style.fontFamily = 'Inter, system-ui, sans-serif';
  element.style.fontSize = '13px';
  element.style.fontWeight = '700';
  element.style.padding = '6px 12px';
  element.style.whiteSpace = 'nowrap';
  return element;
}

export default function JobsMapExperience() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const jobMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const allJobs = useMapJobs();
  const { location: userLocation, recenter } = useUserLocation({ requestOnMount: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [radius, setRadius] = useState('5 km');
  const radiusKm = KM[radius] ?? 5;
  const origin = userLocation ?? DEFAULT_CENTER;

  const jobs = useMemo(
    () => getNearestJobs(allJobs, origin, MAX_JOBS).filter((job) => job.distanceKm <= radiusKm),
    [allJobs, origin, radiusKm],
  );

  const selected = jobs.find((job) => job.id === selectedId) ?? jobs[0];
  const effectiveSelectedId = selected?.id ?? null;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
      zoom: 12,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      map.addSource(RADIUS_SOURCE, {
        type: 'geojson',
        data: circleGeoJson(DEFAULT_CENTER, 5),
      });
      map.addLayer({
        id: RADIUS_LAYER,
        type: 'fill',
        source: RADIUS_SOURCE,
        paint: { 'fill-color': '#0E7C86', 'fill-opacity': 0.08 },
      });
      map.addLayer({
        id: `${RADIUS_LAYER}-outline`,
        type: 'line',
        source: RADIUS_SOURCE,
        paint: { 'line-color': '#0E7C86', 'line-width': 1.5, 'line-dasharray': [3, 3] },
      });
      setMapLoaded(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      jobMarkersRef.current = [];
      setMapLoaded(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const source = map.getSource(RADIUS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(
      circleGeoJson({ latitude: origin.latitude, longitude: origin.longitude }, radiusKm),
    );
  }, [mapLoaded, origin.latitude, origin.longitude, radiusKm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (userLocation) {
      if (!userMarkerRef.current) {
        userMarkerRef.current = new maplibregl.Marker({ color: '#007AFF' })
          .setLngLat([userLocation.longitude, userLocation.latitude])
          .setPopup(new maplibregl.Popup({ offset: 24 }).setText('Your location'))
          .addTo(map);
      } else {
        userMarkerRef.current.setLngLat([userLocation.longitude, userLocation.latitude]);
      }
    } else {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
    }
  }, [mapLoaded, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    jobMarkersRef.current.forEach((marker) => marker.remove());
    jobMarkersRef.current = jobs.map((job) => {
      const isSelected = job.id === effectiveSelectedId;
      const element = priceMarkerElement(job.salaryLabel.split('/')[0], isSelected);
      element.addEventListener('click', () => {
        setSelectedId(job.id);
        map.flyTo({ center: [job.lng, job.lat], zoom: Math.max(map.getZoom(), 13), duration: 400 });
      });
      return new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([job.lng, job.lat])
        .addTo(map);
    });
  }, [mapLoaded, jobs, effectiveSelectedId]);

  useEffect(() => {
    if (!jobs.length) return;
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend([origin.longitude, origin.latitude]);
    jobs.forEach((job) => bounds.extend([job.lng, job.lat]));
    map.fitBounds(bounds, { padding: { top: 160, right: 60, bottom: 280, left: 60 }, maxZoom: 15, duration: 400 });
  }, [mapLoaded, jobs, origin.latitude, origin.longitude]);

  const handleLocate = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userLocation) {
      map.flyTo({ center: [userLocation.longitude, userLocation.latitude], zoom: 14, duration: 400 });
      return;
    }
    void recenter();
  }, [recenter, userLocation]);

  const map = (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div
        style={{
          position: 'absolute',
          right: 6,
          bottom: 4,
          background: 'rgba(255,255,255,0.82)',
          borderRadius: 4,
          color: '#58696B',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 9,
          padding: '2px 5px',
          pointerEvents: 'none',
        }}
      >
        {MAP_ATTRIBUTION}
      </div>
    </div>
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
