/**
 * Fuzzy location/search matching helpers.
 *
 * These helpers make searches tolerant of small typos (missing / extra /
 * swapped letters) by correcting an input to the closest known Cambodian
 * location when confidence is high, while leaving low-confidence input
 * untouched so we never guess wrongly.
 */

export type LocationEntry = {
  /** Canonical, correctly-spelled location that should be sent to the search backend. */
  name: string;
  /** Acceptable aliases (alternate spellings, Khmer names, abbreviations). */
  aliases?: string[];
};

/**
 * Canonical Cambodian locations used for fuzzy correction. This is a curated
 * finite list, so correction is cheap and never runs an expensive comparison
 * against every job on every keystroke.
 */
export const knownLocations: LocationEntry[] = [
  { name: "Phnom Penh", aliases: ["phnom penh", "phnum penh", "phnompenh", "ភ្នំពេញ", "pp", "pn penh"] },
  { name: "Daun Penh", aliases: ["daun penh", "doun penh", "downtown", "dom penh"] },
  { name: "Chamkarmon", aliases: ["chamkarmon", "chamkar mon", "chamkamon", "chamkarmorn"] },
  { name: "Tuol Kork", aliases: ["tuol kork", "toul kork", "tuol kork", "toulkork", "toul kok"] },
  { name: "Boeung Keng Kang", aliases: ["boeung keng kang", "bkk", "bkk1", "bkk 1", "boeung keng kang 1", "bkk2", "bkk 2"] },
  { name: "Boeung Keng Kang 1", aliases: ["bkk1", "bkk 1"] },
  { name: "Sen Sok", aliases: ["sen sok", "sensok"] },
  { name: "Russey Keo", aliases: ["russey keo", "roussey keo", "ruessei keo", "russeykeo"] },
  { name: "Chroy Changvar", aliases: ["chroy changvar", "chruoy changvar", "chroy changvar"] },
  { name: "Tuol Tom Poung", aliases: ["tuol tom poung", "toul tom pong", "ttp", "tuol tom pong"] },
  { name: "Mean Chey", aliases: ["mean chey", "meanchey", "mean chhey"] },
  { name: "Dangkao", aliases: ["dangkao", "dang kor", "dangkor"] },
  { name: "Porsenchey", aliases: ["porsenchey", "por sen chey", "porsen chey", "por senchey"] },
  { name: "Prek Pnov", aliases: ["prek pnov", "prek pnouv"] },
  { name: "Khan Kamboul", aliases: ["kamboul", "khan kamboul"] },
  { name: "Kampong Cham", aliases: ["kampong cham", "kompong cham", "krong kampong cham"] },
  { name: "Kampong Speu", aliases: ["kampong speu", "kompong speu"] },
  { name: "Kampong Thom", aliases: ["kampong thom", "kompong thom"] },
  { name: "Kampot", aliases: ["kampot", "កំពត"] },
  { name: "Kandal", aliases: ["kandal", "kandal province"] },
  { name: "Kep", aliases: ["kep", "កែប"] },
  { name: "Kratie", aliases: ["kratie", "kracheh", "ក្រចេះ"] },
  { name: "Mondulkiri", aliases: ["mondulkiri", "mondol kiri", "មណ្ឌលគិរី"] },
  { name: "Phnom Penh Riverside", aliases: ["riverside", "phnom penh riverside"] },
  { name: "Pailin", aliases: ["pailin", "ប៉ៃលិន"] },
  { name: "Phsar Depo", aliases: ["phsar depo", "psar depo", "phsar deum thkov"] },
  { name: "Poipet", aliases: ["poipet", "ប៉ោយប៉ែត"] },
  { name: "Preah Sihanouk", aliases: ["sihanoukville", "sihanouk ville", "preah sihanouk", "kampong som", "sihanouk", "ព្រះសីហនុ"] },
  { name: "Prey Veng", aliases: ["prey veng", "ព្រៃវែង"] },
  { name: "Pursat", aliases: ["pursat", "ពោធិ៍សាត់"] },
  { name: "Ratanakiri", aliases: ["ratanakiri", "ratanak kiri", "រតនគិរី"] },
  { name: "Siem Reap", aliases: ["siem reap", "សៀមរាប"] },
  { name: "Stung Treng", aliases: ["stung treng", "ស្ទឹងត្រែង"] },
  { name: "Svay Rieng", aliases: ["svay rieng", "ស្វាយរៀង"] },
  { name: "Takeo", aliases: ["takeo", "តាកែវ"] },
  { name: "Battambang", aliases: ["battambang", "batdambang", "បាត់ដំបង"] },
  { name: "Banteay Meanchey", aliases: ["banteay meanchey", "បន្ទាយមានជ័យ"] },
  { name: "Koh Kong", aliases: ["koh kong", "កោះកុង"] },
  { name: "Oddar Meanchey", aliases: ["oddar meanchey", "ឧត្តរមានជ័យ"] },
  { name: "Tbong Khmum", aliases: ["tbong khmum", "ត្បូងឃ្មុំ"] },
];

type Match = { location: string; score: number };

