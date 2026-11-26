import { router } from '@/lib/router';
// REAL route paths. Every button in the new screens goes through here.
export const R = {
  /** Public job detail. */
  job: (id: string): string => `/job/${id}`,

  /** Edit job (from the job manager ⋯ menu). */
  editJob: (id: string): string => `/employer/job/${id}/edit`,

  /** Boost flow: step 1 = plan, step >= 2 = payment (with planId).
      The real live flow is /boost/plan -> /boost/payment -> success|failed. */
  boost: (jobId: string, step = 1, planId?: string): string =>
    step > 1
      ? `/boost/payment?jobId=${encodeURIComponent(jobId)}&planId=${encodeURIComponent(planId ?? '')}`
      : `/boost/plan?jobId=${encodeURIComponent(jobId)}`,

  /** Employer public profile (visitor view) + its sub-page. */
  employer: (id: string): string => `/employer/${encodeURIComponent(id)}`,
  employerJobs: (id: string): string => `/employer/${encodeURIComponent(id)}/jobs`,

  /** Employer profile "Message" — no real thread, existing stub. */
  chat: (): string => '/messages/stub',

  /** Chat thread seeded from an application (job manager Message). */
  thread: (applicationId: string, name: string, applicationStatus: string): string =>
    `/conversations/conversation?applicationId=${encodeURIComponent(applicationId)}&name=${encodeURIComponent(name)}&applicationStatus=${encodeURIComponent(applicationStatus)}`,

  /** Map picker for the edit job flow (writes lib/job-edit-draft). */
  pickLocation: (jobId: string): string => `/employer/job/${encodeURIComponent(jobId)}/edit/location`,

  login: (): string => '/login',
  employerHome: (): string => '/employer',
};
export const go = (p: string) => router.push(p as never);