import React, { useCallback, useMemo, useState } from 'react';
import { router } from '@/lib/router';

import JobMapScreen from '@/components/explore/JobMapScreen';
import type { Job } from '@/components/explore/ExploreUI';
import { logoColorFor } from '@/components/jobs/toJobCardData';
import { JobsMap } from '@/components/jobs/JobsMap';
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

export default function JobsMapExperience() {
  const allJobs = useMapJobs();
  const { location: userLocation } = useUserLocation({ requestOnMount: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [radius, setRadius] = useState('5 km');
  const radiusKm = KM[radius] ?? 5;
  const origin = userLocation ?? DEFAULT_CENTER;

  const jobs = useMemo(
    () => getNearestJobs(allJobs, origin, MAX_JOBS).filter((job) => job.distanceKm <= radiusKm),
    [allJobs, origin, radiusKm],
  );

  const selected = jobs.find((job) => job.id === selectedId) ?? jobs[0];

  const map = (
    <JobsMap
      radiusKm={radiusKm}
      center={origin}
      jobs={jobs.map((job) => ({
        id: job.id,
        pay: job.salaryLabel.split('/')[0],
        latitude: job.lat,
        longitude: job.lng,
        km: job.distanceKm,
      }))}
      onPressJob={(id) => setSelectedId(id)}
    />
  );

  const handleLocate = useCallback(() => {
    setSelectedId(jobs[0]?.id ?? null);
  }, [jobs]);

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
