import { AccentKey } from './theme';
import { IconName } from './AppIcon';

export type CategoryStyle = { accent: AccentKey; icon: IconName; descriptor: string };

/**
 * Official categories from the database (seeded via seed-home-feed.ts).
 * Each has a name (display), slug (for API), accent color, and icon.
 */
export const CATEGORIES: Record<string, CategoryStyle & { slug: string }> = {
  'Technology': { slug: 'technology', accent: 'dusk', icon: 'code', descriptor: 'Software, IT and support' },
  'Sales': { slug: 'sales', accent: 'clay', icon: 'chart', descriptor: 'Selling and account roles' },
  'Marketing': { slug: 'marketing', accent: 'dusk', icon: 'megaphone', descriptor: 'Campaigns, content and brand' },
  'Hospitality': { slug: 'hospitality', accent: 'sunrise', icon: 'utensils', descriptor: 'Cafés, hotels, restaurants' },
  'Construction': { slug: 'construction', accent: 'sunrise', icon: 'helmet', descriptor: 'Building, repair and trades' },
  'Finance': { slug: 'finance', accent: 'sunrise', icon: 'coins', descriptor: 'Banking, finance and tax' },
  'Accounting': { slug: 'accounting', accent: 'sunrise', icon: 'calc', descriptor: 'Accounting and finance' },
  'Education': { slug: 'education', accent: 'lagoon', icon: 'book', descriptor: 'Teaching, tutoring and training' },
  'Customer Service': { slug: 'customer-service', accent: 'lagoon', icon: 'headset', descriptor: 'Support and care roles' },
  'Logistics': { slug: 'logistics', accent: 'clay', icon: 'truck', descriptor: 'Riders, couriers and warehousing' },
  'Administration': { slug: 'administration', accent: 'lagoon', icon: 'clipboard', descriptor: 'Office and administration' },
};

export const CATEGORY_NAMES = Object.keys(CATEGORIES);

export function categoryStyle(name: string): CategoryStyle & { slug: string } {
  return CATEGORIES[name] ?? { slug: '', accent: 'lagoon', icon: 'brief', descriptor: '' };
}

export function categorySlug(name: string): string {
  return CATEGORIES[name]?.slug ?? '';
}