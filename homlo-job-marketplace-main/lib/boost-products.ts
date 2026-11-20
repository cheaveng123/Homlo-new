/**
 * Pure (React Native free) mapping between Homlo boost plans and the
 * RevenueCat/App Store product identifiers. Imported by both the app and the
 * server webhook so the two can never drift.
 */

export const BOOST_PLAN_IDS = [
  "starter",
  "local",
  "standard",
  "urgent",
  "strong",
  "maximum",
] as const;

export type BoostProductPlanId = (typeof BOOST_PLAN_IDS)[number];

export const BOOST_PRODUCT_IDS: Record<BoostProductPlanId, string> = {
  starter: "homlo_boost_starter",
  local: "homlo_boost_local",
  standard: "homlo_boost_standard",
  urgent: "homlo_boost_urgent",
  strong: "homlo_boost_strong",
  maximum: "homlo_boost_maximum",
};

export function isBoostPlanId(value: unknown): value is BoostProductPlanId {
  return typeof value === "string" && (BOOST_PLAN_IDS as readonly string[]).includes(value);
}

export function productIdForPlan(planId: string): string | null {
  return isBoostPlanId(planId) ? BOOST_PRODUCT_IDS[planId] : null;
}

/**
 * Accepts the exact recommended product id, the bare plan id, or a product id
 * that ends in the plan id (`com.company.boost_standard`,
 * `boost.standard`, etc.). This keeps the webhook working if the App Store
 * product prefix differs from the Test Store one.
 */
export function planIdForProductId(productId: string | null | undefined): BoostProductPlanId | null {
  if (!productId) return null;
  const normalized = productId.trim().toLowerCase();
  if (!normalized) return null;

  for (const planId of BOOST_PLAN_IDS) {
    if (normalized === planId) return planId;
    if (normalized === BOOST_PRODUCT_IDS[planId].toLowerCase()) return planId;
    if (normalized.endsWith(`.${planId}`)) return planId;
    if (normalized.endsWith(`_${planId}`)) return planId;
    if (normalized.endsWith(`-${planId}`)) return planId;
  }

  return null;
}
