// MOCK DATA for the preview screens. Replace with the real jobs repository / API; keep the Job shape (or adapt the screens).
import { useMemo } from 'react';
import type { IconName } from '@/components/ui/AppIcon';
import { useJobStore } from '@/components/job-store';
import { opportunityCategories } from '@/lib/category-data';

export type CategoryId = 'cafe' | 'hotel' | 'retail' | 'delivery' | 'office';

export type Job = {
  id: string; title: string; company: string; area: string;
  type: 'PT' | 'FT'; pay: string; unit: '/hr' | '/mo'; monthly?: number; upTo?: string;
  match: number;                 // 0-100 match score for the signed-in user
  km: number | null;             // distance from the user; null = remote
  cat: CategoryId; tint: number; // tint = index into TINTS / SOLIDS
  days?: string[]; hours?: string; role?: string; benefits?: string[];
  remote?: [number, number];     // usual working hours as segment range (12 segments, 6 AM to 6 PM)
};

export const JOBS: Job[] = [
  { id: '1', title: 'Barista', company: 'Brew Lab', area: 'BKK1', type: 'PT', pay: '$3.5', unit: '/hr', match: 96, km: 0.8, cat: 'cafe', tint: 1, days: ['Sat', 'Sun'], hours: '6–10 PM', role: 'barista' },
  { id: '2', title: 'Front desk officer', company: 'Sala Hotel', area: 'Daun Penh', type: 'FT', pay: '$320', unit: '/mo', monthly: 320, upTo: '$420', match: 91, km: 1.4, cat: 'hotel', tint: 0, benefits: ['Health', '13th month'] },
  { id: '3', title: 'Spa therapist', company: 'Riverside Spa', area: 'Riverside', type: 'PT', pay: '$4', unit: '/hr', match: 84, km: 1.1, cat: 'hotel', tint: 3, days: ['Fri', 'Sat'], hours: '5–9 PM' },
  { id: '4', title: 'Delivery rider', company: 'Nham24', area: 'Toul Kork', type: 'PT', pay: '$5', unit: '/hr', match: 88, km: 2.1, cat: 'delivery', tint: 2, days: ['Sat', 'Sun'], hours: '10 AM–2 PM' },
  { id: '5', title: 'Sales associate', company: 'Mekong Mart', area: 'Chamkarmon', type: 'FT', pay: '$280', unit: '/mo', monthly: 280, upTo: '$360', match: 79, km: 2.6, cat: 'retail', tint: 0, benefits: ['Bonus', 'Meals'] },
  { id: '6', title: 'Kitchen helper', company: 'Angkor Café', area: 'Sen Sok', type: 'PT', pay: '$3', unit: '/hr', match: 82, km: 3.4, cat: 'cafe', tint: 1, days: ['Mon', 'Tue', 'Wed'], hours: '4–8 PM', role: 'kitchen' },
  { id: '7', title: 'Graphic designer', company: 'Pixel Studio', area: 'Remote', type: 'FT', pay: '$600', unit: '/mo', monthly: 600, upTo: '$800', match: 87, km: null, cat: 'office', tint: 3, benefits: ['Health'], remote: [2, 9] },
  { id: '8', title: 'Customer support', company: 'Lotus Logistics', area: 'Remote', type: 'FT', pay: '$450', unit: '/mo', monthly: 450, upTo: '$520', match: 75, km: null, cat: 'office', tint: 2, benefits: ['Meals'], remote: [3, 10] },
  { id: '9', title: 'Cashier', company: 'Mekong Mart', area: 'Chamkarmon', type: 'PT', pay: '$3.2', unit: '/hr', match: 77, km: 4.4, cat: 'retail', tint: 0, days: ['Sat'], hours: '9 AM–1 PM' },
  { id: '10', title: 'Waiter', company: 'Golden Spoon', area: 'BKK1', type: 'PT', pay: '$3.8', unit: '/hr', match: 85, km: 1.2, cat: 'cafe', tint: 1, days: ['Sat', 'Sun'], hours: '5–10 PM', role: 'waiter' },
  { id: '11', title: 'Cashier', company: 'Cup & Co', area: 'Daun Penh', type: 'PT', pay: '$3.3', unit: '/hr', match: 80, km: 1.9, cat: 'cafe', tint: 1, days: ['Fri', 'Sat'], hours: '3–9 PM', role: 'cashier' },
  { id: '12', title: 'Pastry assistant', company: 'Lotus Bakery', area: 'Toul Tompoung', type: 'FT', pay: '$300', unit: '/mo', monthly: 300, upTo: '$380', match: 78, km: 2.8, cat: 'cafe', tint: 1, benefits: ['Meals', 'Bonus'], role: 'pastry' },
  { id: '13', title: 'Khmer–English translator', company: 'Linguo', area: 'Remote', type: 'PT', pay: '$6', unit: '/hr', match: 83, km: null, cat: 'office', tint: 3, days: ['Flexible'], hours: 'Any hours', remote: [1, 6] },
  { id: '14', title: 'Social media assistant', company: 'Pixel Studio', area: 'Remote', type: 'PT', pay: '$4', unit: '/hr', match: 81, km: null, cat: 'office', tint: 2, days: ['Flexible'], hours: 'Any hours', remote: [4, 9] },
];

