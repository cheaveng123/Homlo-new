// Vista category detail page (the redesigned "Job field" page).
// Registered as /vista/<key>; the home Job-field rail navigates here. Feeds
// VistaCategoryScreen with live published jobs from the database, filtered by
// the field's aliases. There is deliberately no sample-job fallback here: an
// empty field should say so rather than show jobs that are not in the DB.
import React, { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { logJobEvent } from '@/lib/event-logging';
import { haptic } from '@/lib/haptics';
import { defaultSearchCenter } from '@/lib/job-geography';
import { resolveJobField } from '@/lib/job-fields';
import { useUserLocation } from '@/lib/use-user-location';
import { employerIdForCompany } from '@/lib/mock/employerMockData';
import { goBack } from '@/lib/navigation';
import { trpc } from '@/lib/trpc';
import { useJobStore } from '@/components/job-store';
import VistaCategoryScreen from '@/components/vista/VistaCategoryScreen';
import { fieldForVistaKey, type VistaJob } from '@/components/vista/vistaCategoryData';
import { toVistaJob } from '@/components/vista/toVistaJob';

export default function VistaCategoryRoute() {
  const params = useLocalSearchParams<{ categoryKey?: string }>();
  const key = typeof params.categoryKey === 'string' ? params.categoryKey : undefined;
  const router = useRouter();
  const { isSaved, toggleSaved } = useJobStore();

  const fieldId = useMemo(() => (key ? fieldForVistaKey(key) : undefined), [key]);
  const { location } = useUserLocation();
  const center = location ?? defaultSearchCenter;

  const { data, isLoading } = trpc.homlo.publicJobs.useQuery(undefined, {
    // PERF: staleTime comes from the shared publicJobs default (app/_layout.tsx).
  });

  const jobs = useMemo<VistaJob[]>(() => {
    if (!fieldId) return [];
    const mapped: VistaJob[] = [];
    for (const record of data?.jobs ?? []) {
      // Match on the DB's category string through the field alias table, so
      // both legacy titles ("Technology") and current ones ("IT & Technology")
      // land on the same Job-field page.
      if (resolveJobField(record.category)?.id !== fieldId) continue;

      mapped.push(toVistaJob(record, center));
    }
    return mapped;
  }, [data, center, fieldId]);

  return (
    <VistaCategoryScreen
      categoryKey={key}
      jobs={jobs}
      loading={isLoading}
      onBack={() => goBack(router)}
      isSaved={isSaved}
      onToggleSave={(job) => toggleSaved(job.id)}
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
