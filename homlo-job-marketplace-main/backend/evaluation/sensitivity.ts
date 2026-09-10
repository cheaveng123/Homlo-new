// =========================================================
// Sensitivity analysis (Phase 10).
//
// `rankingConfig` is a runtime-mutable plain object (the `as const` is
// compile-time only), so an analysis can override individual tunables, run the
// real pipeline, and restore the previous values — synchronously — inside a
// scoped `withConfigOverride` helper. Because every ranking service calls
// `validate*Config()` per `scoreCandidates`/MMR/phase-6 call, an override must
// keep the config internally consistent (weights sum to 1, etc.); the helper
// enforces nothing about validity itself, but the pipeline will fail fast if an
// override is invalid, which is a desired test outcome.
//
// Restoration is guaranteed even when the pipeline throws: overrides are
// reverted in a `finally` block, and nesting is supported via a stack so
// sibling analyses compose safely.
// =========================================================

import { rankingConfig, type RankingConfig } from "../config/rankingConfig";

export type Override = (config: RankingConfig) => void;

/** A mutable, literal-widened deep-copy of the runtime config tree. */
export type MutableConfig = Jsonified<RankingConfig>;

type Widen<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : T;

/** Recursively remove readonly and widen `as const` literals to mutable primitives. */
export type Jsonified<T> = {
  -readonly [K in keyof T]: T[K] extends object ? Jsonified<T[K]> : Widen<T[K]>;
};

const stack: { restore: () => void }[] = [];

/** Snapshot the current config values so they can be restored later. */
export function snapshotConfig(): MutableConfig {
  return deepCloneConfig(rankingConfig);
}

/** Deep-clone the runtime config as a mutable plain object. */
export function deepCloneConfig(config: RankingConfig): MutableConfig {
  return JSON.parse(JSON.stringify(config)) as MutableConfig;
}

/**
 * Temporarily set one (or more) scalar config fields, run `work`, and restore the
 * previous values regardless of success. `path` is a dot path like
 * `"baseRelevanceWeights.location"`; `value` is the new scalar.
 */
export async function withConfigOverride<T>(
  path: string,
  value: number | string | boolean,
  work: () => Promise<T>,
): Promise<T> {
  const before = snapshotConfig();
  stack.push({ restore: () => restoreInto(rankingConfig, before) });
  try {
    setByPath(rankingConfig, path, value);
    return await work();
  } finally {
    const last = stack.pop();
    last?.restore();
  }
}

/** Synchronous variant for pure in-process analyses. */
export function withConfigOverrideSync<T>(path: string, value: number | string | boolean, work: () => T): T {
  const before = snapshotConfig();
  stack.push({ restore: () => restoreInto(rankingConfig, before) });
  try {
    setByPath(rankingConfig, path, value);
    return work();
  } finally {
    const last = stack.pop();
    last?.restore();
  }
}

/** Set a scalar at a dot path like `a.b.c`. */
function setByPath(config: RankingConfig, path: string, value: number | string | boolean): void {
  const parts = path.split(".");
  let cursor: unknown = config;
  for (let i = 0; i < parts.length - 1; i += 1) {
    cursor = (cursor as Record<string, unknown>)[parts[i]];
    if (cursor == null) throw new Error(`withConfigOverride: unknown path "${path}" (missing segment "${parts[i]}")`);
  }
  (cursor as Record<string, unknown>)[parts[parts.length - 1]] = value;
}

function restoreInto(target: RankingConfig, snapshot: MutableConfig): void {
  const current = target as Record<string, unknown>;
  const saved = snapshot as unknown as Record<string, unknown>;
  for (const key of Object.keys(current)) {
    if (saved[key] !== undefined) current[key] = saved[key];
  }
}