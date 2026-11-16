import { describe, expect, it } from "vitest";

import {
  CAROUSEL_GLIDE_MS,
  CAROUSEL_IDLE_RESUME_MS,
  CAROUSEL_INTERVAL_MS,
  CAROUSEL_REWIND_MS,
  cardOffset,
  carouselStep,
  clampScrollTarget,
  isCarouselLoopPoint,
  maxScrollOffset,
  nextCarouselIndex,
} from "../lib/carousel-math";

describe("carousel landing/loop math", () => {
  it("computes the step and per-card landing offsets (card i rests at the gutter, past i steps)", () => {
    expect(carouselStep(200, 12)).toBe(212);
    // Resting at offset `index * step` puts that card's left edge exactly at the
    // container's leading gutter — never flush against a device edge.
    expect(cardOffset(0, 200, 12, 20)).toBe(0);
    expect(cardOffset(1, 200, 12, 20)).toBe(212);
    expect(cardOffset(3, 200, 12, 20)).toBe(3 * 212);
  });

  it("clamps targets into the scrollable range", () => {
    // 4 cards @ 200px + gaps + 20px gutters on a 375px viewport.
    const contentWidth = 20 + 4 * 200 + 3 * 12 + 20; // 876
    const viewportWidth = 375;
    expect(maxScrollOffset(contentWidth, viewportWidth)).toBe(501);
    expect(clampScrollTarget(cardOffset(0, 200, 12, 20), contentWidth, viewportWidth)).toBe(0);
    expect(clampScrollTarget(cardOffset(2, 200, 12, 20), contentWidth, viewportWidth)).toBe(424);
    // The last card cannot land at the left edge — it lands flush right.
    expect(clampScrollTarget(cardOffset(3, 200, 12, 20), contentWidth, viewportWidth)).toBe(501);
    expect(clampScrollTarget(-40, contentWidth, viewportWidth)).toBe(0);
    expect(clampScrollTarget(9999, contentWidth, viewportWidth)).toBe(501);
  });

  it("never overclamps when content fits entirely in the viewport", () => {
    expect(maxScrollOffset(300, 375)).toBe(0);
    expect(clampScrollTarget(120, 300, 375)).toBe(0);
  });

  it("advances one card at a time and wraps past the last card", () => {
    expect(nextCarouselIndex(0, 4)).toBe(1);
    expect(nextCarouselIndex(2, 4)).toBe(3);
    expect(nextCarouselIndex(3, 4)).toBe(0);
  });

  it("recognises the last card as the loop point", () => {
    expect(isCarouselLoopPoint(0, 4)).toBe(false);
    expect(isCarouselLoopPoint(2, 4)).toBe(false);
    expect(isCarouselLoopPoint(3, 4)).toBe(true);
    expect(isCarouselLoopPoint(0, 1)).toBe(false);
  });

  it("stays pinned to card 0 for a single-item row", () => {
    expect(nextCarouselIndex(0, 1)).toBe(0);
    expect(isCarouselLoopPoint(0, 1)).toBe(false);
  });

  it("keeps the full gutter at rest — no card ever touches a device edge", () => {
    // Same @ 200px cards setup as the other tests, on a 375px viewport.
    const cardWidth = 200;
    const cardGap = 12;
    const gutter = 20;
    const viewportWidth = 375;

    // The resting offset the carousel actually lands on for card `index`:
    // its landing target clamped into the row's scrollable range.
    const landingFor = (contentWidth: number, index: number) =>
      clampScrollTarget(cardOffset(index, cardWidth, cardGap, gutter), contentWidth, viewportWidth);

    // Every rest position keeps at least `gutter` of bare screen to the LEFT of
    // the current card, and the end-of-row rest keeps exactly `gutter` to the
    // RIGHT — the same padding a card has at rest in any manual row.
    for (const count of [3, 4, 6]) {
      const contentWidth = 2 * gutter + count * cardWidth + (count - 1) * cardGap;
      for (let index = 0; index < count; index += 1) {
        const rest = landingFor(contentWidth, index);
        // Card `index` lives at container-x `gutter + cardOffset(...)`; how far
        // its left edge sits from the viewport's left edge is `containerX - rest`.
        const leftClearance = gutter + cardOffset(index, cardWidth, cardGap, gutter) - rest;
        expect(leftClearance).toBeGreaterThanOrEqual(gutter);
      }
      // The last card is clamped to max scroll: the content's trailing padding
      // hugs the viewport's right edge, leaving exactly `gutter` of clearance.
      const lastRest = landingFor(contentWidth, count - 1);
      const lastLeftClearance =
        gutter + cardOffset(count - 1, cardWidth, cardGap, gutter) - lastRest;
      expect(viewportWidth - (lastLeftClearance + cardWidth)).toBe(gutter);
    }

    // A row that fits the viewport may not scroll at all, so the first card
    // stays put with its `gutter` left padding intact — auto-scroll no-ops.
    const fittingContentWidth = 2 * gutter + 2 * cardWidth + 1 * cardGap; // 452
    expect(maxScrollOffset(fittingContentWidth, 1000)).toBe(0);
    expect(landingFor(fittingContentWidth, 0)).toBe(0);
  });

  it("meets the auto-scroll pacing spec (one card every 5s, 450–600ms eased glide)", () => {
    expect(CAROUSEL_INTERVAL_MS).toBe(5000);
    expect(CAROUSEL_GLIDE_MS).toBeGreaterThanOrEqual(450);
    expect(CAROUSEL_GLIDE_MS).toBeLessThanOrEqual(600);
    expect(CAROUSEL_REWIND_MS).toBeGreaterThanOrEqual(450);
  });

  it("waits a 3–4s idle stretch after user input before auto-scroll resumes", () => {
    expect(CAROUSEL_IDLE_RESUME_MS).toBeGreaterThanOrEqual(3000);
    expect(CAROUSEL_IDLE_RESUME_MS).toBeLessThanOrEqual(4000);
  });
});