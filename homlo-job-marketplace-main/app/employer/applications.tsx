import { useCallback, useMemo, useState } from 'react';

import { EmployerJobsListScreen } from '@/components/employer-job/EmployerJobsListScreen';
import { useEmployerApplications } from '@/hooks/use-employer-applications';

/**
 * "Applications" tile: every job the employer has posted, each row carrying its
 * own applicant count, busiest job first.
 *
 * Sorted by applicant count rather than date because the tile this screen hangs
 * off is the running total of applications — the question being answered is
 * "which job is getting attention", not "which did I post last".
 */
export default function EmployerApplicationsScreen() {
  const { jobs, applicationsByJob, isLoading, isError, refetch } = useEmployerApplications();
  const [refreshing, setRefreshing] = useState(false);

  const sorted = useMemo(
    () =>
      [...jobs].sort(
        (a, b) =>
          (applicationsByJob.get(b.id)?.length ?? 0) - (applicationsByJob.get(a.id)?.length ?? 0),
      ),
    [applicationsByJob, jobs],
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
      title="Applications"
      subtitle="Most applicants first"
      jobs={sorted}
      applicationsByJob={applicationsByJob}
      isLoading={isLoading}
      isError={isError}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onRetry={onRefresh}
      emptyTitle="No jobs here yet"
      emptyBody="Post a job and everyone who applies to it will show up on this list."
    />
  );
}