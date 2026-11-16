// Central, versioned boost config. No hardcoded numbers anywhere else.
// rankMultiplier is applied to the final ranking score and is capped at MAX_BOOST_MULTIPLIER.
export const BOOST_CONFIG_VERSION = 1;
export const MAX_BOOST_MULTIPLIER = 1.15;

export type BoostPlanKey = 'starter' | 'local' | 'standard' | 'urgent' | 'strong' | 'maximum';

export const BOOST_PLANS: Record<BoostPlanKey, { days: number; rankMultiplier: number }> = {
  starter: { days: 3, rankMultiplier: 1.03 },
  local: { days: 5, rankMultiplier: 1.05 },
  standard: { days: 7, rankMultiplier: 1.08 },
  urgent: { days: 3, rankMultiplier: 1.1 },
  strong: { days: 7, rankMultiplier: 1.12 },
  maximum: { days: 14, rankMultiplier: 1.15 },
};

export function isBoostPlanKey(value: unknown): value is BoostPlanKey {
  return typeof value === 'string' && value in BOOST_PLANS;
}

/** Quality-gated: a low-quality job gets less (or none) of its boost. quality01 is 0..1. */
export function applyBoost(score: number, rankMultiplier: number, quality01 = 1): number {
  const m = Math.min(Math.max(rankMultiplier, 1), MAX_BOOST_MULTIPLIER);
  const q = Math.min(Math.max(quality01, 0), 1);
  return score * (1 + (m - 1) * q);
}
