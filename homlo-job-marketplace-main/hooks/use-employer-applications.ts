// The single source of truth for every employer-side applicant number.
//
// Before this, each screen derived its own counts: the dashboard fanned out
// `homlo.employer.applications` over its *live* jobs only, and the applicant
// screens fetched a single job's rows and counted them again. That is how the
// four dashboard tiles, the three list screens and the stats block could
// disagree with one another. Everything now reads from here instead.
//
// Two things it fixes beyond de-duplication:
//   - coverage. The fan-out is over ALL the employer's jobs, not just live
//     ones, because an applicant who applied before a listing was closed is
//     still an applicant. This is what makes "applications sent across all
//     jobs" and the 1w/1m/6m/1y chart possible without a new aggregate RPC.
//   - read state. `isNew` now comes from the `viewed_at` read receipt added by
//     migration 042 rather than from `status === 'applied'`, which had forced
//     opening an applicant to mutate their pipeline status.

import { useCallback, useMemo, useState } from "react";
import { isNewApplicant } from "@/lib/new-applicants";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import {
  normalizeEmployerJob,
  normalizeJobApplicant,
  type EmployerJobRow,
  type JobApplicantRow,
} from "@/lib/job-management";
import type { EmployerJob, JobApplicant } from "@/backend/domain/models";

export { isNewApplicant };

export type ApplicationsRange = "1w" | "1m" | "6m" | "1y";

export const APPLICATIONS_RANGES: ApplicationsRange[] = ["1w", "1m", "6m", "1y"];

const RANGE_START: Record<ApplicationsRange, number> = {
  "1w": 7,
  "1m": 30,
  "6m": 183,
  "1y": 365,
};

/** An applicant joined to the job they applied for, which is what every employer list row needs. */
export type EmployerApplication = JobApplicant & {
  jobId: string;
  jobTitle: string;
};

export type EmployerApplicationsStats = {
  /** Applications across every job the employer has posted. */
  totalApplications: number;
  /** Still-unread applications (the read receipt is null). */
  newApplicants: number;
  /** How many different jobs currently have at least one unread application. */
  jobsWithNew: number;
  jobsPosted: number;
  liveNow: number;
  /** Listings that are closed or have filled every position. */
  closedJobs: number;
};

export type ApplicationsPerJob = {
  jobId: string;
  jobTitle: string;
  total: number;
  unread: number;
};

