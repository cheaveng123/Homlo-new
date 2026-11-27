/**
 * Central route strings for the redesign screens (docs/redesign).
 *
 * Targets and params are taken verbatim from the existing app — this file only
 * centralises them so the five employer screens can reference one source. Use
 * these builders instead of hand-writing `router.push()` strings in the
 * employer-v2 components.
 */

type Href = string | { pathname: string; params: Record<string, string> };

export const routes = {
  /** Public job detail. */
  job: (id: string): Href => `/job/${id}`,

  /** Chat thread seeded from an application. */
  conversation: (applicationId: string, name: string, applicationStatus: string): Href => ({
    pathname: '/conversations/[id]',
    params: { id: 'conversation', applicationId, name, applicationStatus },
  }),

  /** Boost flow (live, 3 steps). */
  boostPlan: (jobId: string): Href => ({ pathname: '/boost/plan', params: { jobId } }),
  boostPayment: (jobId: string, planId: string): Href => ({ pathname: '/boost/payment', params: { jobId, planId } }),
  boostSuccess: (jobId: string | null, planId: string, receiptId?: string | null): Href => ({
    pathname: '/boost/success',
    params: { jobId: jobId ?? '', planId, receiptId: receiptId ?? '' },
  }),
  boostFailed: (jobId: string | null, planId: string, reason: string): Href => ({
    pathname: '/boost/failed',
    params: { jobId: jobId ?? '', planId, reason },
  }),

  /** Employer public profile (visitor view) + its sub-page. */
  employer: (employerId: string): Href => `/employer/${employerId}`,
  employerJobs: (employerId: string): Href => `/employer/${employerId}/jobs`,

  /** Job manager (employer-side detail for one posted job). */
  manageJob: (jobId: string): Href => `/employer/job/${jobId}`,
  editJob: (jobId: string): Href => `/employer/job/${jobId}/edit`,
  editJobLocation: (jobId: string): Href => `/employer/job/${jobId}/edit/location`,
  editJobCategory: (jobId: string): Href => `/employer/job/${jobId}/edit/category`,

  /** Existing chat stub (employer profile Message has no thread). */
  messagesStub: (): Href => '/messages/stub',

  login: (): Href => '/login',
  employerHome: (): Href => '/employer',
  employerListings: (): Href => '/employer/listings',
};

export const R = routes;