/**
 * Damerau–Levenshtein distance counting adjacent transpositions as a single
 * edit. This is important for search typos that swap two letters in place
 * (e.g. "pehn" vs "penh", "phonm" vs "phnom").
 */
function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  // Optimal String Alignment variant: standard DP with adjacent transposition cost.
  const d: number[][] = [];
  for (let i = 0; i <= m; i += 1) {
    d[i] = new Array<number>(n + 1);
    d[i][0] = i;
  }
  for (let j = 0; j <= n; j += 1) d[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

/** Similarity between two single tokens in [0,1] (1 = identical). */
function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = damerauLevenshtein(a, b);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Normalize a search input: lowercase, trim, collapse repeated whitespace and
 * strip punctuation that shouldn't participate in matching.
 */
export function normalizeQuery(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensOf(input: string): string[] {
  return normalizeQuery(input).split(" ").filter(Boolean);
}

/**
 * Match an input token sequence against a candidate token sequence allowing
 * per-token fuzzy similarity. Returns a combined score in [0,1].
 *
 * The score is the sum of the best-matched pair similarities divided by the
 * longer of the two token counts, so extra input tokens and missing reference
 * tokens both reduce the score (a short alias can't dominate a longer input).
 *
 * This lets "Phnom Pehn" match "Phnom Penh" (one swapped letter) while still
 * penalizing queries that merely contain a location word.
 */
function matchTokenSequence(input: string[], candidate: string[]): number {
  if (candidate.length === 0) return input.length === 0 ? 1 : 0;
  const used = new Array<boolean>(candidate.length).fill(false);
  let similaritySum = 0;
  for (const token of input) {
    let bestIdx = -1;
    let bestScore = 0;
    for (let c = 0; c < candidate.length; c += 1) {
      if (used[c]) continue;
      const s = tokenSimilarity(token, candidate[c]);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = c;
      }
    }
    if (bestIdx >= 0 && bestScore >= 0.7) {
      used[bestIdx] = true;
      similaritySum += bestScore;
    }
  }
  return similaritySum / Math.max(input.length, candidate.length);
}

/**
 * Find the closest known location for a search input.
 * Returns the canonical location when confidence is high; otherwise null.
 *
 * Rules:
 *  - An exact (normalized) match of the full input to a reference string always
 *    returns the canonical location without a fuzzy correction.
 *  - A fuzzy match is accepted only when its score is clearly above a threshold
 *    and meaningfully better than the next-best candidate (no ambiguity).
 */
export function bestLocationMatch(input: string):
  | { location: string; score: number; exact: boolean }
  | null {
  const normalized = normalizeQuery(input);
  if (!normalized) return null;

  const inputTokens = tokensOf(normalized);
  if (inputTokens.length === 0) return null;

  const scored: (Match & { exactRef: boolean })[] = knownLocations.flatMap((entry) => {
    const refs = [entry.name, ...(entry.aliases ?? [])];
    const matches = refs.map((ref) => {
      const refTokens = tokensOf(ref);
      return {
        location: entry.name,
        score: matchTokenSequence(inputTokens, refTokens),
        exactRef: refTokens.length > 0 && refTokens.join(" ") === inputTokens.join(" "),
      };
    });
    // Report the best reference match for this entry.
    const bestRef = matches.reduce((a, b) => (b.score > a.score ? b : a), matches[0]);
    return [bestRef];
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score === 0) return null;

  // Exact match: use the canonical location verbatim (no fuzzy correction).
  if (best.exactRef) {
    return { location: best.location, score: best.score, exact: true };
  }

  // Confidence threshold for accepting a fuzzy correction.
  const threshold = 0.78;
  if (best.score < threshold) return null;

  // Reject ambiguous matches: the best must be clearly better than the second.
  const second = scored[1];
  if (second && best.score - second.score < 0.08) return null;

  return { location: best.location, score: best.score, exact: false };
}

export type ResolvedSearch = {
  /** Original text the user typed (keep for display & history). */
  original: string;
  /** The value that should be sent to the search backend (may be corrected). */
  corrected: string;
  /** Whether a fuzzy correction was applied. */
  correctedFuzzy: boolean;
};

/**
 * Resolve typos in a single search field (keyword or location).
 *
 * Corrects only when the input closely matches a known location. Low-confidence
 * input is returned unchanged so the normal search still runs.
 */
export function resolveSearchTypos(input: string): ResolvedSearch {
  const trimmed = input.trim();
  if (!trimmed) return { original: trimmed, corrected: trimmed, correctedFuzzy: false };

  const match = bestLocationMatch(trimmed);
  if (match) {
    const normalizedInput = normalizeQuery(trimmed);
    const detectedChange = normalizeQuery(match.location) !== normalizedInput;
    return {
      original: trimmed,
      corrected: match.location,
      // Only flag a "correction" when the resolved value differs from input
      // (fuzzy typo fix, or an alias/Khmer name normalized to canonical English).
      correctedFuzzy: detectedChange,
    };
  }
  return { original: trimmed, corrected: trimmed, correctedFuzzy: false };
}
