import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppIcon } from "@/components/ui/AppIcon";
import { SafeAreaView } from "react-native-safe-area-context";

import { BoostHeader } from "@/components/BoostHeader";
import { findPlan, fmt, priceFor, useIsPro } from "@/lib/boostData";
import { colors as lagoon, font as lagoonFont, shadow } from "@/components/jobs-v2/theme";

export default function BoostSuccessScreen() {
  const router = useRouter();
  const { jobId, planId, receiptId } = useLocalSearchParams<{ jobId?: string; planId?: string; receiptId?: string }>();
  const plan = findPlan(planId);
  const paid = priceFor(plan, useIsPro());

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <BoostHeader canGoBack={false} step={3} />
      <View style={styles.body}>
        <View style={styles.halo}>
          <View style={styles.disc}>
            <AppIcon name="check" color="#FFFFFF" size={34} />
          </View>
        </View>
        <Text style={styles.title}>Payment successful</Text>
        <Text style={styles.subtitle}>Your boost is now live and reaching more people.</Text>
        <View style={styles.card}>
          <SummaryRow label="Plan" value={plan.name} />
          <SummaryRow label="Duration" value={`${plan.days} days`} />
          <SummaryRow label="Paid" value={fmt(paid)} green />
          <SummaryRow label="Receipt" value={`#${receiptId ?? "—"}`} />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (jobId) router.replace({ pathname: "/employer/job/[id]", params: { id: jobId } } as never);
          else router.replace("/employer/listings" as never);
        }}
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
      <Text style={[styles.value, green && { color: lagoon.teal }]}>{value}</Text>
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
  row: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: lagoon.muted, fontFamily: lagoonFont.medium, fontSize: 13 },
  value: { color: lagoon.text, fontFamily: lagoonFont.semi, fontSize: 13 },
  cta: { alignItems: "center", backgroundColor: lagoon.teal, borderRadius: 999, height: 52, justifyContent: "center", marginBottom: 8, marginHorizontal: 18, ...shadow },
  ctaText: { color: lagoon.white, fontFamily: lagoonFont.semi, fontSize: 15 },
});
