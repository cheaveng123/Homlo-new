// constants/jobCategories.ts

export type JobCategorySlug = 'part-time' | 'full-time' | 'weekend' | 'remote';

export interface JobCategoryDef {
  slug: JobCategorySlug;
  label: string;       // short label under the icon
  pageTitle: string;   // centered page title when this category is active
}

// Order matches the live home screen category rail.
//
// The artwork for each category is not declared here — it lives in
// components/shared/jobTypeImage.ts, which the home screen and
// components/jobs/CategoryIconRow.tsx both read, so the home row and the
// category pages always show the same illustrations.
export const JOB_CATEGORIES: JobCategoryDef[] = [
  { slug: 'part-time', label: 'Part-time', pageTitle: 'Part-time Jobs' },
  { slug: 'full-time', label: 'Full-time', pageTitle: 'Full-time Jobs' },
  { slug: 'weekend', label: 'Weekend', pageTitle: 'Weekend Jobs' },
  { slug: 'remote', label: 'Remote', pageTitle: 'Remote Jobs' },
];

export const getCategoryBySlug = (slug: string): JobCategoryDef =>
  JOB_CATEGORIES.find((c) => c.slug === slug) ?? JOB_CATEGORIES[0];
