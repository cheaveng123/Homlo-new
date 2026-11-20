import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { AppIcon } from "@/components/ui/AppIcon";
import { SafeAreaView } from "react-native-safe-area-context";

import { useBoostStorePurchase } from "@/components/boost/useBoostStorePurchase";
import { findPlan, fmt, priceFor, useIsPro } from "@/lib/boostData";
import { boostPayments, type PayMethod } from "@/lib/boostPayments";
import { ConsentCheckbox } from "@/components/legal/LegalUI";
import { CONSENT_WORDING } from "@/lib/legal/consent-wording";
import { trpc } from "@/lib/trpc";

export default function BoostPaymentScreen() {
  const router = useRouter();
  const { jobId, planId } = useLocalSearchParams<{ jobId?: string; planId?: string }>();
  const plan = findPlan(planId);
  const isPro = useIsPro();
  const amount = priceFor(plan, isPro);
  const [webBusy, setWebBusy] = useState(false);
  // Payment terms: required, never pre-ticked. Recorded in consent_log before
  // any payment starts; the database refuses a payment without it.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const acceptPaymentTerms = trpc.trust.acceptPaymentTerms.useMutation();
  // The plan chosen on the previous step is bought through RevenueCat behind
  // the scenes; no package list is shown on this page.
  const store = useBoostStorePurchase(jobId, plan.id);
  const isNative = Platform.OS === "ios" || Platform.OS === "android";
  const busy = isNative ? store.busy : webBusy;

  const pay = async (method: PayMethod) => {
    if (busy || !termsAccepted) return;
    try {
      await acceptPaymentTerms.mutateAsync({
        accepted: true,
        kind: "boost",
        jobId: jobId || undefined,
        productId: plan.id,
        amountCents: Math.round(amount * 100),
      });
    } catch {
      router.replace({ pathname: "/boost/failed", params: { jobId, planId: plan.id, reason: "network" } } as never);
      return;
    }
    if (isNative) {
      // Apple Pay / Google Pay / card all complete in the store's own payment
      // sheet, which charges the RevenueCat product for this plan.
      await store.purchase();
      return;
    }
    if (!jobId) {
      router.replace({ pathname: "/boost/failed", params: { planId: plan.id, reason: "network" } } as never);
      return;
    }
    setWebBusy(true);
    try {
      const result = await boostPayments.pay({ jobId, planId: plan.id, amount, method });
      if (result.ok) {
        router.replace({ pathname: "/boost/success", params: { jobId, planId: plan.id, receiptId: result.receiptId } } as never);
      } else {
        router.replace({ pathname: "/boost/failed", params: { jobId, planId: plan.id, reason: result.reason } } as never);
      }
    } catch {
      router.replace({ pathname: "/boost/failed", params: { jobId, planId: plan.id, reason: "network" } } as never);
    } finally {
      setWebBusy(false);
    }
  };

  const isIOS = Platform.OS === "ios";
  const isAndroid = Platform.OS === "android";

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      {/* header: back, title, step */}
      <View style={styles.header}>
        <View style={styles.headRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={store.finalizing} onPress={() => router.back()} style={styles.back}>
            <AppIcon name="back" color={C.navy} size={20} />
          </Pressable>
          <Text style={styles.headTitle}>Checkout</Text>
          <Text style={styles.step}>Step 2 of 3</Text>
        </View>
        <View style={styles.steps}>
          {[1, 2, 3].map((n) => <View key={n} style={[styles.stepBar, n <= 2 && styles.stepBarOn]} />)}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* order summary */}
        <Text style={styles.label}>Order summary</Text>
        <View style={styles.card}>
          <View style={styles.planRow}>
            <View style={styles.planThumb}><Image source={plan.image} style={{ width: 34, height: 34 }} resizeMode="contain" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planName}>{plan.name} boost</Text>
              <Text style={styles.planMeta}>{plan.days} days of boosted visibility</Text>
            </View>
            <Text style={styles.planPrice}>{fmt(plan.price)}</Text>
          </View>
          <View style={styles.rule} />
          <SummaryRow label="Subtotal" value={fmt(plan.price)} />
          {isPro && amount < plan.price ? <SummaryRow label="Pro member price" value={`−${fmt(plan.price - amount)}`} /> : null}
          <View style={[styles.rule, { marginTop: 12 }]} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total due today</Text>
            <Text style={styles.totalValue}>{fmt(amount)}</Text>
          </View>
        </View>

        {store.error || store.notice ? (
          <View style={[styles.statusBox, store.error ? styles.statusError : null]}>
            <AppIcon name={store.error ? "alert" : "info"} color={store.error ? "#A8392B" : C.muted} size={16} />
            <Text style={[styles.statusText, store.error ? styles.statusTextError : null]}>{store.error ?? store.notice}</Text>
          </View>
        ) : null}

        {/* payment method */}
        <Text style={[styles.label, { marginTop: 24 }]}>Payment method</Text>
        {isIOS ? (
          <Pressable disabled={busy || !termsAccepted} onPress={() => void pay("apple_pay")} style={({ pressed }) => [styles.wallet, styles.applePay, pressed && { opacity: 0.85 }]}>
            <Text style={styles.walletText}>{"\uF8FF"} Pay</Text>
          </Pressable>
        ) : null}
        {isAndroid ? (
          <Pressable disabled={busy || !termsAccepted} onPress={() => void pay("google_pay")} style={({ pressed }) => [styles.wallet, styles.googlePay, pressed && { opacity: 0.85 }]}>
            <Text style={styles.walletTextDark}><Text style={styles.googleG}>G</Text> Pay</Text>
          </Pressable>
        ) : null}

        {/* Card details are entered only in the store's / payment provider's own
            hosted sheet. Homlo never collects, sees or stores card numbers. */}
        <View style={[styles.statusBox, { marginTop: 16 }]}>
          <ConsentCheckbox label={CONSENT_WORDING.purchase} checked={termsAccepted} onChange={setTermsAccepted} testID="purchase-consent" />
        </View>

        <View style={styles.secureRow}>
          <AppIcon name="lock" color={C.muted} size={13} />
          <Text style={styles.secureText}>Payment is completed securely by {isAndroid ? "Google Play" : Platform.OS === "web" ? "our payment provider" : "Apple"}. Card details are never sent to Homlo.</Text>
        </View>
      </ScrollView>

      {/* pay bar */}
      <View style={styles.bar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.barLabel}>Total</Text>
          <Text style={styles.barValue}>{fmt(amount)}</Text>
        </View>
        <Pressable disabled={busy || !termsAccepted} onPress={() => void pay("card")} style={({ pressed }) => [styles.cta, (busy || !termsAccepted) && styles.ctaBusy, pressed && !busy && { opacity: 0.9 }]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : (
            <>
              <AppIcon name="lock" color="#FFFFFF" size={15} />
              <Text style={styles.ctaText}>Pay {fmt(amount)}</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Paid: hold here until the boost is active and every boosted badge is
          up to date, so nothing in the app shows a stale state. */}
      <Stack.Screen options={{ gestureEnabled: !store.finalizing }} />
      {store.finalizing ? (
        <View style={styles.finalizing} accessibilityViewIsModal accessibilityLiveRegion="polite">
          <View style={styles.finalizingCard}>
            <ActivityIndicator size="large" color={C.navy} />
            <Text style={styles.finalizingTitle}>Finishing your boost</Text>
            <Text style={styles.finalizingText}>Making sure your job shows as boosted everywhere. This only takes a moment.</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const C = { navy: "#14324A", ink: "#12303C", muted: "#6A7C84", faint: "#9AABB1", line: "#E3E9EC", bg: "#F6F8F9" };
const F = { h: "PlusJakartaSans_800ExtraBold", hb: "PlusJakartaSans_700Bold", m: "Inter_500Medium", s: "Inter_600SemiBold", r: "Inter_400Regular" };

const styles = StyleSheet.create({
  root: { backgroundColor: "#FFFFFF", flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  headTitle: { flex: 1, fontFamily: F.h, fontSize: 18, color: C.navy },
  step: { fontFamily: F.m, fontSize: 13, color: C.muted },
  steps: { flexDirection: "row", gap: 6 },
  stepBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.line },
  stepBarOn: { backgroundColor: C.navy },

  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
  label: { fontFamily: F.s, fontSize: 13, color: C.muted, marginBottom: 8 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, backgroundColor: "#FFFFFF" },
  planRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  planThumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  planName: { fontFamily: F.hb, fontSize: 15, color: C.navy },
  planMeta: { fontFamily: F.r, fontSize: 13, color: C.muted, marginTop: 2 },
  planPrice: { fontFamily: F.hb, fontSize: 15, color: C.navy },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: "#D5DEE2", marginVertical: 14 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  summaryLabel: { fontFamily: F.r, fontSize: 14, color: C.muted },
  summaryValue: { fontFamily: F.m, fontSize: 14, color: C.ink },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  totalLabel: { fontFamily: F.hb, fontSize: 15, color: C.navy },
  totalValue: { fontFamily: F.h, fontSize: 20, color: C.navy },

  statusBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10 },
  statusError: { backgroundColor: "#FBEEEC", borderColor: "#F2D3CE" },
  statusText: { flex: 1, color: C.ink, fontFamily: F.m, fontSize: 13, lineHeight: 18 },
  statusTextError: { color: "#A8392B" },

  wallet: { alignItems: "center", borderRadius: 12, height: 52, justifyContent: "center" },
  applePay: { backgroundColor: "#000000" },
  googlePay: { backgroundColor: "#FFFFFF", borderColor: C.line, borderWidth: 1 },
  walletText: { color: "#FFFFFF", fontSize: 18, fontWeight: "600" },
  walletTextDark: { color: C.ink, fontFamily: F.s, fontSize: 16 },
  googleG: { color: "#4285F4" },
  dividerRow: { alignItems: "center", flexDirection: "row", gap: 12, marginVertical: 18 },
  divider: { backgroundColor: C.line, flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { color: C.faint, fontFamily: F.m, fontSize: 12 },

  group: { borderRadius: 14, borderWidth: 1, borderColor: C.line, overflow: "hidden", backgroundColor: "#FFFFFF" },
  groupRow: { flexDirection: "row" },
  groupSplit: { width: StyleSheet.hairlineWidth, backgroundColor: C.line, marginTop: StyleSheet.hairlineWidth },
  field: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  fieldTopRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  fieldFocused: { backgroundColor: "#F8FAFB" },
  fieldLabel: { color: C.muted, fontFamily: F.s, fontSize: 11.5 },
  input: { flex: 1, color: C.ink, fontFamily: F.m, fontSize: 16, height: 34, padding: 0 },
  secureRow: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 14, paddingHorizontal: 2 },
  secureText: { color: C.muted, flex: 1, fontFamily: F.r, fontSize: 12, lineHeight: 17 },

  bar: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#D5DEE2", backgroundColor: "#FFFFFF" },
  barLabel: { fontFamily: F.m, fontSize: 12, color: C.muted },
  barValue: { fontFamily: F.h, fontSize: 20, color: C.navy },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, paddingHorizontal: 28, borderRadius: 14, backgroundColor: C.navy, minWidth: 170 },
  ctaBusy: { opacity: 0.7 },
  ctaText: { color: "#FFFFFF", fontFamily: F.hb, fontSize: 15 },

  finalizing: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", backgroundColor: "rgba(11, 27, 38, 0.45)", justifyContent: "center", padding: 32, zIndex: 50 },
  finalizingCard: { alignItems: "center", alignSelf: "stretch", backgroundColor: "#FFFFFF", borderRadius: 20, gap: 10, paddingHorizontal: 24, paddingVertical: 28 },
  finalizingTitle: { color: C.navy, fontFamily: F.h, fontSize: 18, marginTop: 6 },
  finalizingText: { color: C.muted, fontFamily: F.m, fontSize: 13, lineHeight: 19, textAlign: "center" },
});
