import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "@/lib/router";
import { SafeAreaView } from "react-native-safe-area-context";

import { PlansShowcaseView } from "@/components/plans/PlansShowcaseView";
import { QzCta, QzText } from "@/components/plnQzx/plnQzx_bits";
import { QZ, qzShadow } from "@/components/plnQzx/plnQzx_tokens";
import type { PlnQzxPlan, PlnQzxPlansCopy } from "@/components/plnQzx/plnQzx_types";
import { AppIcon } from "@/components/ui/AppIcon";
import { PlanLimitNotice } from "@/components/plnQzx/plnQzx_LimitNotice";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type PlanId = "free" | "pro" | "enterprise";

const plans = [
  { id: "free" as const, name: "Free", price: "$0", cadence: "/ month", icon: "user" as const, summary: "For occasional hiring", badge: undefined, features: ["2 active jobs", "5 job posts / month", "Applicant management", "Applicant tracking", "Messaging", "Basic analytics", "Standard job visibility", "Boosts available separately"] },
  { id: "pro" as const, name: "Pro", price: "$19.99", cadence: "/ month", icon: "star" as const, summary: "For growing employers", badge: "Most popular", features: ["15 active jobs", "50 job posts / month", "Advanced applicant management", "Applicant notes", "Advanced analytics", "Featured employer profile", "Priority visibility", "Boosts available at discounted prices"] },
  { id: "enterprise" as const, name: "Enterprise", price: "$499.00", cadence: "/ month", icon: "building" as const, summary: "For high-volume organizations", badge: undefined, features: ["100 included active jobs", "500 included posts / month", "$5 / extra job · $1 / extra post", "Multiple recruiters", "Team hiring", "Bulk job posting", "Advanced analytics", "Custom integrations", "Dedicated support", "Custom hiring campaigns"] },
] as const;

function numericPrice(value: string): number | null {
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function featureLimit(features: readonly string[], pattern: RegExp): number | null {
  for (const feature of features) {
    const match = feature.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

const formatPrice = (value: number) => (value === 0 ? "$0" : `$${value.toFixed(2)}`);

const isPlanId = (v: unknown): v is PlanId => v === "free" || v === "pro" || v === "enterprise";

export default function AccountPlansScreen() {
  const router = useRouter();
  // Set when an employer is sent here after hitting a plan limit while publishing.
  const params = useLocalSearchParams<{ required?: string; reason?: string; limit?: string; from?: string }>();
  const requiredPlan = isPlanId(params.required) ? params.required : undefined;
  const { user, loading: authLoading } = useAuth();
  const accountQuery = trpc.homlo.account.get.useQuery(undefined, { enabled: Boolean(user) });
  const account = accountQuery.data as { account?: { plan?: PlanId; plan_status?: string } | null } | undefined;
  const currentPlan = account?.account?.plan ?? "free";
  const [selected, setSelected] = useState<PlanId>(requiredPlan ?? "free");
  const [prevPlan, setPrevPlan] = useState<string>("free");
  // Re-sync when either the account's plan loads/changes or a new "required" plan arrives.
  const syncKey = `${currentPlan}|${requiredPlan ?? ""}`;
  if (currentPlan && syncKey !== prevPlan) {
    setPrevPlan(syncKey);
    // Keep the plan that lifts the limit selected; otherwise show the current plan.
    setSelected(requiredPlan && requiredPlan !== currentPlan ? requiredPlan : currentPlan);
  }

  const goToCheckout = () => {
    const plan = plans.find((item) => item.id === selected);
    if (!plan) return;
    const price = plan.id === "pro" ? "19.99" : plan.id === "enterprise" ? "499.00" : "0";
    router.push({ pathname: "/checkout", params: { kind: "plan", plan: plan.name, planId: plan.id, price } } as never);
  };

  if (authLoading || accountQuery.isLoading) {
    return (
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={[styles.page, styles.center]}>
        <ActivityIndicator color={QZ.c.primary} />
      </SafeAreaView>
    );
  }
  if (!user) {
    return (
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={[styles.page, styles.gatePage]}>
        <View style={styles.gateIcon}>
          <AppIcon name="user" size={28} color={QZ.c.primary} />
        </View>
        <QzText v="h2" style={styles.gateTitle}>Sign in to manage your plan</QzText>
        <View style={styles.gateCta}>
          <QzCta label="Sign in" onPress={() => router.replace("/login" as never)} />
        </View>
      </SafeAreaView>
    );
  }

  const viewPlans: PlnQzxPlan[] = plans.map((plan) => {
    const price = numericPrice(plan.price);
    const activeJobs = featureLimit(plan.features, /(\d+)\s+active\s+jobs?/i);
    const postsPerMonth = featureLimit(plan.features, /(\d+)\s+job\s+posts?/i);
    return {
      id: plan.id,
      name: plan.name,
      tagline: plan.summary,
      price: price ?? 0,
      priceLabel: price == null ? plan.price : undefined,
      activeJobs: activeJobs ?? 0,
      activeJobsLabel: activeJobs == null ? "Custom" : undefined,
      postsPerMonth: postsPerMonth ?? 0,
      postsPerMonthLabel: postsPerMonth == null ? "Custom" : undefined,
      popular: Boolean(plan.badge),
      features: plan.features.map((label) => ({ label, included: true })),
    };
  });

  const copy: PlnQzxPlansCopy = {
    title: "Choose the right hiring plan.",
    subtitle: "Account plans manage your hiring workspace. Job Boosting remains a separate per-listing feature.",
    perMonth: "/ month",
    currentTag: "Current plan",
    popularTag: "Most popular",
    activeJobs: "active jobs",
    postsPerMonth: "job posts / month",
    note: "Plans are for your employer account. To promote one specific job, open that listing and choose Boost Job.",
    backLabel: "Back",
    ctaCurrent: "Current Plan",
    ctaChange: (planName) => (selected === "enterprise" ? "Contact Homlo" : `Choose ${planName}`),
  };

  const limitPlanName = plans.find((x) => x.id === (isPlanId(params.from) ? params.from : currentPlan))?.name ?? "Free";
  const requiredName = plans.find((x) => x.id === requiredPlan)?.name;
  const notice =
    requiredPlan && requiredName && requiredPlan !== currentPlan ? (
      <PlanLimitNotice
        planName={limitPlanName}
        requiredName={requiredName}
        reason={params.reason === "posts" ? "posts" : "active"}
        limit={Number(params.limit) || undefined}
      />
    ) : null;

  return (
    <PlansShowcaseView
      notice={notice}
      requiredPlanId={requiredPlan && requiredPlan !== currentPlan ? requiredPlan : undefined}
      requiredTag="Needed to continue"
      plans={viewPlans}
      currentPlanId={currentPlan}
      selectedPlanId={selected}
      onSelectPlan={(id) => setSelected(id as PlanId)}
      onBack={() => router.back()}
      onPrimary={goToCheckout}
      formatPrice={formatPrice}
      copy={copy}
    />
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: QZ.c.bg, flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  gatePage: { alignItems: "center", justifyContent: "center", padding: QZ.sp.xl },
  gateIcon: {
    alignItems: "center",
    backgroundColor: QZ.c.tint,
    borderRadius: 24,
    height: 72,
    justifyContent: "center",
    width: 72,
    ...qzShadow,
  },
  gateTitle: { marginTop: QZ.sp.lg, textAlign: "center" },
  gateCta: { alignSelf: "stretch", marginTop: QZ.sp.xl },
});