export const CATEGORIES: Record<CategoryId, { title: string; icon: IconName; open: number; urgent: number }> = {
  cafe: { title: 'Café & Food', icon: 'cup', open: 38, urgent: 12 },
  hotel: { title: 'Hotel & Spa', icon: 'hotel', open: 24, urgent: 6 },
  retail: { title: 'Retail', icon: 'bag', open: 31, urgent: 9 },
  delivery: { title: 'Delivery', icon: 'bike', open: 19, urgent: 8 },
  office: { title: 'Office & Remote', icon: 'laptop', open: 27, urgent: 4 },
};

// Maps the five preview slugs onto the app's real (legacy) category titles,
// which are the exact join keys used by homlo.searchJobs.
export const CATEGORY_SLUG_TO_TITLE: Record<CategoryId, string> = {
  cafe: 'Hospitality',
  hotel: 'Hospitality',
  retail: 'Retail',
  delivery: 'Logistics',
  office: 'Administration',
};

// Reverse lookup: a real opportunity category id -> preview slug. Titles not
// covered by the five preview categories return null (leave the existing route).
const LEGACY_ID_TO_SLUG: Partial<Record<string, CategoryId>> = {
  hospitality: 'cafe',
  retail: 'retail',
  logistics: 'delivery',
  administration: 'office',
};

/** Real category title → preview slug (cafe/hotel/retail/delivery/office), or null. */
export function categorySlugForTitle(title: string | undefined | null): CategoryId | null {
  if (!title) return null;
  const key = title.trim().toLowerCase();
  const direct = (Object.keys(CATEGORIES) as CategoryId[]).find(
    (id) => CATEGORIES[id].title.toLowerCase() === key,
  );
  if (direct) return direct;
  const legacy = opportunityCategories.find((c) => c.title.toLowerCase() === key || c.id === key);
  if (!legacy) return null;
  return LEGACY_ID_TO_SLUG[legacy.id] ?? null;
}

/** Route href for a category title, or null when there is no preview screen for it. */
export function categoryRouteForTitle(title: string | undefined | null): string | null {
  const slug = categorySlugForTitle(title);
  return slug ? `/jobs/category/${slug}` : null;
}

export const hourlyEq = (j: Job) => (j.monthly ? j.monthly / 170 : parseFloat(j.pay.slice(1)));
export const payText = (j: Job) => `${j.pay}${j.unit}`;
export const typeLabel = (j: Job) => (j.type === 'PT' ? 'Part-time' : 'Full-time');
export const travelText = (km: number) => (km <= 1.5 ? `${Math.round(km * 12)} min walk` : `${Math.round(km * 4)} min ride`);

/** Saved jobs, persisted through the app's existing job store (AsyncStorage). */
export function useSavedJobs() {
  const { savedIds, toggleSaved } = useJobStore();
  const saved = useMemo(() => new Set(savedIds), [savedIds]);
  return { saved, toggle: toggleSaved };
}