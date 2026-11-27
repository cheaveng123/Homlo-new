import { useMemo } from 'react';

import type { SearchJobRecord } from '@/hooks/use-job-search';
import { defaultSearchCenter, haversineDistance } from '@/lib/job-geography';
import { trpc } from '@/lib/trpc';
import { resolveJobImage } from '@/lib/job-banner';

export type MapJob = {
  id: string;
  title: string;
  employerName: string;
  salaryLabel: string; // e.g. "$180/mo"
  locationLabel: string; // e.g. "Toul Kork"
  lat: number;
  lng: number;
  imageUrl?: string;
  category?: string | null;
  workArrangement: 'on-site' | 'hybrid' | 'remote';
};

export type MapJobWithDistance = MapJob & { distanceKm: number };

export const DEFAULT_CENTER = defaultSearchCenter; // fallback browsing area only, never presented as GPS
export const MAX_JOBS = 30;

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  return haversineDistance(
    { latitude: aLat, longitude: aLng },
    { latitude: bLat, longitude: bLng },
  );
}

/** Nearest `limit` on-site/hybrid jobs to `origin`, sorted nearest first. Remote jobs have no map position and are skipped. */
export function getNearestJobs(
  jobs: MapJob[],
  origin: { latitude: number; longitude: number },
  limit = MAX_JOBS,
): MapJobWithDistance[] {
  return jobs
    .filter((j) => j.workArrangement !== 'remote' && Number.isFinite(j.lat) && Number.isFinite(j.lng))
    .map((j) => ({ ...j, distanceKm: haversineKm(origin.latitude, origin.longitude, j.lat, j.lng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/** Same salary formatting the Search page list uses, so pins match the job cards. */
function salaryLabel(record: SearchJobRecord): string {
  const numeric = Number(record.pay_amount);
  const formatted = Number.isFinite(numeric)
    ? numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : String(record.pay_amount);
  const currency = record.pay_currency.toUpperCase() === 'USD' ? '$' : `${record.pay_currency.toUpperCase()} `;
  const suffix = record.pay_type === 'hourly' ? ' / hour' : record.pay_type === 'daily' ? ' / day' : '';
  return `${currency}${formatted}${suffix}`;
}

/**
 * Real listings from the same source the Search page "Jobs near you" list uses
 * (`trpc.homlo.searchJobs` -> Supabase, swappable as before). Records without
 * coordinates are dropped later by `getNearestJobs`, which also skips remote
 * roles since they have no map position.
 */
export function useMapJobs(): MapJob[] {
  const query = trpc.homlo.searchJobs.useQuery({ limit: 50, sort: 'newest' }, { staleTime: 30_000 });

  return useMemo(() => {
    const records = query.data?.jobs ?? [];
    return records
      .filter((record) => Number.isFinite(record.latitude) && Number.isFinite(record.longitude))
      .map((record) => {
        const location = record.location_text?.trim() || 'Location to be confirmed';
        return {
          id: record.id,
          title: record.title,
          employerName: record.employer_name?.trim() || 'Homlo employer',
          salaryLabel: salaryLabel(record),
          locationLabel: location,
          lat: record.latitude as number,
          lng: record.longitude as number,
          imageUrl: resolveJobImage(record.banner_image),
          category: record.category ?? null,
          workArrangement: location.toLowerCase().includes('remote') ? 'remote' : 'on-site',
        };
      });
  }, [query.data?.jobs]);
}
