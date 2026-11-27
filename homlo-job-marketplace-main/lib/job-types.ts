/**
 * The four Job types offered on Home and on the Job type page, in display order.
 * Keys match the Home card themes/illustrations (src/new/components/home/HomePartsNew)
 * and the `tab` param of /jobs/ways-to-work.
 *
 * Separate from JOB_TYPE_IMAGES (components/shared/jobTypeImage), which still
 * maps work arrangements such as "Remote" to artwork on job detail pages.
 */
export const HOME_JOB_TYPES = [
  { key: 'part-time', label: 'Part-time' },
  { key: 'full-time', label: 'Full-time' },
  { key: 'volunteer', label: 'Volunteer' },
  { key: 'weekends', label: 'Weekends' },
] as const;

export type HomeJobTypeKey = (typeof HOME_JOB_TYPES)[number]['key'];

/** Words that mark a listing as volunteer work (no volunteer field exists in the data). */
export const VOLUNTEER_PATTERN = /volunt|unpaid|charity|non-?profit|community service/i;
