/**
 * SINGLE place for every visible string used by the *New screens.
 * Wiring rule: replace each value with the app's EXISTING i18n call (t('existing.key')).
 * Do NOT add new i18n keys and do not change existing translations. The English below only matches the design preview.
 */
export const copyNew = {
  common: { back: 'Back', close: 'Close', clear: 'Clear', required: 'Required', optional: 'Optional', retry: 'Try again' },
  positions: (filled: number, total: number) => `${filled}/${total} position${total === 1 ? '' : 's'}`,
  home: {
    location: 'Location', searchPrefix: 'Search a',
    searchWords: ['forklift operator', 'barista', 'delivery rider', 'cashier', 'accountant'],
    jobField: 'Job field', jobType: 'Job type', recommended: 'Recommended', seeAll: 'See all', nearby: 'Jobs near you',
    popular: 'Popular', explore: 'Explore',
    hiringTitle: 'Hiring for your team?', hiringBody: 'Post a job and reach local candidates.', hiringCta: 'Post a job',
  },
  search: { cancel: 'Cancel', recent: 'Recent', suggestions: 'Suggestions', trending: 'Trending', placeholder: 'Search jobs' },
  results: {
    found: (n: number) => `${n} jobs found`, empty: 'No jobs match your search', emptyAction: 'Clear filters',
    error: 'Something went wrong', errorAction: 'Try again',
  },
  job: {
    pay: 'Pay', type: 'Type', positions: 'Positions', location: 'Location', details: 'Details',
    description: 'Description', requirements: 'Requirements', apply: 'Apply Now', aboutEmployer: 'About employer', save: 'Save',
  },
  apply: {
    title: 'Apply', name: 'Full name', phone: 'Phone number', cv: 'CV / Resume', uploadTitle: 'Upload your CV',
    uploadHint: 'PDF or DOCX · up to 5 MB', message: 'Message to employer',
    messagePlaceholder: 'Introduce yourself in a few words…', submit: 'Submit Application',
  },
  success: {
    title: 'Application sent', body: 'The employer will review your application. You will get updates in Alerts.',
    viewApplications: 'View my applications', backToJobs: 'Back to jobs',
  },
  post: {
    title: 'Dashboard', liveNow: (n: number) => `${n} live now`, live: 'Live now', posted: 'Jobs posted',
    applications: 'Applications', newApplicants: 'New applicants', add: 'Add a New Job', manage: 'Manage',
  },
  addJob: { step: (i: number, n: number) => `Step ${i} of ${n}`, next: 'Continue', submit: 'Submit job', preview: 'Live preview' },
  inbox: { title: 'Inbox', notifications: 'Notifications', messages: 'Messages', searchContacts: 'Search contacts or conversations', active: 'Active conversations', empty: 'Nothing here yet', emptyMessages: 'No messages yet' },
  chat: { message: 'Message', online: 'Online', empty: 'No messages yet' },
};

export function useCopyNew() {
  return copyNew; // TODO(wiring): return a memoised object that calls the app's existing t() for each string
}
