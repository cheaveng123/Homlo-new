import { useCallback, useMemo, useState } from 'react';

import { EmployerJobsListScreen } from '@/components/employer-job/EmployerJobsListScreen';
import { isClosed, useEmployerApplications } from '@/hooks/use-employer-applications';

/**
 * "Closed jobs" tile: the listings the employer has closed, newest first.
 *
 * Unlike Applications this keeps zero-applicant jobs visible, because the point
 * of this screen is the state of their listings rather than their applicants.
 * Closed listings stay here so the employer can still see who applied before
 * the role was taken down or filled.
 */
export default function EmployerJobsPostedScreen() {
  const { jobs, applicationsByJob, isLoading, isError, refetch } = useEmployerApplications();
  const [refreshing, setRefreshing] = useState(false);

  const sorted = useMemo(
    () =>
      jobs
        .filter((job) => isClosed(job.status))
        .sort(
          (a, b) =>
            new Date(b.updatedAt ?? b.createdAt).getTime() -
            new Date(a.updatedAt ?? a.createdAt).getTime(),
        ),
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
      title="Closed jobs"
      subtitle="Most recently closed first"
      jobs={sorted}
      applicationsByJob={applicationsByJob}
      isLoading={isLoading}
      isError={isError}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onRetry={onRefresh}
      emptyTitle="No closed jobs yet"
      emptyBody="Jobs you close or that fill up will appear here with their applicant count."
    />
  );
}