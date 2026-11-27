import React, { useCallback } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "@/lib/router";
import { AppIcon } from "@/components/ui/AppIcon";
import { SafeAreaView } from "react-native-safe-area-context";

import { BoostHeader } from "@/components/BoostHeader";
import { findPlan, fmt, priceFor, useIsPro } from "@/lib/boostData";
import { colors as lagoon, font as lagoonFont, shadow } from "@/components/jobs-v2/theme";

export default function BoostSuccessScreen() {
  const router = useRouter();
  const { jobId, planId, receiptId, pending } = useLocalSearchParams<{ jobId?: string; planId?: string; receiptId?: string; pending?: string }>();
  const plan = findPlan(planId);
  const paid = priceFor(plan, useIsPro());
  // Store transaction ids are long; show a short, readable receipt code.
  const receipt = receiptId ? receiptId.replace(/[^A-Za-z0-9]/g, "").slice(-10).toUpperCase() : "—";

  // Finish on the boosted job's employer page, with the boost screens cleared
  // from history so Back can't return to the payment flow.
  const openBoostedJob = useCallback(() => {
    if (router.canDismiss()) router.dismissAll();
    if (jobId) router.push({ pathname: "/employer/job/[id]", params: { id: jobId } } as never);
    else router.push("/employer/listings" as never);
  }, [jobId, router]);

  // Android back button goes forward to the job instead of back to payment.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        openBoostedJob();
        return true;
      });
      return () => sub.remove();
    }, [openBoostedJob]),
  );

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      {/* No swipe-back: the payment is done. */}
      <Stack.Screen options={{ gestureEnabled: false }} />
      <BoostHeader canGoBack={false} step={3} />
      <View style={styles.body}>
        <View style={styles.halo}>
          <View style={styles.disc}>
            <AppIcon name="check" color="#FFFFFF" size={34} />
          </View>
        </View>
        <Text style={styles.title}>Payment successful</Text>
        <Text style={styles.subtitle}>
          {pending === "1"
            ? "Your boost is being activated and will appear on your job shortly."
            : "Your boost is now live and reaching more people."}
        </Text>
        <View style={styles.card}>
          <SummaryRow label="Plan" value={plan.name} />
          <SummaryRow label="Duration" value={`${plan.days} days`} />
          <SummaryRow label="Paid" value={fmt(paid)} green />
          <SummaryRow label="Receipt" value={`#${receipt}`} />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={openBoostedJob}
        style={styles.cta}
      >
        <Text style={styles.ctaText}>View my job</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, green = false }: { label: string; value: string; green?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.value, green && { color: lagoon.teal }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: lagoon.bg, flex: 1 },
  body: { alignItems: "center", flex: 1, padding: 18, paddingTop: 48 },
  halo: { alignItems: "center", backgroundColor: lagoon.tint, borderRadius: 48, height: 96, justifyContent: "center", width: 96 },
  disc: { alignItems: "center", backgroundColor: lagoon.teal, borderRadius: 32, height: 64, justifyContent: "center", width: 64 },
  title: { color: lagoon.deepTeal, fontFamily: lagoonFont.head, fontSize: 24, marginTop: 18 },
  subtitle: { color: lagoon.muted, fontFamily: lagoonFont.medium, fontSize: 13, marginTop: 4, textAlign: "center" },
  card: { alignSelf: "stretch", backgroundColor: lagoon.card, borderColor: lagoon.border, borderRadius: 24, borderWidth: 1, gap: 8, marginTop: 24, padding: 16 },
  row: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  label: { color: lagoon.muted, fontFamily: lagoonFont.medium, fontSize: 13 },
  value: { color: lagoon.text, flexShrink: 1, fontFamily: lagoonFont.semi, fontSize: 13, textAlign: "right" },
  cta: { alignItems: "center", backgroundColor: lagoon.teal, borderRadius: 999, height: 52, justifyContent: "center", marginBottom: 8, marginHorizontal: 18, ...shadow },
  ctaText: { color: lagoon.white, fontFamily: lagoonFont.semi, fontSize: 15 },
});