export type UseEmployerApplications = {
  jobs: EmployerJob[];
  applications: EmployerApplication[];
  applicationsByJob: Map<string, EmployerApplication[]>;
  stats: EmployerApplicationsStats;
  applicationsPerJob: ApplicationsPerJob[];
  /** Applications bucketed per day across the given range, oldest first. */
  applicationsOverTime: { range: ApplicationsRange; buckets: { label: string; count: number }[] };
  unread: EmployerApplication[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<void>;
  markViewed: (applicationId: string) => Promise<void>;
};

const NO_JOBS: EmployerJobRow[] = [];
const NO_ROWS: JobApplicantRow[] = [];

/** `open` is the only status that still accepts applications. */
function isLive(status: string | null): boolean {
  return status === "open";
}

export function isClosed(status: string | null): boolean {
  return status === "closed" || status === "filled";
}

function startOfDayMs(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Buckets applications into one bar per day.
 *
 * A single day granularity for all four ranges on purpose: it is the only
 * honest bucket that works for `1w` (7 readable bars) and stays correct for
 * `1y` (365 bars rendered by the chart as a filled area, not individual bars).
 */
function bucketByDay(applications: EmployerApplication[], range: ApplicationsRange) {
  const days = RANGE_START[range];
  const today = startOfDayMs(Date.now());
  const from = today - (days - 1) * 86_400_000;
  const counts = new Array<number>(days).fill(0);

  for (const application of applications) {
    const applied = new Date(application.appliedAt).getTime();
    if (Number.isNaN(applied)) continue;
    const day = Math.floor((startOfDayMs(applied) - from) / 86_400_000);
    if (day >= 0 && day < days) counts[day] += 1;
  }

  // Label sparsely: a 365-day range must not try to print 365 axis labels.
  const labelEvery = days <= 7 ? 1 : days <= 31 ? 5 : days <= 183 ? 30 : 90;
  const buckets = counts.map((count, index) => {
    const date = new Date(from + index * 86_400_000);
    const label =
      index % labelEvery === 0 && index > 0
        ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : "";
    return { label, count };
  });

  return { range, buckets };
}

export function useEmployerApplications(range: ApplicationsRange = "1m"): UseEmployerApplications {
  const { user } = useAuth();
  const enabled = Boolean(user);

  const jobsQuery = trpc.homlo.employer.jobs.useQuery(undefined, { enabled });

  /**
   * Optimistic read receipts, keyed by application id.
   *
   * Deliberately a local overlay rather than a React Query cache patch: the
   * applicant rows live across one cache entry per job, so an optimistic write
   * would have to touch every entry in the fan-out and then unwind them on
   * failure. The overlay gives instant feedback on whichever screen is open,
   * and the authoritative value arrives from the server on invalidate â€” which
   * is what makes the dashboard tiles correct once the user navigates back.
   */
  const [pendingViewed, setPendingViewed] = useState<Record<string, string>>({});
  const utils = trpc.useUtils();
  const markViewedMutation = trpc.homlo.applications.markViewed.useMutation();

  const jobRows = useMemo<EmployerJobRow[]>(
    () => (jobsQuery.data as { jobs?: EmployerJobRow[] } | undefined)?.jobs ?? NO_JOBS,
    [jobsQuery.data],
  );

  // All jobs, not just live ones â€” closed and draft listings still hold the
  // applicants who applied while they were open.
  // PERF: one query for every job's applicants (was one query per job).
  const applicantsQuery = trpc.homlo.employer.allApplications.useQuery(undefined, {
    enabled: enabled && jobRows.length > 0,
  });

  const rowsByJobId = useMemo(() => {
    const map = new Map<string, JobApplicantRow[]>();
    const rows = (applicantsQuery.data as { applications?: (JobApplicantRow & { job_id?: string })[] } | undefined)
      ?.applications ?? [];
    for (const row of rows) {
      if (!row.job_id) continue;
      const bucket = map.get(row.job_id);
      if (bucket) bucket.push(row);
      else map.set(row.job_id, [row]);
    }
    return map;
  }, [applicantsQuery.data]);

  const rowsFor = useCallback(
    (index: number): JobApplicantRow[] => rowsByJobId.get(jobRows[index]?.id ?? "") ?? NO_ROWS,
    [rowsByJobId, jobRows],
  );

  const jobs = useMemo(
    () => jobRows.map((row) => normalizeEmployerJob(row)),
    [jobRows],
  );

  const titleByJobId = useMemo(() => {
    const map = new Map<string, string>();
    for (const job of jobs) map.set(job.id, job.title || "Untitled job");
    return map;
  }, [jobs]);

  const applications = useMemo<EmployerApplication[]>(() => {
    const all: EmployerApplication[] = [];
    jobRows.forEach((job, index) => {
      for (const row of rowsFor(index)) {
        const applicant = normalizeJobApplicant(row);
        all.push({
          ...applicant,
          jobId: job.id,
          jobTitle: titleByJobId.get(job.id) ?? "Untitled job",
        });
      }
    });
    return all;
  }, [jobRows, rowsFor, titleByJobId]);

  /**
   * Applies the optimistic overlay on top of the server's read receipts. A row
   * is unread only when the server has no receipt AND nothing local claims one.
   */
  const withViewedState = useCallback(
    (application: EmployerApplication): EmployerApplication => {
      if (!application.isNew) return application;
      const stamp = pendingViewed[application.id];
      if (!stamp) return application;
      return { ...application, isNew: false, viewedAt: stamp };
    },
    [pendingViewed],
  );

  const applicationsByJob = useMemo(() => {
    const map = new Map<string, EmployerApplication[]>();
    for (const job of jobs) map.set(job.id, []);
    for (const raw of applications) {
      const application = withViewedState(raw);
      const bucket = map.get(application.jobId);
      if (bucket) bucket.push(application);
    }
    // Newest applicant first within each job, matching the read model's order.
    for (const bucket of map.values()) {
      bucket.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    }
    return map;
  }, [applications, jobs, withViewedState]);

  const unread = useMemo(
    () =>
      applications
        .map(withViewedState)
        .filter(isNewApplicant)
        .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()),
    [applications, withViewedState],
  );

  const stats = useMemo<EmployerApplicationsStats>(() => {
    let totalApplications = 0;
    for (const bucket of applicationsByJob.values()) totalApplications += bucket.length;

    let jobsWithNew = 0;
    for (const bucket of applicationsByJob.values()) {
      if (bucket.some(isNewApplicant)) jobsWithNew += 1;
    }

    return {
      totalApplications,
      newApplicants: unread.length,
      jobsWithNew,
      jobsPosted: jobs.length,
      liveNow: jobRows.filter((job) => isLive(job.status)).length,
      closedJobs: jobRows.filter((job) => isClosed(job.status)).length,
    };
  }, [applicationsByJob, jobs.length, jobRows, unread.length]);

  const applicationsPerJob = useMemo<ApplicationsPerJob[]>(
    () =>
      jobs
        .map((job) => {
          const bucket = applicationsByJob.get(job.id) ?? [];
          return {
            jobId: job.id,
            jobTitle: job.title || "Untitled job",
            total: bucket.length,
            unread: bucket.filter(isNewApplicant).length,
          };
        })
        .filter((entry) => entry.total > 0)
        .sort((a, b) => b.total - a.total),
    [applicationsByJob, jobs],
  );

  // "Applications received", so this counts every application, not just the
  // unread ones, and plots each at its `appliedAt`.
  const applicationsOverTime = useMemo(
    () => bucketByDay(applications, range),
    [applications, range],
  );

  const markViewed = useCallback(
    async (applicationId: string) => {
      if (pendingViewed[applicationId]) return;

      const stamp = new Date().toISOString();
      setPendingViewed((previous) => ({ ...previous, [applicationId]: stamp }));
      try {
        await markViewedMutation.mutateAsync({ applicationId });
        // Refresh both the dashboard's single list and any per-job views.
        await Promise.all([
          utils.homlo.employer.allApplications.invalidate(),
          utils.homlo.employer.applications.invalidate(),
        ]);
      } catch {
        // Roll back the optimistic receipt so the row returns to unread.
        setPendingViewed((previous) => {
          const next = { ...previous };
          delete next[applicationId];
          return next;
        });
      }
    },
    [markViewedMutation, pendingViewed, utils],
  );

  const isLoading = jobsQuery.isLoading || applicantsQuery.isLoading;
  const isError = jobsQuery.isError || applicantsQuery.isError;

  const refetch = useCallback(async () => {
    await Promise.all([
      jobsQuery.refetch(),
      ...(jobRows.length > 0 ? [applicantsQuery.refetch()] : []),
    ]);
  }, [applicantsQuery, jobsQuery, jobRows.length]);

  return {
    jobs,
    applications: applications.map(withViewedState),
    applicationsByJob,
    stats,
    applicationsPerJob,
    applicationsOverTime,
    unread,
    isLoading,
    isFetching: jobsQuery.isFetching,
    isError,
    error: jobsQuery.error,
    refetch,
    markViewed,
  };
}