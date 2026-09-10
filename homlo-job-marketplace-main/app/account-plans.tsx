import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type PlanId = "free" | "pro" | "enterprise";

const plans = [
  { id: "free" as const, name: "Free", price: "$0", cadence: "/ month", icon: "person.fill" as const, summary: "For occasional hiring", badge: undefined, features: ["2 active jobs", "5 job posts / month", "Applicant management", "Applicant tracking", "Messaging", "Basic analytics", "Standard job visibility", "Boosts available separately"] },
  { id: "pro" as const, name: "Pro", price: "$19.99", cadence: "/ month", icon: "star.fill" as const, summary: "For growing employers", badge: "Most popular", features: ["15 active jobs", "50 job posts / month", "Advanced applicant management", "Applicant notes", "Advanced analytics", "Featured employer profile", "Priority visibility", "Boosts available at discounted prices"] },
  { id: "enterprise" as const, name: "Enterprise", price: "Custom", cadence: "", icon: "building.2.fill" as const, summary: "For high-volume organizations", badge: undefined, features: ["Custom active-job limit", "Multiple recruiters", "Team hiring", "Bulk job posting", "Advanced analytics", "Custom integrations", "Dedicated support", "Custom hiring campaigns"] },
] as const;

export default function AccountPlansScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const accountQuery = trpc.homlo.account.get.useQuery(undefined, { enabled: Boolean(user) });
  const account = accountQuery.data as { account?: { plan?: PlanId; plan_status?: string } | null } | undefined;
  const currentPlan = account?.account?.plan ?? "free";
  const [selected, setSelected] = useState<PlanId>("free");
  const [prevPlan, setPrevPlan] = useState<string>("free");
  if (currentPlan && currentPlan !== prevPlan) {
    setPrevPlan(currentPlan);
    setSelected(currentPlan);
  }

  const goToCheckout = () => {
    const plan = plans.find((item) => item.id === selected);
    if (!plan) return;
    if (plan.id === "enterprise") {
      Alert.alert("Enterprise plan", "Enterprise access is arranged through the Homlo team. Contact support@homlo.example to get started.");
      return;
    }
    router.push({ pathname: "/checkout", params: { kind: "plan", plan: plan.name, planId: plan.id, price: plan.id === "pro" ? "19.99" : "0" } } as never);
  };

  if (authLoading || accountQuery.isLoading) {
    return <ScreenContainer className="flex-1 items-center justify-center"><ActivityIndicator color="#16803C" /></ScreenContainer>;
  }
  if (!user) {
    return <ScreenContainer className="flex-1 items-center justify-center p-6"><IconSymbol name="person.fill" size={28} color="#16803C" /><Text style={styles.gateTitle}>Sign in to manage your plan</Text><ScalePressable hapticFeedback onPress={() => router.replace("/login" as never)} style={styles.footerAction}><Text style={styles.footerActionText}>Sign in</Text></ScalePressable></ScreenContainer>;
  }
  const isCurrent = (planId: PlanId) => planId === currentPlan;
  return <ScreenContainer className="flex-1" containerClassName="bg-[#F7F8F6]" edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.header}><Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={() => router.back()} style={styles.back}><IconSymbol name="chevron.left" size={21} color="#405148" /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>ACCOUNT PLANS</Text><Text style={styles.title}>Choose the right hiring plan.</Text><Text style={styles.subtitle}>Account plans manage your hiring workspace. Job Boosting remains a separate per-listing feature.</Text></View></View><View style={styles.planRail}>{plans.map((plan) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: selected === plan.id }} key={plan.id} onPress={() => setSelected(plan.id)} style={[styles.planCard, selected === plan.id && styles.planSelected]}><View style={[styles.planIcon, selected === plan.id && styles.planIconSelected]}><IconSymbol name={plan.icon} size={20} color={selected === plan.id ? "#FFFFFF" : "#16803C"} /></View>{plan.badge ? <Text style={styles.badge}>{plan.badge}</Text> : null}<Text style={styles.planName}>{plan.name}</Text><View style={styles.priceLine}><Text style={styles.price}>{plan.price}</Text><Text style={styles.cadence}>{plan.cadence}</Text></View><Text style={styles.summary}>{plan.summary}</Text><View style={styles.featureList}>{plan.features.slice(0, selected === plan.id ? plan.features.length : 4).map((feature) => <View key={feature} style={styles.featureRow}><IconSymbol name="checkmark.circle.fill" size={14} color="#22A447" /><Text style={styles.feature}>{feature}</Text></View>)}</View><Text style={[styles.cardAction, isCurrent(plan.id) && styles.cardActionSelected]}>{isCurrent(plan.id) ? "Current plan" : "View plan"}</Text></Pressable>)}</View><View style={styles.benefit}><IconSymbol name="paperplane.fill" size={22} color="#16803C" /><View style={styles.benefitCopy}><Text style={styles.benefitTitle}>Your plan is: {currentPlan[0].toUpperCase()}{currentPlan.slice(1)}</Text><Text style={styles.benefitText}>Upgrades apply to your account immediately after checkout. Job Boosting is a separate per-listing feature.</Text></View><IconSymbol name="gift.fill" size={23} color="#16803C" /></View><ScalePressable hapticFeedback onPress={goToCheckout} style={[styles.footerAction, isCurrent(selected) && styles.footerActionDisabled]}><Text style={styles.footerActionText}>{isCurrent(selected) ? "Current Plan" : selected === "enterprise" ? "Contact Homlo" : `Choose ${selected[0].toUpperCase()}${selected.slice(1)}`}</Text><IconSymbol name="chevron.right" size={17} color="#FFFFFF" /></ScalePressable><Text style={styles.note}>Plans are for your employer account. To promote one specific job, open that listing and choose Boost Job.</Text></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { padding: 20, paddingBottom: 34 }, header: { flexDirection: "row", gap: 12, paddingTop: 4 }, back: { alignItems: "center", backgroundColor: "#EAF1EC", borderRadius: 20, height: 40, justifyContent: "center", width: 40 }, headerCopy: { flex: 1 }, eyebrow: { color: "#16803C", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 }, title: { color: "#17201A", fontSize: 26, fontWeight: "800", letterSpacing: -0.7, lineHeight: 32, marginTop: 5 }, subtitle: { color: "#66736A", fontSize: 13, lineHeight: 19, marginTop: 7 }, planRail: { gap: 11, marginTop: 22 }, planCard: { backgroundColor: "#FFFFFF", borderColor: "#DCE5DF", borderRadius: 15, borderWidth: 1, padding: 15 }, planSelected: { borderColor: "#22A447", borderWidth: 1.5, shadowColor: "#16803C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 10, elevation: 2 }, planIcon: { alignItems: "center", backgroundColor: "#EDF6EF", borderRadius: 17, height: 34, justifyContent: "center", width: 34 }, planIconSelected: { backgroundColor: "#16803C" }, badge: { alignSelf: "flex-end", backgroundColor: "#16803C", borderRadius: 8, color: "#FFFFFF", fontSize: 9, fontWeight: "800", marginTop: -29, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4 }, planName: { color: "#17201A", fontSize: 18, fontWeight: "800", marginTop: 12 }, priceLine: { alignItems: "baseline", flexDirection: "row", gap: 4, marginTop: 5 }, price: { color: "#17201A", fontSize: 24, fontWeight: "800" }, cadence: { color: "#66736A", fontSize: 11 }, summary: { color: "#66736A", fontSize: 12, marginTop: 3 }, featureList: { borderTopColor: "#E8EEE9", borderTopWidth: 1, gap: 8, marginTop: 14, paddingTop: 13 }, featureRow: { alignItems: "flex-start", flexDirection: "row", gap: 7 }, feature: { color: "#405148", flex: 1, fontSize: 11.5, lineHeight: 16 }, cardAction: { alignSelf: "flex-start", borderColor: "#9BCDA3", borderRadius: 10, borderWidth: 1, color: "#16803C", fontSize: 11.5, fontWeight: "800", marginTop: 15, overflow: "hidden", paddingHorizontal: 14, paddingVertical: 9 }, cardActionSelected: { backgroundColor: "#16803C", color: "#FFFFFF" }, benefit: { alignItems: "center", backgroundColor: "#E8F5E9", borderRadius: 14, flexDirection: "row", gap: 10, marginTop: 16, padding: 13 }, benefitCopy: { flex: 1 }, benefitTitle: { color: "#17201A", fontSize: 12.5, fontWeight: "800", lineHeight: 17 }, benefitText: { color: "#526158", fontSize: 11, lineHeight: 15, marginTop: 2 }, footerAction: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 13, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 16, minHeight: 52 }, footerActionDisabled: { backgroundColor: "#A8C0B1", flexDirection: "row" }, footerActionText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "800" }, note: { color: "#849087", fontSize: 11, lineHeight: 16, marginTop: 12, textAlign: "center" }, gateTitle: { color: "#17201A", fontSize: 15, fontWeight: "800", marginTop: 12, textAlign: "center" } });