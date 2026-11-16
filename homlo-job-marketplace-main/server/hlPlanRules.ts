export type PlanId = "free" | "pro" | "enterprise";
export type SubscriptionStatus = "active" | "past_due" | "canceled";

export type PlanLimits = {
  activeJobs: number | null;
  postsPerMonth: number | null;
};

export type BoostPackageId = "starter" | "local" | "standard" | "urgent" | "strong" | "maximum";

export type BoostPackage = {
  id: BoostPackageId;
  name: string;
  priceCents: number;
  proPriceCents: number;
  durationDays: number;
  multiplier: number;
};

export type BoostPackageView = {
  id: BoostPackageId;
  name: string;
  priceCents: number;
  listPriceCents: number;
  durationDays: number;
  multiplier: number;
  free: boolean;
};

export type PlanUsage = {
  activeJobs: number;
  postsThisPeriod: number;
  activeApplications: number;
};

export type PlanSnapshot = {
  plan: PlanId;
  status: SubscriptionStatus;
  limits: PlanLimits;
  usage: PlanUsage;
  remainingActiveJobs: number | null;
  remainingPosts: number | null;
  remainingActiveApplications: number | null;
  periodStart: string;
  periodEnd: string;
  freeStandardBoostAvailable: boolean;
};

export type SubscriptionLike = {
  plan: PlanId;
  status: SubscriptionStatus;
  activeJobsLimit: number | null;
  postsPerMonthLimit: number | null;
  periodStart: Date;
  periodEnd: Date;
  freeStandardBoostUsedAt: Date | null;
};

export const PLAN_LIMITS: Record<Exclude<PlanId, "enterprise">, PlanLimits> = {
  free: { activeJobs: 2, postsPerMonth: 5 },
  pro: { activeJobs: 15, postsPerMonth: 50 },
};

export const ENTERPRISE_PRICING = {
  baseMonthlyCents: 4_900,
  includedActiveJobs: 25,
  includedPostsPerMonth: 100,
  extraActiveJobCents: 100,
  extraPostBlockCents: 500,
  postsPerBlock: 100,
} as const;

export const FREE_APPLICATION_ALLOWANCE: Record<PlanId, number | null> = {
  free: 10,
  pro: 30,
  enterprise: null,
};

export const APPLICATION_COUNTED_STATUSES = ["applied", "reviewed", "interview"] as const;

export const BOOST_PACKAGES: BoostPackage[] = [
  { id: "starter", name: "Starter", priceCents: 299, proPriceCents: 249, durationDays: 3, multiplier: 1.04 },
  { id: "local", name: "Local", priceCents: 699, proPriceCents: 599, durationDays: 5, multiplier: 1.06 },
  { id: "standard", name: "Standard", priceCents: 999, proPriceCents: 799, durationDays: 7, multiplier: 1.08 },
  { id: "urgent", name: "Urgent Hire", priceCents: 1_499, proPriceCents: 1_199, durationDays: 3, multiplier: 1.1 },
  { id: "strong", name: "Strong", priceCents: 1_999, proPriceCents: 1_599, durationDays: 7, multiplier: 1.12 },
  { id: "maximum", name: "Maximum", priceCents: 3_999, proPriceCents: 3_199, durationDays: 14, multiplier: 1.15 },
];

export const PRO_FREE_BOOST_PACKAGE: BoostPackageId = "standard";

export function isPlanId(value: unknown): value is PlanId {
  return value === "free" || value === "pro" || value === "enterprise";
}

export function isBoostPackageId(value: unknown): value is BoostPackageId {
  return BOOST_PACKAGES.some((pkg) => pkg.id === value);
}

export function getBoostPackage(packageId: string | null | undefined): BoostPackage | null {
  return BOOST_PACKAGES.find((pkg) => pkg.id === packageId) ?? null;
}

