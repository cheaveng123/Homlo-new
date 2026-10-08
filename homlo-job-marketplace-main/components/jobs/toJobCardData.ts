import type { Job } from '@/components/job-store';
import type { JobCardData, WorkArrangement } from './jobCardTypes';
import { brand } from '@/components/design-tokens';

/**
 * Monogram tile colours, matching the hash the rest of the app already uses for
 * employer initials so a company keeps one colour across surfaces.
 */
const LOGO_COLORS = [brand[500], '#1F5397', '#A65C18', '#7144A4', '#A04141', brand[700]];

export function logoColorFor(company: string): string {
  let hash = 0;
  for (let index = 0; index < company.length; index += 1) {
    hash = (hash << 5) - hash + company.charCodeAt(index);
    hash |= 0;
  }
  return LOGO_COLORS[Math.abs(hash) % LOGO_COLORS.length];
}

const ARRANGEMENT: Record<NonNullable<Job['arrangement']>, WorkArrangement> = {
  'On-site': 'onsite',
  Hybrid: 'hybrid',
  Remote: 'remote',
};

/** Placeholder strings the data layer uses to mean "location unknown". */
const UNKNOWN_LOCATIONS = new Set(['', 'various', 'various locations', 'anywhere', '-', 'n/a', 'not specified']);

function arrangementOf(job: Job): WorkArrangement {
  return (job.arrangement && ARRANGEMENT[job.arrangement]) || 'onsite';
}

/**
 * Keep the locality (the city), not "City, ST, Country". Sentinels that carry
 * no place name are dropped so the card falls back to arrangement-only.
 */
function locationLabelOf(job: Job): string | null {
  const place = job.location?.split(',')[0]?.trim() ?? '';
  if (!place || UNKNOWN_LOCATIONS.has(place.toLowerCase())) return null;
  return place;
}

/**
 * Maps the app's canonical Job onto the new job container's view-model.
 *
 * Read the RAW Job. Do not pass this through normalizeJob()/the store's
 * listings first: lib/job-utils.ts:39-56 drops
 * positionsAvailable/positionsTotal/positionsFilled, which is the only source
 * for the positions-left container.
 *
 * `payLabel` is taken verbatim — `job.pay` is already display-formatted, and
 * curated listings carry ranges/commission text that formatMoney() cannot
 * reproduce.
 *
 * rating/reviewCount/employerLogoUrl have no source in the client data
 * (reviews.rating exists in SQL but no read model selects it), so they stay
 * undefined and the card's star row stays hidden.
 */
export function toJobCardData(job: Job): JobCardData {
  return {
    id: job.id,
    title: job.title,
    employerName: job.company,
    employerInitials: undefined,
    employerLogoUrl: null,
    employerColor: logoColorFor(job.company),
    imageUrl: job.image || null,
    payLabel: job.pay,
    workArrangement: arrangementOf(job),
    locationLabel: locationLabelOf(job),
    positionsLeft: job.positionsAvailable,
    positionsTotal: job.positionsTotal,
  };
}

export function toJobCardDataList(jobs: Job[]): JobCardData[] {
  return jobs.map(toJobCardData);
}