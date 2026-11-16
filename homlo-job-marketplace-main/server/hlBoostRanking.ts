import { boostMultiplierForPackage } from "./hlPlanRules";

export type FeedCandidate = {
  jobId: string;
  baseScore: number;
  quality?: number | null;
};

export type ActiveBoostLike = {
  jobId: string;
  packageId?: string | null;
  package?: string | null;
  multiplier?: number | null;
  startsAt: Date | number | string;
  endsAt: Date | number | string;
  status?: string | null;
};

export type RankedFeedCandidate = FeedCandidate & {
  effectiveScore: number;
  isBoosted: boolean;
  isSponsoredSlot: boolean;
  boostPackage: string | null;
  boostMultiplier: number;
};

export const BOOST_RANKING = {
  pageSize: 10,
  sponsoredRanks: [2, 6] as readonly number[],
  maxBoostedPerPage: 2,
  qualityFloor: 0.35,
} as const;

type Entry = {
  candidate: FeedCandidate;
  effectiveScore: number;
  isBoosted: boolean;
  boostPackage: string | null;
  boostMultiplier: number;
};

export function resolveActiveBoost(
  boost: ActiveBoostLike,
  now: Date,
): { packageId: string | null; multiplier: number } | null {
  if (boost.status != null && boost.status !== "active") return null;
  const startsAt = toDate(boost.startsAt);
  const endsAt = toDate(boost.endsAt);
  if (!startsAt || !endsAt) return null;
  if (!(startsAt.getTime() <= now.getTime() && now.getTime() < endsAt.getTime())) return null;
  const packageId = boost.packageId ?? boost.package ?? null;
  const explicit = boost.multiplier;
  const multiplier =
    explicit != null && Number.isFinite(explicit) && explicit > 0
      ? explicit
      : boostMultiplierForPackage(packageId);
  return { packageId, multiplier };
}

export function rerankFeedWithBoosts(
  candidates: readonly FeedCandidate[],
  boosts: readonly ActiveBoostLike[],
  now: Date = new Date(),
): RankedFeedCandidate[] {
  const seen = new Set<string>();
  const unique: FeedCandidate[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate.jobId !== "string" || seen.has(candidate.jobId)) continue;
    seen.add(candidate.jobId);
    const baseScore = Number.isFinite(candidate.baseScore) ? candidate.baseScore : 0;
    unique.push({ ...candidate, baseScore });
  }
  if (unique.length === 0) return [];

  const activeByJob = new Map<string, { packageId: string | null; multiplier: number }>();
  for (const boost of boosts) {
    if (!boost || typeof boost.jobId !== "string") continue;
    const active = resolveActiveBoost(boost, now);
    if (active) activeByJob.set(boost.jobId, active);
  }

  const entries: Entry[] = unique.map((candidate) => {
    const boost = activeByJob.get(candidate.jobId) ?? null;
    const quality = candidate.quality;
    const passesQuality =
      quality == null || !Number.isFinite(quality) || quality >= BOOST_RANKING.qualityFloor;
    const isBoosted = boost !== null && passesQuality;
    const multiplier = isBoosted ? boost.multiplier : 1;
    return {
      candidate,
      effectiveScore: candidate.baseScore * multiplier,
      isBoosted,
      boostPackage: isBoosted ? boost.packageId : null,
      boostMultiplier: multiplier,
    };
  });

  const sorted = [...entries].sort(compareEntries);
  const boostedPool = sorted.filter((entry) => entry.isBoosted);
  const used = new Set<string>();
  const ordered: RankedFeedCandidate[] = [];
  let organicCursor = 0;
  let boostCursor = 0;

  for (let pageStart = 0; pageStart < sorted.length; pageStart += BOOST_RANKING.pageSize) {
    const pageLength = Math.min(BOOST_RANKING.pageSize, sorted.length - pageStart);
    const slots = new Map<number, Entry>();
    const sponsoredIds = new Set<string>();
    let boostedInPage = 0;

    for (const rank of BOOST_RANKING.sponsoredRanks) {
      if (boostedInPage >= BOOST_RANKING.maxBoostedPerPage) break;
      const index = rank - 1;
      if (index < 0 || index >= pageLength) continue;
      while (boostCursor < boostedPool.length && used.has(boostedPool[boostCursor].candidate.jobId)) {
        boostCursor += 1;
      }
      if (boostCursor >= boostedPool.length) break;
      const boosted = boostedPool[boostCursor];
      boostCursor += 1;
      used.add(boosted.candidate.jobId);
      slots.set(index, boosted);
      sponsoredIds.add(boosted.candidate.jobId);
      boostedInPage += 1;
    }

    for (let index = 0; index < pageLength; index += 1) {
      if (slots.has(index)) continue;
      let picked: Entry | null = null;
      while (organicCursor < sorted.length) {
        const candidate = sorted[organicCursor];
        organicCursor += 1;
        if (used.has(candidate.candidate.jobId)) continue;
        if (boostedInPage >= BOOST_RANKING.maxBoostedPerPage && candidate.isBoosted) continue;
        picked = candidate;
        break;
      }
      if (!picked) {
        for (const candidate of sorted) {
          if (used.has(candidate.candidate.jobId)) continue;
          if (boostedInPage >= BOOST_RANKING.maxBoostedPerPage && candidate.isBoosted) continue;
          picked = candidate;
          break;
        }
      }
      if (!picked) {
        for (const candidate of sorted) {
          if (used.has(candidate.candidate.jobId)) continue;
          picked = candidate;
          break;
        }
      }
      if (picked) {
        used.add(picked.candidate.jobId);
        slots.set(index, picked);
        if (picked.isBoosted) boostedInPage += 1;
      }
    }

    for (let index = 0; index < pageLength; index += 1) {
      const entry = slots.get(index);
      if (!entry) continue;
      ordered.push(toRanked(entry, sponsoredIds.has(entry.candidate.jobId)));
    }
  }

  for (const entry of sorted) {
    if (used.has(entry.candidate.jobId)) continue;
    ordered.push(toRanked(entry, false));
  }

  return ordered;
}

function compareEntries(a: Entry, b: Entry): number {
  if (b.effectiveScore !== a.effectiveScore) return b.effectiveScore - a.effectiveScore;
  if (b.candidate.baseScore !== a.candidate.baseScore) return b.candidate.baseScore - a.candidate.baseScore;
  return a.candidate.jobId < b.candidate.jobId ? -1 : a.candidate.jobId > b.candidate.jobId ? 1 : 0;
}

function toRanked(entry: Entry, isSponsoredSlot: boolean): RankedFeedCandidate {
  return {
    ...entry.candidate,
    effectiveScore: entry.effectiveScore,
    isBoosted: entry.isBoosted,
    isSponsoredSlot,
    boostPackage: entry.boostPackage,
    boostMultiplier: entry.boostMultiplier,
  };
}

function toDate(value: Date | number | string): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") return Number.isFinite(value) ? new Date(value) : null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
