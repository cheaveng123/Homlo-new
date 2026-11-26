// Page 4 of 4: Category detail. Opens when the user taps a job category anywhere
// in the app (router.push(`/jobs/category/${category.id}`)) and renders the v2
// CategoryScreen fed by homlo.searchJobs for that category.
import React, { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from '@/lib/router';

import CategoryScreen, { type CategoryJob, type Employer } from '@/components/jobs-v2/CategoryScreen';
import type { SearchJobRecord } from '@/hooks/use-job-search';
import { trpc } from '@/lib/trpc';
import { logJobEvent } from '@/lib/event-logging';
import { haptic } from '@/lib/haptics';
import { defaultSearchCenter, haversineDistance } from '@/lib/job-geography';
import { useUserLocation } from '@/lib/use-user-location';
import { employerIdForCompany } from '@/lib/mock/employerMockData';
import { goBack } from '@/lib/navigation';
import { CATEGORIES, CATEGORY_SLUG_TO_TITLE, type CategoryId } from '@/lib/jobsData';

const LOGO_BG = ['#155743', '#C97A16', '#2FAE79', '#0E3B2E', '#F5A623'];
const EMPLOYER_BG = ['#0E3B2E', '#F5A623'];

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

function jobDistance(record: SearchJobRecord, center: { latitude: number; longitude: number }): string | undefined {
  const lat = Number(record.latitude);
  const lng = Number(record.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const km = haversineDistance(center, { latitude: lat, longitude: lng });
    return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  }
  return record.location_text?.trim() || undefined;
}

function jobSalary(record: SearchJobRecord): string {
  const amount = Number(record.pay_amount);
  const formatted = Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : String(record.pay_amount ?? '');
  const currency = (record.pay_currency ?? 'USD').toUpperCase();
  const symbol = currency === 'USD' ? '$' : `${currency} `;
  const unit = record.pay_type === 'hourly' ? 'hr' : record.pay_type === 'daily' ? 'day' : 'mo';
  return `${symbol}${formatted} / ${unit}`;
}

function jobType(record: SearchJobRecord): string {
  return record.pay_type === 'hourly' ? 'Hourly' : record.pay_type === 'daily' ? 'Daily' : 'Monthly';
}

function jobToListing(record: SearchJobRecord, center: { latitude: number; longitude: number }): CategoryJob {
  const company = record.employer_name?.trim() || 'Homlo employer';
  return {
    id: record.id,
    title: record.title,
    company,
    pay: jobSalary(record),
    type: jobType(record),
    distance: jobDistance(record, center),
    initials: initialsOf(company),
    color: LOGO_BG[hashOf(company) % LOGO_BG.length],
  };
}

function employersFrom(records: SearchJobRecord[]): Employer[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    const name = (record.employer_name ?? '').trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name], index) => ({
      id: employerIdForCompany(name),
      initials: initialsOf(name),
      color: EMPLOYER_BG[index % EMPLOYER_BG.length],
    }));
}

export default function CategoryDetailRoute() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const id = (slug as CategoryId) in CATEGORIES ? (slug as CategoryId) : 'cafe';
  const meta = CATEGORIES[id];
  const categoryTitle = CATEGORY_SLUG_TO_TITLE[id];
  const { location } = useUserLocation();
  const center = location ?? defaultSearchCenter;

  const { data, isLoading } = trpc.homlo.searchJobs.useQuery(
    { category: categoryTitle, limit: 40, sort: 'recommended' },
    { staleTime: 30_000 },
  );

  const jobs = useMemo(
    () => (data?.jobs ?? []).map((record) => jobToListing(record, center)),
    [data, center],
  );
  const employers = useMemo(() => employersFrom(data?.jobs ?? []), [data]);

  return (
    <CategoryScreen
      name={meta.title}
      descriptor={isLoading ? undefined : `${employers.length} employers hiring now`}
      employers={isLoading ? [] : employers}
      jobs={isLoading ? [] : jobs}
      countLabel={isLoading ? 'Loading jobs…' : `${jobs.length} jobs`}
      onBack={() => goBack(router)}
      onJobPress={(jobId) => {
        haptic.light();
        logJobEvent({ jobId, eventType: 'click', feedContext: 'category' });
        router.push({ pathname: '/job/[id]', params: { id: jobId } } as never);
      }}
      onEmployerPress={(employerId) => {
        haptic.light();
        router.push({ pathname: '/employer/[employerId]', params: { employerId } } as never);
      }}
      onFilters={() => router.push('/explore/filters' as never)}
    />
  );
}