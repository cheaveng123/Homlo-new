// Vista category detail page (the redesigned "Job field" page).
// Registered as /vista/<key>; the home Job-field rail navigates here. Feeds
// VistaCategoryScreen with live published jobs from the database, filtered by
// the field's aliases. There is deliberately no sample-job fallback here: an
// empty field should say so rather than show jobs that are not in the DB.
import React, { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { logJobEvent } from '@/lib/event-logging';
import { haptic } from '@/lib/haptics';
import { defaultSearchCenter, haversineDistance } from '@/lib/job-geography';
import { resolveJobField } from '@/lib/job-fields';
import { useUserLocation } from '@/lib/use-user-location';
import { employerIdForCompany } from '@/lib/mock/employerMockData';
import { goBack } from '@/lib/navigation';
import { trpc } from '@/lib/trpc';
import VistaCategoryScreen from '@/components/vista/VistaCategoryScreen';
import { fieldForVistaKey, type VistaJob } from '@/components/vista/vistaCategoryData';

export default function VistaCategoryRoute() {
  const params = useLocalSearchParams<{ categoryKey?: string }>();
  const key = typeof params.categoryKey === 'string' ? params.categoryKey : undefined;
  const router = useRouter();

  const fieldId = useMemo(() => (key ? fieldForVistaKey(key) : undefined), [key]);
  const { location } = useUserLocation();
  const center = location ?? defaultSearchCenter;

  const { data, isLoading } = trpc.homlo.publicJobs.useQuery(undefined, {
    staleTime: 30_000,
  });

  const jobs = useMemo<VistaJob[]>(() => {
    if (!fieldId) return [];
    const mapped: VistaJob[] = [];
    for (const record of data?.jobs ?? []) {
      // Match on the DB's category string through the field alias table, so
      // both legacy titles ("Technology") and current ones ("IT & Technology")
      // land on the same Job-field page.
      if (resolveJobField(record.category)?.id !== fieldId) continue;

      const remote = record.work_arrangement
        ? record.work_arrangement.toLowerCase() === 'remote'
        : (record.location_text ?? '').toLowerCase().includes('remote');
      const pay = Number(record.pay_amount);
      const latitude = Number(record.latitude);
      const longitude = Number(record.longitude);
      const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);
      mapped.push({
        id: record.id,
        title: record.title,
        company: record.employer_name?.trim() || 'Homlo employer',
        pay: Number.isFinite(pay) ? pay : 0,
        kind: remote ? 'remote' : record.pay_type === 'fixed' ? 'monthly' : 'partTime',
        // 99 for "no coordinates": far enough to never match "Near me", while 0
        // stays reserved for remote (which the screen treats specially).
        km: remote ? 0 : hasCoords ? haversineDistance(center, { latitude, longitude }) : 99,
      });
    }
    return mapped;
  }, [data, center, fieldId]);

  return (
    <VistaCategoryScreen
      categoryKey={key}
      jobs={jobs}
      loading={isLoading}
      onBack={() => goBack(router)}
      onOpenSettings={() => {
        haptic.light();
        router.push('/search-detail' as never);
      }}
      onOpenJob={(job) => {
        haptic.light();
        logJobEvent({ jobId: job.id, eventType: 'click', feedContext: 'category' });
        router.push({ pathname: '/job/[id]', params: { id: job.id } } as never);
      }}
      onOpenEmployer={(job) => {
        haptic.light();
        router.push({
          pathname: '/employer/[employerId]',
          params: { employerId: employerIdForCompany(job.company) },
        } as never);
      }}
      onGetAlerts={() => {
        haptic.light();
        router.push('/explore/filters' as never);
      }}
    />
  );
}
