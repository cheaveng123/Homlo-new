// toVistaJob.ts
// Turns a published-job record (homlo.publicJobs) into the VistaJob card data
// used by the shared ListingScreen template. Shared by the Category detail
// page and the Popular page so their cards read the same.
import { haversineDistance } from '@/lib/job-geography';
import type { MapCoordinate } from '@/lib/openstreetmap-geocoding';
import { getProfilePhotoUrl } from '@/lib/profile-photo';
import type { VistaJob } from './vistaCategoryData';

/** The fields of a published-job record this mapping reads. */
export type PublishedJobLike = {
  id: string;
  title: string;
  employer_name?: string | null;
  employer_photo_key?: string | null;
  pay_amount?: number | string | null;
  pay_type?: string | null;
  work_arrangement?: string | null;
  location_text?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  created_at?: string | null;
};

export function toVistaJob(record: PublishedJobLike, center: MapCoordinate): VistaJob {
  const remote = record.work_arrangement
    ? record.work_arrangement.toLowerCase() === 'remote'
    : (record.location_text ?? '').toLowerCase().includes('remote');
  const pay = Number(record.pay_amount);
  const latitude = Number(record.latitude);
  const longitude = Number(record.longitude);
  const hasCoords = record.latitude != null && record.longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude);
  return {
    id: record.id,
    title: record.title,
    company: record.employer_name?.trim() || 'Homlo employer',
    pay: Number.isFinite(pay) ? pay : 0,
    kind: remote ? 'remote' : record.pay_type === 'fixed' ? 'monthly' : 'partTime',
    // 99 for "no coordinates": far enough to never match "Near me", while 0
    // stays reserved for remote (which the screen treats specially).
    km: remote ? 0 : hasCoords ? haversineDistance(center, { latitude, longitude }) : 99,
    area: record.location_text ?? undefined,
    postedAt: record.created_at ?? undefined,
    logoUrl: getProfilePhotoUrl(record.employer_photo_key),
    payUnit: record.pay_type === 'hourly' ? '/hr' : record.pay_type === 'daily' ? '/day' : '/mo',
  };
}
