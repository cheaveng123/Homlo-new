/**
 * Pure layout math for the home-feed carousel rows. Kept out of the component
 * so the landing/loop behaviour is unit-testable without a UI runtime.
 */

/** Distance between consecutive card landing positions. */
export function carouselStep(cardWidth: number, cardGap: number): number {
  return cardWidth + cardGap;
}

/**
 * Scroll offset that lands card `index` at rest with its left edge exactly at
 * the content container's leading `gutter` — the same left space the first
 * card has at scroll 0 — so a landing can never rest a card flush against a
 * device edge. (`index * step`; the container's own leading padding supplies
 * the gutter.)
 */
export function cardOffset(index: number, cardWidth: number, cardGap: number, gutter: number): number {
  return index * carouselStep(cardWidth, cardGap);
}

/** Furthest the row can scroll before its last content edge hits the viewport. */
export function maxScrollOffset(contentWidth: number, viewportWidth: number): number {
  return Math.max(0, contentWidth - viewportWidth);
}

/** Clamps a landing target into the row's scrollable range. */
export function clampScrollTarget(x: number, contentWidth: number, viewportWidth: number): number {
  return Math.max(0, Math.min(x, maxScrollOffset(contentWidth, viewportWidth)));
}

/**
 * 0-based card after `currentIndex`. When the last card is reached it wraps
 * back to the first card so the row loops forever.
 */
export function nextCarouselIndex(currentIndex: number, count: number): number {
  if (count <= 1) return 0;
  return currentIndex + 1 >= count ? 0 : currentIndex + 1;
}

/** True when `currentIndex` is the last card and the loop must rewind to card 0. */
export function isCarouselLoopPoint(currentIndex: number, count: number): boolean {
  return count > 1 && currentIndex + 1 >= count;
}

// Auto-scroll cadence for the Recommended row. Kept here (pure, no UI
// runtime) so the component and the tests agree on the exact pacing, and so
// the driver never invents its own numbers.
export const CAROUSEL_INTERVAL_MS = 5000; // dwell between advances — one card every 5s
export const CAROUSEL_GLIDE_MS = 500; // eased single-card advance (~450–600ms)
export const CAROUSEL_REWIND_MS = 900; // eased last-card → first-card loop glide
export const CAROUSEL_IDLE_RESUME_MS = 3500; // idle wait after user input before resuming