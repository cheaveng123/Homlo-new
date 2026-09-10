import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SpecializedField } from "@/lib/specialized-fields";

/**
 * Client-side rotation for the specialized homepage sections.
 *
 * Rules honored here:
 *   • A selection is chosen ONCE per page session (module-scoped seed), so
 *     re-renders, tab switches and React StrictMode double-mounts never reshuffle
 *     the feed — no random is consulted on render.
 *   • A genuine reload re-initializes the module, which produces a fresh seed
 *     and a different (but deterministic) arrangement among the eligible fields.
 *   • The last shown arrangement is persisted, and the next selection avoids
 *     repeating it when an alternative exists.
 *   • Fields with no published jobs are filtered server-side before this runs,
 *     so every returned field renders a real section.
 */

const LAST_ARRANGEMENT_KEY = "homlo.homeFeed.specializedArrangement.v1";

/** Number of specialized sections the homepage rotates through. */
export const HOME_FEED_SPECIALIZED_COUNT = 3;

let sessionSeedValue: string | null = null;
function sessionSeed(): string {
  if (!sessionSeedValue) {
    sessionSeedValue = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
  return sessionSeedValue;
}

let cachedKey: string | null = null;
let cachedSelection: SpecializedField[] | null = null;

async function loadLastArrangement(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(LAST_ARRANGEMENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

async function saveLastArrangement(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_ARRANGEMENT_KEY, JSON.stringify(ids));
  } catch {
    // Persistence is best-effort; rotation still works without it.
  }
}

/** All ordered arrangements (permutations) of k elements taken from `ids`. */
function permutations(ids: string[], k: number): string[][] {
  const results: string[][] = [];
  const used = new Array(ids.length).fill(false);
  const build = (current: string[]) => {
    if (current.length === k) {
      results.push([...current]);
      return;
    }
    for (let index = 0; index < ids.length; index += 1) {
      if (used[index]) continue;
      used[index] = true;
      current.push(ids[index]);
      build(current);
      current.pop();
      used[index] = false;
    }
  };
  build([]);
  return results;
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/** Small deterministic string hash (djb2) so a seed maps to a stable choice. */
function hashString(value: string): number {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return Math.abs(hash >>> 0);
}

export async function pickSpecializedFields(
  available: readonly SpecializedField[],
  count: number,
): Promise<SpecializedField[]> {
  const keep = Math.min(count, available.length);
  if (available.length === 0 || keep < 1) return [];

  const ids = available.map((field) => field.id);
  const key = `${[...ids].sort().join(",")}:${keep}`;
  if (cachedKey === key && cachedSelection) return cachedSelection;

  const lastUsed = await loadLastArrangement();
  const all = permutations(ids, keep);
  const different = all.filter((candidate) => !sameOrder(candidate, lastUsed));
  const pool = different.length > 0 ? different : all;
  const chosen = pool[hashString(sessionSeed()) % pool.length];

  const chosenSet = new Set(chosen);
  const selection = available.filter((field) => chosenSet.has(field.id))
    .sort((a, b) => chosen.indexOf(a.id) - chosen.indexOf(b.id));

  cachedKey = key;
  cachedSelection = selection;
  void saveLastArrangement(chosen);
  return selection;
}