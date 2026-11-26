import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "@/lib/router";
import { AppIcon } from "@/components/ui/AppIcon";
import { SafeAreaView } from "react-native-safe-area-context";

import { BoostHeader } from "@/components/BoostHeader";
import { findPlan, fmt, priceFor, useIsPro } from "@/lib/boostData";
import type { FailReason } from "@/lib/boostPayments";
import { colors, fonts } from '@/theme';

const COPY: Record<FailReason, { title: string; body: string }> = {
  declined: { title: "Payment declined", body: "Your bank declined this payment. Try another card or payment method." },
  insufficient_funds: { title: "Insufficient funds", body: "There are not enough funds available. Try another payment method." },
  cancelled: { title: "Payment cancelled", body: "The payment was cancelled. You have not been charged." },
  network: { title: "Connection problem", body: "We could not reach the payment service. Check your connection and try again." },
};

function isFailReason(value: string | undefined): value is FailReason {
  return value === "declined" || value === "insufficient_funds" || value === "cancelled" || value === "network";
}

export default function BoostFailedScreen() {
  const router = useRouter();
  const { jobId, planId, reason } = useLocalSearchParams<{ jobId?: string; planId?: string; reason?: string }>();
  const plan = findPlan(planId);
  const copy = COPY[isFailReason(reason) ? reason : "declined"];
  const amount = priceFor(plan, useIsPro());

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <BoostHeader canGoBack={false} failed step={3} />
      <View style={styles.body}>
        <View style={styles.halo}>
          <View style={styles.disc}>
            <AppIcon name="close" color="#FFFFFF" size={34} />
          </View>
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.body}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.planSummary}>{plan.name} boost · {plan.days} days</Text>
            <Text style={styles.amount}>{fmt(amount)}</Text>
          </View>
          <Text style={styles.note}>You have not been charged.</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace({ pathname: "/boost/payment", params: { jobId, planId: plan.id } } as never)}
        style={styles.cta}
      >
        <Text style={styles.ctaText}>Try again</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace({ pathname: "/boost/plan", params: { jobId } } as never)}
        style={styles.ghost}
      >
        <Text style={styles.ghostText}>Choose a different plan</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, flex: 1 },
  body: { alignItems: "center", flex: 1, padding: 18, paddingTop: 48 },
  halo: { alignItems: "center", backgroundColor: colors.redSoft, borderRadius: 48, height: 96, justifyContent: "center", width: 96 },
  disc: { alignItems: "center", backgroundColor: colors.red, borderRadius: 32, height: 64, justifyContent: "center", width: 64 },
  title: { color: colors.text, fontFamily: fonts.heading, fontSize: 24, marginTop: 18 },
  subtitle: { color: "#6B736E", fontFamily: fonts.body, fontSize: 13, marginTop: 4, paddingHorizontal: 12, textAlign: "center" },
  card: { alignSelf: "stretch", backgroundColor: "#FFFFFF", borderColor: "#E6E9E7", borderRadius: 18, borderWidth: 1, gap: 8, marginTop: 24, padding: 16 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  planSummary: { color: "#555555", fontFamily: fonts.body, fontSize: 13, flex: 1 },
  amount: { color: colors.text, fontFamily: fonts.bold, fontSize: 13, marginLeft: 12 },
  note: { color: colors.sub, fontFamily: fonts.body, fontSize: 12 },
  cta: { alignItems: "center", backgroundColor: colors.green, borderRadius: 16, height: 52, justifyContent: "center", marginHorizontal: 18 },
  ctaText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 16 },
  ghost: { alignItems: "center", height: 46, justifyContent: "center", marginBottom: 8, marginHorizontal: 18 },
  ghostText: { color: colors.green, fontFamily: fonts.bold, fontSize: 15 },
});
