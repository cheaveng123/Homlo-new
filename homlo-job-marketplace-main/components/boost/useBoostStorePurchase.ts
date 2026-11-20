import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import type { PurchasesPackage } from "react-native-purchases";

import { planIdForProductId } from "@/lib/boost-products";
import { apiCall } from "@/lib/_core/api";
import { buy, getPackages, identifyPurchasesUser } from "@/lib/purchases";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export type BoostIntent = {
  purchaseToken: string;
  productId: string;
  planId: string;
  priceCents: number;
  currency: string;
};

export type PurchaseStatus = {
  purchaseToken: string;
  status: "pending" | "purchased" | "activated" | "failed" | "refunded" | "unmatched";
  boostId: string | null;
  jobId: string | null;
  planId: string | null;
  failureReason: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls the server until the RevenueCat webhook has activated (or failed) the boost. */
export async function waitForActivation(purchaseToken: string, attempts = 20): Promise<PurchaseStatus | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const status = await apiCall<PurchaseStatus>(
      `/api/revenuecat/boost-purchases/${encodeURIComponent(purchaseToken)}`,
    );
    if (status.status === "activated" || status.status === "failed" || status.status === "refunded") {
      return status;
    }
    await sleep(1_500);
  }
  return null;
}

type ConfirmResponse = { status: "activated" | "pending" | "failed" | "refunded"; boostId: string | null };

/**
 * After the store has charged, makes sure the boost is ACTIVE on the server
 * before the app continues. Asks the server to confirm the purchase directly
 * with RevenueCat (fast path), and also watches the webhook-driven status, for
 * up to ~45s. Returns the final state, or "timeout".
 */
async function ensureBoostActive(
  purchaseToken: string,
  transactionId: string | null,
): Promise<"activated" | "failed" | "refunded" | "timeout"> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (transactionId) {
      try {
        const confirmed = await apiCall<ConfirmResponse>(
          `/api/revenuecat/boost-purchases/${encodeURIComponent(purchaseToken)}/confirm`,
          { method: "POST", body: JSON.stringify({ transactionId }) },
        );
        if (confirmed.status === "activated" || confirmed.status === "failed" || confirmed.status === "refunded") {
          return confirmed.status;
        }
      } catch {
        // 409 = RevenueCat hasn't processed the receipt yet; 503 = no server
        // secret configured. Either way, fall through to the webhook status.
      }
    }
    try {
      const status = await apiCall<PurchaseStatus>(
        `/api/revenuecat/boost-purchases/${encodeURIComponent(purchaseToken)}`,
      );
      if (status.status === "activated" || status.status === "failed" || status.status === "refunded") {
        return status.status;
      }
    } catch {
      // Network hiccup: keep trying until the deadline.
    }
    await sleep(1_500);
  }
  return "timeout";
}

/**
 * Buys the boost plan the employer already chose, through RevenueCat, without
 * showing a package list: the matching package is selected automatically.
 * Flow: server intent -> store purchase (tagged with the intent) -> wait for
 * the webhook to activate the boost -> success / failed screen.
 */
export function useBoostStorePurchase(jobId: string | undefined, planId: string) {
  const router = useRouter();
  const { user } = useAuth();
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // True between "store charged" and "boost active + job data refreshed".
  const [finalizing, setFinalizing] = useState(false);
  const utils = trpc.useUtils();

  // Reload everything that shows the boosted badge, and wait for the employer's
  // own job list so their job page is already correct when it opens.
  const refreshBoostedData = useCallback(async () => {
    await Promise.allSettled([
      utils.homlo.employer.jobs.fetch(undefined, { staleTime: 0 }),
      utils.homlo.employer.jobs.invalidate(),
      utils.homlo.homeFeed.invalidate(),
      utils.homlo.publicJobs.invalidate(),
      utils.homlo.searchJobs.invalidate(),
    ]);
  }, [utils]);

  useEffect(() => {
    let active = true;
    getPackages()
      .then((loaded) => {
        if (!active) return;
        setPkg(loaded.find((candidate) => planIdForProductId(candidate.product.identifier) === planId) ?? null);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load the boost price.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [planId]);

  const purchase = useCallback(async () => {
    if (busy) return;
    if (!jobId) {
      setError("Choose a job before buying a boost.");
      return;
    }
    if (!user) {
      setError("Sign in before buying a boost.");
      return;
    }
    if (!pkg) {
      setError(loading ? "Still loading the boost price. Try again in a moment." : "This boost isn't available to buy right now.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await identifyPurchasesUser(user.id);

      const intent = await apiCall<BoostIntent>("/api/revenuecat/boost-intents", {
        method: "POST",
        body: JSON.stringify({ jobId, planId, productId: pkg.product.identifier }),
      });

      const result = await buy(pkg, {
        attributes: {
          homlo_boost_token: intent.purchaseToken,
          homlo_boost_job_id: jobId,
          homlo_boost_plan_id: planId,
        },
      });

      if (result.status === "cancelled") {
        setNotice("Purchase cancelled. You have not been charged.");
        return;
      }
      if (result.status === "unavailable") {
        setError("In-app purchases are not configured on this build yet.");
        return;
      }
      if (result.status === "error") {
        setError(result.error.message);
        return;
      }

      // The store has charged. Hold the app on a loading screen until the
      // boost is confirmed ACTIVE and the job data showing the boosted badge
      // has been reloaded, so nothing shows a stale "not boosted" state.
      setFinalizing(true);
      const transactionId = result.transaction?.transactionIdentifier ?? null;
      // Some stores (e.g. the RevenueCat Test Store) don't hand back a
      // transaction id; the server matches by product + time in that case.
      const outcome = await ensureBoostActive(intent.purchaseToken, transactionId ?? `intent:${intent.purchaseToken}`);

      if (outcome === "failed" || outcome === "refunded") {
        setFinalizing(false);
        router.replace({ pathname: "/boost/failed", params: { jobId, planId, reason: "declined" } } as never);
        return;
      }
      if (outcome === "timeout") {
        console.warn("[boost] activation not confirmed within 45s; continuing — it will finish in the background");
      }
      await refreshBoostedData();
      setFinalizing(false);
      router.replace({
        pathname: "/boost/success",
        params: {
          jobId,
          planId,
          receiptId: transactionId ?? result.productIdentifier,
          ...(outcome === "timeout" ? { pending: "1" } : {}),
        },
      } as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The purchase could not be completed.");
    } finally {
      setBusy(false);
      setFinalizing(false);
    }
  }, [busy, jobId, loading, pkg, planId, refreshBoostedData, router, user]);

  return { ready: Boolean(pkg), loading, busy, finalizing, error, notice, purchase };
}