export function planLimitsFor(
  plan: PlanId,
  enterprise?: { activeJobsLimit: number | null; postsPerMonthLimit: number | null } | null,
): PlanLimits {
  if (plan === "enterprise") {
    return {
      activeJobs: enterprise?.activeJobsLimit ?? ENTERPRISE_PRICING.includedActiveJobs,
      postsPerMonth: enterprise?.postsPerMonthLimit ?? ENTERPRISE_PRICING.includedPostsPerMonth,
    };
  }
  return { ...PLAN_LIMITS[plan] };
}

export function enterpriseMonthlyPriceCents(input: { activeJobs: number; postsPerMonth: number }): number {
  const activeJobs = Math.max(0, Math.floor(input.activeJobs));
  const posts = Math.max(0, Math.floor(input.postsPerMonth));
  const extraJobs = Math.max(0, activeJobs - ENTERPRISE_PRICING.includedActiveJobs);
  const extraPosts = Math.max(0, posts - ENTERPRISE_PRICING.includedPostsPerMonth);
  const extraPostBlocks = Math.ceil(extraPosts / ENTERPRISE_PRICING.postsPerBlock);
  return (
    ENTERPRISE_PRICING.baseMonthlyCents +
    extraJobs * ENTERPRISE_PRICING.extraActiveJobCents +
    extraPostBlocks * ENTERPRISE_PRICING.extraPostBlockCents
  );
}

export function boostPriceCentsForPlan(packageId: string, plan: PlanId): number | null {
  const pkg = getBoostPackage(packageId);
  if (!pkg) return null;
  return plan === "free" ? pkg.priceCents : pkg.proPriceCents;
}

export function boostCatalogForPlan(
  plan: PlanId,
  freeStandardBoostAvailable = false,
): BoostPackageView[] {
  return BOOST_PACKAGES.map((pkg) => {
    const free = plan === "pro" && pkg.id === PRO_FREE_BOOST_PACKAGE && freeStandardBoostAvailable;
    return {
      id: pkg.id,
      name: pkg.name,
      priceCents: free ? 0 : boostPriceCentsForPlan(pkg.id, plan) ?? pkg.priceCents,
      listPriceCents: pkg.priceCents,
      durationDays: pkg.durationDays,
      multiplier: pkg.multiplier,
      free,
    };
  });
}

export function boostMultiplierForPackage(packageId: string | null | undefined): number {
  return getBoostPackage(packageId)?.multiplier ?? 1;
}

export function applicationAllowanceForPlan(plan: PlanId): number | null {
  return FREE_APPLICATION_ALLOWANCE[plan];
}

export function planLimitsEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PLAN_LIMITS_ENFORCED !== "false";
}

export function billingPeriodStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function billingPeriodEnd(start: Date): Date {
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

export function nextBillingPeriod(start: Date, now: Date): { start: Date; end: Date } {
  const candidateStart = new Date(start);
  const candidateEnd = billingPeriodEnd(candidateStart);
  if (now >= candidateEnd) return { start: billingPeriodStart(now), end: billingPeriodEnd(billingPeriodStart(now)) };
  return { start: candidateStart, end: candidateEnd };
}

export function isWithinPeriod(at: Date | null, periodStart: Date, periodEnd: Date): boolean {
  if (!at) return false;
  const ms = at.getTime();
  return ms >= periodStart.getTime() && ms < periodEnd.getTime();
}

export function freeStandardBoostAvailable(input: {
  plan: PlanId;
  freeStandardBoostUsedAt: Date | null;
  periodStart: Date;
  periodEnd: Date;
  now: Date;
}): boolean {
  if (input.plan !== "pro") return false;
  return !isWithinPeriod(input.freeStandardBoostUsedAt, input.periodStart, input.periodEnd);
}

export function isFreeStandardBoost(input: {
  plan: PlanId;
  packageId: string;
  freeStandardBoostUsedAt: Date | null;
  periodStart: Date;
  periodEnd: Date;
  now: Date;
}): boolean {
  return (
    input.packageId === PRO_FREE_BOOST_PACKAGE &&
    freeStandardBoostAvailable(input)
  );
}

export function remaining(limit: number | null, used: number): number | null {
  if (limit === null) return null;
  return Math.max(0, limit - used);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
