import { useLocalSearchParams, useRouter } from "expo-router";

import { ApplicationDetailView } from "@/src/new/applications";
import type { ApplicationDetail } from "@/src/new/applications/types";
import { useApplication } from "@/src/new/applications/useMyApplications";
import { openApplicationChat, openApplications, openExplore, openJob } from "@/src/new/applications/routes";
import { haptic } from "@/lib/haptics";

export default function ApplicationDetailRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const applicationId = Array.isArray(params.id) ? params.id[0] : params.id ?? "";

  const { user, authLoading, application, isLoading, error, refetch } = useApplication(
    applicationId || undefined,
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else openApplications(router);
  };

  const detail: ApplicationDetail | undefined = application
    ? {
        id: application.id,
        jobTitle: application.job_title,
        employerName: application.employer_name ?? null,
        jobImageUri: application.banner_image ?? null,
        status: application.state,
        appliedAt: application.created_at,
        payLabel: application.payLabel ?? null,
        typeLabel: null,
        locationLabel: null,
        message: application.message ?? null,
        files: [],
      }
    : undefined;

  const onViewJob = () => {
    haptic.selection();
    if (application?.job_id) {
      openJob(router, application.job_id);
    } else {
      openApplications(router);
    }
  };

  const onMessageEmployer = () => {
    if (applicationId) {
      haptic.selection();
      openApplicationChat(router, applicationId);
    }
  };

  const onFindSimilarJobs = () => {
    haptic.selection();
    openExplore(router);
  };

  const onViewFile = () => {
    // No files exposed by the list query yet; silent no-op.
  };

  if (!user && !authLoading) {
    return null;
  }

  const state = isLoading || authLoading ? "loading" : error ? "error" : !detail ? "notFound" : "ready";

  return (
    <ApplicationDetailView
      state={state}
      application={detail}
      onBack={goBack}
      onRetry={() => void refetch()}
      onViewJob={onViewJob}
      onMessageEmployer={onMessageEmployer}
      onFindSimilarJobs={onFindSimilarJobs}
      onViewFile={onViewFile}
    />
  );
}
