import { useCallback, useMemo, useState } from 'react';

import { EmployerJobsListScreen } from '@/components/employer-job/EmployerJobsListScreen';
import { useEmployerApplications } from '@/hooks/use-employer-applications';

/**
 * "Live now" tile: the subset of listings that still accept applications.
 *
 * `open` is the only status that does, so draft, filled, closed, expired and
 * cancelled listings are all excluded. This is the same predicate the rest of
 * the employer surface uses for "live".
 */
export default function EmployerLiveNowScreen() {
  const { jobs, applicationsByJob, isLoading, isError, refetch } = useEmployerApplications();
  const [refreshing, setRefreshing] = useState(false);

  const live = useMemo(
    () =>
      jobs
        .filter((job) => job.status === 'open')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [jobs],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <EmployerJobsListScreen
      title="Live now"
      subtitle="Accepting applications"
      jobs={live}
      applicationsByJob={applicationsByJob}
      isLoading={isLoading}
      isError={isError}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onRetry={onRefresh}
      emptyTitle="Nothing live right now"
      emptyBody="Publish a listing and it will show up here while it is accepting applications."
      onExpire={onRefresh}
    />
  );
}