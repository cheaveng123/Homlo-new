// =========================================================
// Wilson lower-bound smoothing (application-level, reusable).
//
// Used by the scoring service (phase 4) for any observed-rate fallback and by
// phase 6 when the scheduled quality aggregation populates
// employer_quality_stats / job_quality_stats. Do NOT duplicate this math
// anywhere else in the ranking pipeline.
//
// Standard Wilson lower confidence bound for a proportion:
//
//   phat   = successes / n
//   center = phat + z^2 / (2n)
//   margin = z * sqrt((phat*(1-phat) + z^2/(4n)) / n)
//   bound  = (center - margin) / (1 + z^2 / n)
//
// Safety: invalid inputs are clamped, n = 0 returns the configured neutral
// prior (never a divide-by-zero), and the result is bounded to [0, 1].
// =========================================================

import { rankingConfig } from "../config/rankingConfig";

export type WilsonOptions = {
  /** Standard-normal z for the confidence level. Defaults to rankingConfig.quality.wilsonZ. */
  z?: number;
  /** Value returned when trials = 0. Defaults to rankingConfig.quality.neutralPrior. */
  neutralPrior?: number;
};

export function wilsonLowerBound(successes: number, trials: number, options?: WilsonOptions): number {
  const z = finiteOrDefault(options?.z, rankingConfig.quality.wilsonZ);
  const neutralPrior = finiteOrDefault(options?.neutralPrior, rankingConfig.quality.neutralPrior);

  const s = toFiniteNonNegative(successes);
  const n = toFiniteNonNegative(trials);

  if (n === 0) return clamp01(neutralPrior);
  if (s > n) return 1; // inconsistent input: treat as fully successful, not NaN

  const phat = s / n;
  const zSq = z * z;
  const denom = 1 + zSq / n;
  const center = phat + zSq / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat) + zSq / (4 * n)) / n);

  return clamp01((center - margin) / denom);
}

/** Clamp a value into [0, 1], coercing NaN to fallback (default 0). */
export function clamp01(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function toFiniteNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}