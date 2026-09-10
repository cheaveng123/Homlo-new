export const FALLBACK_JOB_IMAGE =
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=600&q=80";

/**
 * Resolves the image a job card should render from an optional banner value.
 * Banner values coming from the API can be an uploaded data URI, a media
 * gallery key, or an empty/whitespace string; anything empty falls back to the
 * brand default. Single source of truth so Home live jobs, search results, the
 * recommended feed and employer listings all agree on the image.
 */
export function resolveJobImage(banner?: string | null): string {
  const value = banner?.trim();
  return value ? value : FALLBACK_JOB_IMAGE;
}

/** True when a banner value is worth rendering as an image source. */
export function hasBannerImage(banner?: string | null): boolean {
  return Boolean(banner?.trim());
}