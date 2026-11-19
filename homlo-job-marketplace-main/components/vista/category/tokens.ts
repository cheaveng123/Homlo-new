// Shared tokens and small pure helpers for the Category detail page.
// Visual-only: nothing here fetches data or changes what a job is.
import type { VistaJob } from '../vistaCategoryData';

export { AP } from '@/components/employer-job/applicants/tokens';

export const F = {
  h: 'PlusJakartaSans_800ExtraBold',
  hb: 'PlusJakartaSans_700Bold',
  b: 'Inter_400Regular',
  m: 'Inter_500Medium',
  s: 'Inter_600SemiBold',
} as const;

/** Hairline used by the top bar, cards and sheet rows on this page. */
export const LINE = '#E3E9EC';
export const CITY = 'Phnom Penh';

/**
 * Phnom Penh areas used by the Area sheet, with the spellings the job data
 * uses for each (lib/job-geography.ts writes "Tuol Kork", posters often write
 * "Toul Kork"; the Russian Market sits in Tuol Tom Poung).
 */
export const AREAS: { name: string; match: string[] }[] = [
  { name: 'BKK1', match: ['bkk1', 'bkk 1', 'boeung keng kang', 'boeng keng kang'] },
  { name: 'Toul Kork', match: ['toul kork', 'tuol kork', 'tuol kouk', 'toul kouk'] },
  { name: 'Daun Penh', match: ['daun penh', 'doun penh', 'riverside'] },
  { name: 'Sen Sok', match: ['sen sok', 'sen sokh'] },
  { name: 'Chroy Changvar', match: ['chroy changvar', 'chrouy changvar'] },
  { name: 'Russian Market', match: ['russian market', 'tuol tom poung', 'toul tom poung', 'tuol tompoung', 'toul tompoung'] },
];

/** Canonical area for a job, or undefined when its location names none of the areas. */
export function areaOf(job: VistaJob): string | undefined {
  const raw = (job.area ?? '').toLowerCase();
  if (!raw) return undefined;
  return AREAS.find((a) => a.match.some((m) => raw.includes(m)))?.name;
}

/** Short place label for the card meta line. */
export function placeLabel(job: VistaJob): string {
  if (job.kind === 'remote') return 'Remote';
  return areaOf(job) ?? CITY;
}

const HOUR = 3_600_000;

export function hoursSince(iso?: string): number | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return undefined;
  return Math.max(0, (Date.now() - t) / HOUR);
}

export function agoLabel(iso?: string): string | undefined {
  const h = hoursSince(iso);
  if (h === undefined) return undefined;
  if (h < 1) return 'Just now';
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

/** "New" chip: posted within the last day. */
export const isNew = (job: VistaJob) => {
  const h = hoursSince(job.postedAt);
  return h !== undefined && h < 24;
};

export function payParts(job: VistaJob): { amount: string; unit: string } {
  const amount = `$${job.pay.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return { amount, unit: job.payUnit ?? (job.kind === 'partTime' ? '/hr' : '/mo') };
}

export function scheduleLabel(job: VistaJob): string {
  if (job.schedule) return job.schedule;
  if (job.kind === 'partTime') return 'Flexible · 4h';
  if (job.kind === 'remote') return 'Flexible hours';
  return 'Mon–Sat · 8h';
}

export function hashOf(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
