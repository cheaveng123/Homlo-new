/**
 * The four custom job-type illustrations shown on the home screen in the row
 * directly under "Don't know where to start?" (the `CATEGORIES` list in
 * components/home/HomeScreen.tsx).
 *
 * This module is the single source of truth for those image files. The home
 * screen, the job-detail "Job type" stat and the category pages' icon row all
 * read from here, so they render the exact same artwork rather than three
 * lookalikes that can drift.
 *
 * `image` is the raw `require()` handle — a number, which is the bundled-asset
 * form React Native's `Image` `source` prop accepts.
 *
 * Not importable outside Metro (the `require()` of a PNG is invalid JS to a node
 * test runner). The key-mapping logic lives in ./jobTypeImageImageKey so it
 * stays testable — see ./jobTypeImageKey.ts.
 */

import { jobTypeImageKey } from './jobTypeImageKey';

export { jobTypeImageKey };

export type JobTypeImageEntry = {
  key: string;
  label: string;
  image: number;
  /**
   * Intrinsic width / height of `image`, read from the PNG headers. Static so
   * the box is correct on the first frame, and so a box can be fitted to the
   * artwork's real proportions instead of a square that letterboxes it.
   */
  aspectRatio: number;
};

export const JOB_TYPE_IMAGES: readonly JobTypeImageEntry[] = [
  { key: 'part-time', label: 'Part-time', image: require('../../assets/images/parttimenew.png'), aspectRatio: 1.29 },
  { key: 'full-time', label: 'Full-time', image: require('../../assets/images/fulltimenew.png'), aspectRatio: 1.392 },
  { key: 'remote', label: 'Remote', image: require('../../assets/images/remotenew.png'), aspectRatio: 1.101 },
  { key: 'weekends', label: 'Weekends', image: require('../../assets/images/weekendnew.png'), aspectRatio: 1.483 },
];

/**
 * Resolves a job-type label to its home-screen illustration, or null for a type
 * with no dedicated artwork (Contract, Internship, Temporary).
 */
export function jobTypeImage(label: string | null | undefined): number | null {
  const key = jobTypeImageKey(label);
  if (!key) return null;
  return JOB_TYPE_IMAGES.find((entry) => entry.key === key)?.image ?? null;
}
