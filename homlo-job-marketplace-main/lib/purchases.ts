import Purchases, {
  PURCHASES_ERROR_CODE,
  isPurchasesError,
  type CustomerInfo,
  type MakePurchaseResult,
  type PurchasesPackage,
} from "react-native-purchases";
import { Platform } from "react-native";

import { planIdForProductId } from "@/lib/boost-products";

/** RevenueCat offering that holds the six boost packages. */
const BOOST_OFFERING_ID = process.env.EXPO_PUBLIC_RC_BOOST_OFFERING?.trim() || "boost";

let configuration: Promise<boolean> | null = null;
let configured = false;
let currentAppUserId: string | null = null;
let warnedMissingKey = false;
const TEST_KEY_PLACEHOLDER = "PASTE_YOUR_REVENUECAT_TEST_STORE_KEY_HERE";

function isPlaceholder(value: string | null | undefined): boolean {
  const normalized = value?.trim() ?? "";
  return normalized.length === 0 || normalized === TEST_KEY_PLACEHOLDER || normalized.startsWith("PASTE_");
}

function usableKey(value: string | null | undefined): string | null {
  return value && !isPlaceholder(value) ? value.trim() : null;
}

function revenueCatApiKey(): string | null {
  const testKey = usableKey(process.env.EXPO_PUBLIC_RC_TEST_KEY);
  if (Platform.OS === "ios") {
    return usableKey(process.env.EXPO_PUBLIC_RC_IOS_KEY) || testKey;
  }
  if (Platform.OS === "android") {
    return usableKey(process.env.EXPO_PUBLIC_RC_ANDROID_KEY) || testKey;
  }
  return null;
}

function warnIfTestKeyShipsToProduction(key: string): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!key.startsWith("test_")) return;
  console.warn(
    "[Purchases] A RevenueCat Test Store key (test_…) is bundled into a production build. " +
      "Set EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY to the live SDK keys before shipping.",
  );
}

/**
 * Configures RevenueCat exactly once. Safe to call from app startup and from
 * auth code at the same time; both callers await the same promise.
 */
export function initPurchases(): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(false);
  if (configuration) return configuration;

  configuration = Promise.resolve().then(() => {
    const apiKey = revenueCatApiKey();
    if (!apiKey) {
      if (!warnedMissingKey) {
        warnedMissingKey = true;
        console.warn(
          "[Purchases] EXPO_PUBLIC_RC_TEST_KEY is missing or still the placeholder. " +
            "Set it to your RevenueCat Test Store public SDK key " +
            "(RevenueCat dashboard -> Project settings -> API keys). " +
            "The paywall will show an empty state until it is configured.",
        );
      }
      return false;
    }

    warnIfTestKeyShipsToProduction(apiKey);
    try {
      Purchases.configure({ apiKey });
      configured = true;
      return true;
    } catch (error) {
      console.error("[Purchases] configure failed", error);
      return false;
    }
  });

  return configuration;
}

export async function getPackages(): Promise<PurchasesPackage[]> {
  const ready = await initPurchases();
  if (!ready) return [];

  try {
    const offerings = await Purchases.getOfferings();
    // Boosts live in their own offering ("boost" in RevenueCat) so the
    // "current" offering can stay the subscription paywall. Prefer the named
    // boost offering, then any offering that contains boost products, then
    // fall back to the current offering.
    const named = offerings.all[BOOST_OFFERING_ID];
    if (named?.availablePackages.length) return named.availablePackages;
    const withBoosts = Object.values(offerings.all).find((offering) =>
      offering.availablePackages.some((pkg) => planIdForProductId(pkg.product.identifier)),
    );
    if (withBoosts) return withBoosts.availablePackages;
    return offerings.current?.availablePackages ?? [];
  } catch (error) {
    console.error("[Purchases] getOfferings failed", error);
    throw error instanceof Error ? error : new Error("Unable to load boost packages");
  }
}

export type BuyResult =
  | { status: "purchased"; productIdentifier: string; customerInfo: CustomerInfo; transaction: MakePurchaseResult["transaction"] }
  | { status: "cancelled" }
  | { status: "unavailable" }
  | { status: "error"; error: Error };

/**
 * Buys a package. A user-cancelled store sheet resolves as
 * `{ status: "cancelled" }` instead of throwing, so the paywall never shows a
 * scary error for a normal dismissal.
 */
export async function buy(
  pkg: PurchasesPackage,
  options?: { attributes?: Record<string, string | null> },
): Promise<BuyResult> {
  const ready = await initPurchases();
  if (!ready) return { status: "unavailable" };

  try {
    if (options?.attributes && Object.keys(options.attributes).length > 0) {
      await Purchases.setAttributes(options.attributes);
    }

    const result = await Purchases.purchasePackage(pkg);
    return {
      status: "purchased",
      productIdentifier: result.productIdentifier,
      customerInfo: result.customerInfo,
      transaction: result.transaction,
    };
  } catch (error) {
    if (isPurchasesError(error) && error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { status: "cancelled" };
    }
    if (error && typeof error === "object" && "userCancelled" in error && (error as { userCancelled?: boolean }).userCancelled === true) {
      return { status: "cancelled" };
    }
    return {
      status: "error",
      error: error instanceof Error ? error : new Error("The purchase could not be completed"),
    };
  }
}

export async function hasEntitlement(identifier: string): Promise<boolean> {
  const ready = await initPurchases();
  if (!ready) return false;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return Boolean(customerInfo.entitlements.active[identifier]);
  } catch (error) {
    console.error("[Purchases] getCustomerInfo failed", error);
    return false;
  }
}

/**
 * Links RevenueCat to the logged-in Homlo user. The Supabase user UUID is used
 * as the RevenueCat app user id so the webhook can map events back to a user
 * without trusting anything from the client.
 */
export async function identifyPurchasesUser(userId: string | number): Promise<void> {
  const ready = await initPurchases();
  if (!ready) return;

  const appUserId = String(userId);
  if (currentAppUserId === appUserId) return;

  try {
    await Purchases.logIn(appUserId);
    currentAppUserId = appUserId;
  } catch (error) {
    console.error("[Purchases] logIn failed", error);
  }
}

/** Clears the RevenueCat identity on sign-out. */
export async function clearPurchasesUser(): Promise<void> {
  if (Platform.OS === "web") return;
  if (!configured) return;
  if (currentAppUserId === null) return;

  try {
    await Purchases.logOut();
    currentAppUserId = null;
  } catch (error) {
    console.error("[Purchases] logOut failed", error);
  }
}

/** Test seam only. */
export function __resetPurchasesForTests(): void {
  configuration = null;
  configured = false;
  currentAppUserId = null;
  warnedMissingKey = false;
}
