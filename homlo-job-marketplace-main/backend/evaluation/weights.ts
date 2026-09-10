// =========================================================
// Evaluation label weights (Phase 10).
//
// The graded relevance used for label extraction mirrors the pipeline's
// behavioral event weights (rankingConfig.behavioral.eventWeights) so that
// "what counts as a strong signal" agrees between the production affinity
// component and the evaluation labels. Read-only: evaluation never mutates the
// production config.
// =========================================================

import { rankingConfig } from "../config/rankingConfig";

export type EventWeightMap = Readonly<Record<string, number>>;

/** The event→strength hierarchy exactly as Phase 4 uses it for behavioral affinity. */
export function behavioralEventWeights(): EventWeightMap {
  return { ...rankingConfig.behavioral.eventWeights };
}

/** Events treated as near-neutral exposure (weakest preference signal). */
export const NEUTRAL_EVENTS = ["impression", "report"] as const;

/** Events treated as explicit negatives (hide / not_interested / withdrawn). */
export function strongNegatives(): string[] {
  return Object.entries(rankingConfig.behavioral.eventWeights)
    .filter(([, weight]) => weight < 0)
    .map(([event]) => event);
}