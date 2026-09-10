// =========================================================
// Deterministic evaluation fixtures (Phase 10).
//
// Builds a rich, deterministic EvalDataset covering the behaviors the ranking
// must exhibit: location preferences, pay competition, schedule compatibility,
// category affinity, behavioral history, employer/job quality (via event and
// outcome signals), sponsorship windows, exploration freshness, cold-start
// workers, an applied/own/expired job (to prove exclusion), and a label window
// of post-evaluation engagements for offline metrics.
//
// Everything is derived from small integer inputs and clock offsets — no RNG —
// so two runs produce byte-identical datasets and identical metric numbers.
// =========================================================

import type { EvalDataset, EvalJob, EvalUser, EvalProfile, EvalEvent, EvalApplication, EvalBoost, EvalReview, EvalReport, EvalMessage } from "./dataset";
import { simulateAggregation } from "./dataset";

export type FixtureSeed = {
  userId: string;
  /** Worker coordinates; null ⇒ location-less worker. */
  location?: { latitude: number; longitude: number } | null;
  /** Hours before the reference instant at which the label window begins. */
  evalAt: Date;
  /** Hours of pre-evaluation history. */
  historyHours?: number;
};

const REF = new Date("2026-08-01T12:00:00.000Z");

function hoursAfter(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

function kmLatOffsetLatitude(km: number, latitude: number): number {
  // ≈ 1° lat ≈ 111 km
  return latitude + km / 111;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * The canonical, fully-populated evaluation fixture. `evalAt` is the evaluation
 * instant (used as the ranking `now`); job/event timestamps are anchored to it,
 * and `seedLocation` is the worker's coordinates. The returned dataset has empty
 * stats maps — call `simulateAggregation` (or the fixtures helper) to produce a
 * consistent, evidence-aligned snapshot before serving it to the pipeline.
 */
export function buildEvalFixture(seed: {
  userId: string;
  evalAt: Date;
  location?: { latitude: number; longitude: number } | null;
}): EvalDataset {
  const userId = seed.userId;
  const EVAL_MS = seed.evalAt.getTime();
  const at = (hours: number): Date => new Date(EVAL_MS + hours * 3_600_000); // hours BEFORE evalAt (negative = past)
  const workerLoc = seed.location ?? { latitude: 40.0, longitude: -74.0 };

  const jobs: EvalJob[] = [];
  const users = new Map<string, EvalUser>();
  const profiles = new Map<string, EvalProfile>();
  const events: EvalEvent[] = [];
  const applications: EvalApplication[] = [];
  const boosts: EvalBoost[] = [];
  const reviews: EvalReview[] = [];
  const reports: EvalReport[] = [];
  const messages: EvalMessage[] = [];

  // Location helpers relative to the worker
  const nearHz = (km: number, lat = workerLoc.latitude): { latitude: number; longitude: number } => ({
    latitude: kmLatOffsetLatitude(km, lat),
    longitude: workerLoc.longitude,
  });

  let jobSeq = 0;
  let eventSeq = 0;
  const ev = (
    eventType: string,
    jobId: string,
    employerId: string,
    occurredAt: Date,
    opts: { userId?: string | null; sessionId?: string | null; dwell?: number } = {},
  ): void => {
    eventSeq += 1;
    events.push({
      id: `evt-${eventSeq}`,
      eventType,
      userId: opts.userId ?? userId,
      jobId,
      employerId,
      sessionId: opts.sessionId ?? null,
      feedPosition: null,
      occurredAt,
      ipHash: `ip-${identifierFor(eventType, jobId, opts)}`,
      dwellTimeMs: opts.dwell ?? null,
      snapshot: null,
    });
  };
  function identifierFor(t: string, j: string, o: { userId?: string | null; sessionId?: string | null }): string {
    return `${t}-${j}-${o.userId ?? ""}-${o.sessionId ?? ""}`;
  }

  // helper: fresh "kick" of events on a job for behavioral affinity
  const click = (jobId: string, employerId: string, hoursAgo: number, dwell?: number): void =>
    ev("click", jobId, employerId, at(hoursAgo), { dwell: dwell ?? 1_000 });
  const impression = (jobId: string, employerId: string, hoursAgo: number): void =>
    ev("impression", jobId, employerId, at(hoursAgo));

  // ---- Employers + jobs ------------------------------------------------------

  const addJob = (
    id: string,
    employerId: string,
    overrides: Partial<EvalJob> = {},
  ): EvalJob => {
    const defaultLocation = nearHz(4 + jobSeq * 2);
    const j: EvalJob = {
      id,
      employerId,
      categoryId: "cat-default",
      title: `Job ${id}`,
      description: `Description ${id}`,
      payAmount: 20,
      payCurrency: "USD",
      payType: "hourly",
      locationText: "Near",
      ...defaultLocation,
      startDate: null,
      startTime: null,
      endTime: null,
      workersNeeded: 2,
      workersHired: 0,
      status: "open",
      deleted: false,
      createdAt: at(-2),
      ...overrides,
    };
    jobSeq += 1;
    jobs.push(j);
    if (!users.has(employerId)) {
      users.set(employerId, { id: employerId, status: "active", createdAt: at(-10_000) });
    }
    if (!profiles.has(employerId)) {
      profiles.set(employerId, {
        userId: employerId,
        fullName: `Employer ${employerId}`,
        latitude: null,
        longitude: null,
        deleted: false,
      });
    }
    return j;
  };

  // Worker profile (the eval subject)
  users.set(userId, { id: userId, status: "active", createdAt: at(-5_000) });
  profiles.set(userId, {
    userId,
    fullName: "Worker",
    latitude: workerLoc.latitude,
    longitude: workerLoc.longitude,
    deleted: false,
  });

  // Category-preferred, near, well-priced, high-quality → the items we WANT at
  // the top for the affinity-carrying worker.
  const catA = "cat-a";
  const catB = "cat-b";
  const empA = "emp-a";
  const empB = "emp-b";

  // cat-a near flawless; ~6 clicks by the worker → strong behavioral affinity
  const best = addJob("job-best-a", empA, {
    categoryId: catA,
    payAmount: 30,
    payType: "hourly",
    latitude: nearHz(1).latitude,
    longitude: nearHz(1).longitude,
    createdAt: at(-0.5),
  });
  for (let i = 0; i < 6; i += 1) click(best.id, empA, 0.1 + i * 0.05, 1_200);
  impression(best.id, empA, 10);
  // A few other workers also engage it → positive job stats (quality evidence).
  for (let i = 0; i < 4; i += 1) {
    ev("click", best.id, empA, at(-1), { userId: `other-w${i}`, sessionId: null });
    ev("click", best.id, empA, at(-1), { userId: `other-w${i}`, sessionId: null });
  }

  // cat-a, slightly farther, lower pay, also clicked → strong #2
  const second = addJob("job-second-a", empA, {
    categoryId: catA,
    payAmount: 25,
    latitude: nearHz(3).latitude,
    longitude: nearHz(3).longitude,
    createdAt: at(-3),
  });
  for (let i = 0; i < 4; i += 1) click(second.id, empA, 2);
  for (let i = 0; i < 2; i += 1) ev("click", second.id, empA, at(-20), { userId: `other-w${i}` });

  // cat-b, near, comparable pay — attractive, diversifies (different employer)
  const catBNear = addJob("job-catb-near", empB, {
    categoryId: catB,
    payAmount: 26,
    latitude: nearHz(2).latitude,
    longitude: nearHz(2).longitude,
    createdAt: at(-4),
  });
  for (let i = 0; i < 3; i += 1) ev("click", catBNear.id, empB, at(-3), { userId: `other-w${i}` });

  // New, unexplored job (for exploration source) — recent + by a brand new employer
  const newEmp = "emp-new";
  users.set(newEmp, { id: newEmp, status: "active", createdAt: at(-0.1) });
  profiles.set(newEmp, { userId: newEmp, fullName: `Employer ${newEmp}`, latitude: null, longitude: null, deleted: false });
  const fresh = addJob("job-fresh-explore", newEmp, {
    categoryId: catA,
    payAmount: 19,
    latitude: nearHz(0.5).latitude,
    longitude: nearHz(0.5).longitude,
    createdAt: at(-0.1),
  });

  // A sponsored job from a genuinely good employer (clear quality evidence so
  // CombinedQuality clears the phase-6 sponsorship floor) with an active boost.
  const sponsored = addJob("job-sponsored", empB, {
    categoryId: catB,
    payAmount: 22,
    latitude: nearHz(6).latitude,
    longitude: nearHz(6).longitude,
    createdAt: at(-6),
  });
  for (let i = 0; i < 2; i += 1) ev("click", sponsored.id, empB, at(-4), { userId: `other-w${i}` });
  // emp-b accumulates a strong, believable employer-quality profile.
  for (let i = 0; i < 20; i += 1) applications.push({ jobId: catBNear.id, workerId: `sp-hired-${i}`, status: "hired" });
  for (let i = 0; i < 15; i += 1) reviews.push({ employerId: empB, rating: i < 13 ? 5 : 2, deleted: false });
  for (let i = 0; i < 10; i += 1) {
    const sender = `sp-w${i}`;
    messages.push({ id: `msg-sp-a${i}`, conversationId: `conv-sp-${i}`, jobId: catBNear.id, employerId: empB, senderId: sender, createdAt: at(-20 - i) });
    messages.push({ id: `msg-sp-b${i}`, conversationId: `conv-sp-${i}`, jobId: catBNear.id, employerId: empB, senderId: empB, createdAt: at(-20 - i + 0.05) });
  }
  boosts.push({
    jobId: sponsored.id,
    employerId: empB,
    status: "active",
    startAt: at(-6),
    expiresAt: at(24),
    package: "boost",
  });

  // A high-quality older job from a trusted employer (employer quality signal)
  const empTrusted = "emp-trusted";
  users.set(empTrusted, { id: empTrusted, status: "active", createdAt: at(-20_000) });
  profiles.set(empTrusted, { userId: empTrusted, fullName: "Employer trusted", latitude: null, longitude: null, deleted: false });
  const trusted = addJob("job-trusted", empTrusted, {
    categoryId: catA,
    payAmount: 24,
    latitude: nearHz(5).latitude,
    longitude: nearHz(5).longitude,
    createdAt: at(-60),
  });
  // Trusted employer signals: completions + positive reviews
  applications.push({ jobId: trusted.id, workerId: `t-w1`, status: "hired" });
  applications.push({ jobId: trusted.id, workerId: `t-w2`, status: "hired" });
  reviews.push({ employerId: empTrusted, rating: 5, deleted: false });
  reviews.push({ employerId: empTrusted, rating: 4, deleted: false });

  // Far job (only reachable via exploration, past hard commute cap)
  const far = addJob("job-far", empTrusted, {
    categoryId: catA,
    latitude: nearHz(200).latitude,
    longitude: nearHz(200).longitude,
    createdAt: at(-10),
  });

  // Applied job → must be excluded for the worker
  const applied = addJob("job-applied", empB, {
    categoryId: catB,
    latitude: nearHz(1).latitude,
    longitude: nearHz(1).longitude,
  });
  applications.push({ jobId: applied.id, workerId: userId, status: "applied" });

  // Own job (employer is the worker themselves) → must be excluded
  const own = addJob("job-own", userId, { latitude: nearHz(1).latitude, longitude: nearHz(1).longitude });

  // Expired (start date in the past) → excluded
  const expired = addJob("job-expired", empTrusted, {
    startDate: "2026-07-01",
    startTime: "09:00:00",
    latitude: nearHz(1).latitude,
    longitude: nearHz(1).longitude,
  });

  // Filled → excluded
  const filled = addJob("job-filled", empTrusted, { workersHired: 2, workersNeeded: 2 });

  // Deleted → excluded
  addJob("job-deleted", empTrusted, { deleted: true });

  // ---- Enough other jobs so the pool is meaningfully sized -------------------
  // Spread across categories/employers to exercise MMR + exploration.
  for (let i = 0; i < 14; i += 1) {
    const categoryId = i % 3 === 0 ? catA : catB;
    const employerId = `emp-bulk-${i % 4}`;
    addJob(`job-bulk-${i}`, employerId, {
      categoryId,
      payAmount: 15 + (i % 10),
      latitude: nearHz(8 + (i % 12)).latitude,
      longitude: nearHz(8 + (i % 12)).longitude,
      createdAt: at(-5 - i),
    });
  }

  // ---- Worker ↔ employer conversation (response-rate evidence) ---------------
  const convWorker = "conv-1";
  messages.push({
    id: "msg-1",
    conversationId: convWorker,
    jobId: best.id,
    employerId: empA,
    senderId: userId,
    createdAt: at(-2),
  });
  messages.push({
    id: "msg-2",
    conversationId: convWorker,
    jobId: best.id,
    employerId: empA,
    senderId: empA,
    createdAt: at(-1.9),
  });
  messages.push({
    id: "msg-3",
    conversationId: convWorker,
    jobId: best.id,
    employerId: empA,
    senderId: userId,
    createdAt: at(-1.5),
  });

  // ---- Reports (trust signal; must never act as a preference) ----------------
  reports.push({ targetType: "job", targetId: far.id, status: "resolved" });

  // ---- Post-eval label window (ground truth, truncated from evidence) -------
  // The evaluation serves the pipeline a snapshot clipped at `evalAt`; these
  // events occur AFTER evalAt and therefore never influence the ranking. They
  // are the held-out relevance labels used for offline NDCG/MRR/etc. A click is
  // the canonical "relevant" preference; the desired jobs are the ones the
  // pipeline should have ranked high (best, second, catBNear, trusted).
  const label = (jobId: string, employerId: string, hoursAfterEval: number): void =>
    ev("click", jobId, employerId, at(hoursAfterEval), { dwell: 950 });
  label(best.id, empA, 1);
  label(best.id, empA, 2);
  label(second.id, empA, 1.5);
  label(catBNear.id, empB, 3);
  label(trusted.id, empTrusted, 4);
  // One appealing peripheral job (catA via a bulk employer) also gets a label,
  // but NOT one of the deliberately noisy/irrelevant items.
  const labelLink = jobs.find((j) => j.id.startsWith("job-bulk-") && j.categoryId === catA);
  if (labelLink) label(labelLink.id, labelLink.employerId, 5);

  const dataset: EvalDataset = {
    jobs,
    users: [...users.values()],
    profiles: [...profiles.values()],
    events,
    applications,
    boosts,
    reviews,
    reports,
    messages,
    jobQuality: new Map(),
    employerQuality: new Map(),
  };

  return dataset;
}

/**
 * Builds the fixture and runs the phase 8 aggregation simulation so every stats
 * row is present and consistent with the evidence. The returned dataset is the
 * one the evaluation actually serves to the fixed `now` pipeline.
 */
export function buildEvaluableFixture(seed: Parameters<typeof buildEvalFixture>[0]): EvalDataset {
  const dataset = buildEvalFixture(seed);
  return simulateAggregation(dataset);
}