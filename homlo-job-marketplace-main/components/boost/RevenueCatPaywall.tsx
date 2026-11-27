import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "@/lib/router";
import type { PurchasesPackage } from "react-native-purchases";

import { accents, colors, font } from "@/components/jobs-v2/theme";
import { BOOST_PLAN_IDS, planIdForProductId } from "@/lib/boost-products";
import { apiCall } from "@/lib/_core/api";
import { buy, getPackages, identifyPurchasesUser } from "@/lib/purchases";
import { useAuth } from "@/hooks/use-auth";
import { waitForActivation, type BoostIntent } from "@/components/boost/useBoostStorePurchase";

function planOrder(productId: string): number {
  const planId = planIdForProductId(productId);
  return planId ? BOOST_PLAN_IDS.indexOf(planId) : BOOST_PLAN_IDS.length;
}

function packageLabel(pkg: PurchasesPackage): string {
  return pkg.product.title?.trim() || pkg.product.identifier;
}

export function RevenueCatPaywall({ jobId, planId }: { jobId?: string; planId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [buyingPackageId, setBuyingPackageId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPackages()
      .then((loaded) => {
        if (!active) return;
        const boostPackages = loaded
          .filter((pkg) => Boolean(planIdForProductId(pkg.product.identifier)))
          .sort((left, right) => planOrder(left.product.identifier) - planOrder(right.product.identifier));
        setPackages(boostPackages);
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load boost packages.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const purchase = useCallback(
    async (pkg: PurchasesPackage) => {
      if (buyingPackageId) return;
      if (!jobId) {
        setError("Choose a job before buying a boost.");
        return;
      }
      if (!user) {
        setError("Sign in before buying a boost.");
        return;
      }

      const productPlanId = planIdForProductId(pkg.product.identifier);
      if (!productPlanId) {
        setError("This product is not a boost.");
        return;
      }

      setBuyingPackageId(pkg.identifier);
      setError(null);
      setNotice(null);

      try {
        await identifyPurchasesUser(user.id);

        const intent = await apiCall<BoostIntent>("/api/revenuecat/boost-intents", {
          method: "POST",
          body: JSON.stringify({
            jobId,
            planId: productPlanId,
            productId: pkg.product.identifier,
          }),
        });

        const result = await buy(pkg, {
          attributes: {
            homlo_boost_token: intent.purchaseToken,
            homlo_boost_job_id: jobId,
            homlo_boost_plan_id: productPlanId,
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

        setNotice("Payment received. Activating your boost…");
        const status = await waitForActivation(intent.purchaseToken);

        if (status?.status === "activated") {
          router.replace({
            pathname: "/boost/success",
            params: {
              jobId,
              planId: productPlanId,
              receiptId: result.transaction?.transactionIdentifier ?? result.productIdentifier,
            },
          } as never);
          return;
        }

        if (status?.status === "failed" || status?.status === "refunded") {
          router.replace({
            pathname: "/boost/failed",
            params: { jobId, planId: productPlanId, reason: "declined" },
          } as never);
          return;
        }

        setNotice(
          "Payment received, but the boost is still pending confirmation. " +
            "It will appear on your job as soon as the RevenueCat webhook is delivered.",
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The purchase could not be completed.");
      } finally {
        setBuyingPackageId(null);
      }
    },
    [buyingPackageId, jobId, router, user],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>In-app purchase</Text>
      <Text style={styles.title}>Buy this boost</Text>
      <Text style={styles.subtitle}>
        Purchases are processed by Apple or Google. The boost activates on your job after the
        RevenueCat webhook is confirmed.
      </Text>

      {loading ? (
        <View style={styles.stateRow}>
          <ActivityIndicator color={colors.teal} />
          <Text style={styles.stateText}>Loading App Store packages…</Text>
        </View>
      ) : null}

      {!loading && packages.length === 0 && !error ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No boost packages available</Text>
          <Text style={styles.emptyText}>
            Configure the RevenueCat “current” offering with the six Homlo boost products, then
            reopen this screen.
          </Text>
        </View>
      ) : null}

      {packages.map((pkg) => {
        const mappedPlan = planIdForProductId(pkg.product.identifier);
        const selected = mappedPlan === planId;
        const purchasing = buyingPackageId === pkg.identifier;
        const disabled = Boolean(buyingPackageId) || !jobId || !user;

        return (
          <View key={pkg.identifier} style={[styles.packageCard, selected && styles.packageCardSelected]}>
            <View style={styles.packageCopy}>
              <View style={styles.packageTitleRow}>
                <Text style={styles.packageTitle}>{packageLabel(pkg)}</Text>
                {selected ? <Text style={styles.selectedBadge}>Selected</Text> : null}
              </View>
              <Text style={styles.packageMeta}>
                One-time boost · {pkg.product.identifier}
              </Text>
            </View>

            <View style={styles.packageAction}>
              <Text style={styles.price}>{pkg.product.priceString}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={() => void purchase(pkg)}
                style={[styles.buyButton, disabled && styles.buyButtonDisabled]}
              >
                {purchasing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.buyButtonText}>Buy</Text>
                )}
              </Pressable>
            </View>
          </View>
        );
      })}

      {notice ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 18 },
  eyebrow: {
    color: colors.teal,
    fontFamily: font.semi,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: { color: colors.deepTeal, fontFamily: font.headBold, fontSize: 20, marginTop: 4 },
  subtitle: { color: colors.muted, fontFamily: font.medium, fontSize: 12, lineHeight: 17, marginTop: 4 },
  stateRow: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 14 },
  stateText: { color: colors.muted, fontFamily: font.medium, fontSize: 12 },
  emptyCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },
  emptyTitle: { color: colors.deepTeal, fontFamily: font.semi, fontSize: 14 },
  emptyText: { color: colors.muted, fontFamily: font.medium, fontSize: 12, lineHeight: 17, marginTop: 4 },
  packageCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    padding: 14,
  },
  packageCardSelected: { borderColor: colors.teal, borderWidth: 1.5 },
  packageCopy: { flex: 1 },
  packageTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  packageTitle: { color: colors.text, fontFamily: font.semi, fontSize: 14, flexShrink: 1 },
  selectedBadge: {
    backgroundColor: colors.tint,
    borderRadius: 999,
    color: colors.teal,
    fontFamily: font.semi,
    fontSize: 10,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  packageMeta: { color: colors.muted, fontFamily: font.medium, fontSize: 11, marginTop: 3 },
  packageAction: { alignItems: "flex-end", gap: 6 },
  price: { color: colors.deepTeal, fontFamily: font.headBold, fontSize: 16 },
  buyButton: {
    alignItems: "center",
    backgroundColor: colors.teal,
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    minWidth: 68,
    paddingHorizontal: 14,
  },
  buyButtonDisabled: { opacity: 0.45 },
  buyButtonText: { color: "#FFFFFF", fontFamily: font.semi, fontSize: 13 },
  noticeCard: {
    backgroundColor: accents.sunrise.bg,
    borderColor: accents.sunrise.mid,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  noticeText: { color: accents.sunrise.ink, fontFamily: font.medium, fontSize: 12, lineHeight: 17 },
  errorCard: {
    backgroundColor: "#FDF0D9",
    borderColor: "#F8DDB0",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  errorText: { color: "#A8620B", fontFamily: font.medium, fontSize: 12, lineHeight: 17 },
});
