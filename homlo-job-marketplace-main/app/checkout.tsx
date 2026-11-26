import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "@/lib/router";

import { ScreenContainer } from "@/components/screen-container";
import { AppIcon } from "@/components/ui/AppIcon";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/hooks/use-auth";
import { type BoostActivation } from "@/lib/boost";
import { trpc } from "@/lib/trpc";
import { ConsentCheckbox } from "@/components/legal/LegalUI";
import { CONSENT_WORDING } from "@/lib/legal/consent-wording";

export default function CheckoutScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ kind?: string; plan?: string; planId?: string; payment?: string; price?: string; duration?: string; jobTitle?: string; company?: string; jobId?: string; city?: string; category?: string; employmentType?: string; workArrangement?: string; salary?: string }>();
  const [payment, setPayment] = useState<"card" | "aba">("card");
  const [busy, setBusy] = useState(false);
  const isBoost = params.kind === "boost";
  const planId = params.planId as "free" | "pro" | "enterprise" | undefined;
  const isEnterprise = planId === "enterprise";
  const title = isBoost ? params.plan || "Boost plan" : isEnterprise ? "Enterprise account" : "Pro account";
  const price = params.price || (isBoost ? "9.99" : isEnterprise ? "499.00" : "19.99");
  const detail = isBoost ? `${params.duration || "7 days"} promotion` : isEnterprise ? "Usage-based billing · $499/mo base + overages" : "Monthly employer subscription";
  const jobContext = isBoost && params.jobTitle ? `${params.jobTitle}${params.company ? ` · ${params.company}` : ""}` : isEnterprise ? "100 included jobs · 500 included posts · $5/extra job · $1/extra post" : "15 active jobs · 50 posts per month";
  const provider = payment === "aba" ? "aba_payway" : "stripe";
  const createBoost = trpc.homlo.boost.create.useMutation();
  const verifyBoostPayment = trpc.homlo.boost.verifyPayment.useMutation();
  const purchasePlan = trpc.homlo.account.purchasePlan.useMutation();
  // Payment terms: required, never pre-ticked; recorded server-side before paying.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const acceptPaymentTerms = trpc.trust.acceptPaymentTerms.useMutation();

  const confirm = async () => {
    if (busy) return;
    if (authLoading) return;
    if (!user) {
      Alert.alert("Sign in required", "Create a free account to continue.", [{ text: "Sign in", onPress: () => router.replace("/login" as never) }, { text: "Cancel", style: "cancel" }]);
      return;
    }
    if (!termsAccepted) return;
    setBusy(true);
    try {
      await acceptPaymentTerms.mutateAsync({
        accepted: true,
        kind: isBoost ? "boost" : "subscription",
        jobId: isBoost && params.jobId ? String(params.jobId) : undefined,
        productId: isBoost ? String(params.planId ?? "standard") : String(planId ?? "pro"),
        amountCents: Math.round((Number(price) || 0) * 100),
      });
      if (isBoost) {
        const jobId = params.jobId as string | undefined;
        const boostPlanId = (params.planId as BoostActivation["planId"]) || "standard";
        if (!jobId) {
          Alert.alert("Job not found", "This job is no longer available to boost.");
          return;
        }
        const boost = await createBoost.mutateAsync({ jobId, package: boostPlanId, amount: Number(price) || 9.99, provider });
        const boostResult = (boost as { boost?: { boost_id?: string; payment_id?: string }[] } | null)?.boost ?? [];
        const boostId = boostResult[0]?.boost_id;
        const paymentId = boostResult[0]?.payment_id;
        if (!paymentId || !boostId) {
          Alert.alert("Checkout failed", "We could not create the boost. Please try again.");
          return;
        }
        const verification = await verifyBoostPayment.mutateAsync({ paymentId });
        const paymentStatus = (verification as { payment?: { status?: string } | null } | null)?.payment?.status;
        if (paymentStatus !== "completed") {
          router.replace({ pathname: "/boost/failed", params: { jobId, planId: boostPlanId, reason: "declined" } } as never);
          return;
        }
        router.replace({ pathname: "/boost/success", params: { jobId, planId: boostPlanId, receiptId: paymentId } } as never);
        return;
      }
      const plan = (["free", "pro", "enterprise"] as const).includes(planId as "free" | "pro" | "enterprise") ? planId as "free" | "pro" | "enterprise" : "pro";
      const amount = plan === "pro" ? Number(price) || 19.99 : plan === "enterprise" ? Number(price) || 499.00 : 0;
      await purchasePlan.mutateAsync({ plan, amount, provider });
      Alert.alert("Plan updated", `Your account is now on the ${plan[0].toUpperCase()}${plan.slice(1)} plan.`, [{ text: "Done", onPress: () => router.back() }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      Alert.alert("Checkout failed", message);
    } finally {
      setBusy(false);
    }
  };
  return <ScreenContainer className="flex-1" containerClassName="bg-[#F7F8F6]" edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.header}><Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><AppIcon name="back" size={21} color="#405148" /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>{isBoost ? "BOOST CHECKOUT" : "ACCOUNT CHECKOUT"}</Text><Text style={styles.title}>Review and confirm.</Text><Text style={styles.subtitle}>{isBoost ? "Review this job promotion before activation." : "Review your employer plan before continuing."}</Text></View></View><View style={styles.summary}><View style={styles.summaryIcon}><AppIcon name={isBoost ? "star" : "user"} size={22} color="#0891B2" /></View><View style={styles.summaryCopy}><Text style={styles.summaryTitle}>{title}</Text><Text style={styles.summaryDetail}>{detail}</Text><Text style={styles.summaryContext}>{jobContext}</Text></View><Text style={styles.price}>${Number(price).toFixed(2)}{isBoost ? "" : "/mo"}</Text></View><Text style={styles.sectionLabel}>Payment method</Text><Pressable accessibilityRole="radio" accessibilityState={{ selected: payment === "card" }} onPress={() => setPayment("card")} style={[styles.payment, payment === "card" && styles.selected]}><AppIcon name="card" size={20} color="#0891B2" /><View style={styles.paymentCopy}><Text style={styles.paymentTitle}>Card</Text><Text style={styles.paymentMeta}>Visa, Mastercard, and other cards</Text></View>{payment === "card" ? <AppIcon name="circle-check" size={20} color="#0891B2" /> : null}</Pressable><Pressable accessibilityRole="radio" accessibilityState={{ selected: payment === "aba" }} onPress={() => setPayment("aba")} style={[styles.payment, payment === "aba" && styles.selected]}><AppIcon name="bag" size={20} color="#526158" /><View style={styles.paymentCopy}><Text style={styles.paymentTitle}>ABA PayWay (QR)</Text><Text style={styles.paymentMeta}>Pay with ABA or another supported bank</Text></View>{payment === "aba" ? <AppIcon name="circle-check" size={20} color="#0891B2" /> : null}</Pressable><View style={styles.total}><Text style={styles.totalLabel}>Total due today</Text><Text style={styles.totalPrice}>${Number(price).toFixed(2)}</Text></View>{!isBoost ? <Text style={styles.note}>Renews automatically every month until you cancel in Account settings.</Text> : null}<ConsentCheckbox label={CONSENT_WORDING.purchase} checked={termsAccepted} onChange={setTermsAccepted} testID="purchase-consent" /><ScalePressable disabled={busy || !termsAccepted} hapticFeedback onPress={() => { void confirm(); }} style={[styles.primary, (busy || !termsAccepted) && styles.primaryDisabled]}><Text style={styles.primaryText}>{busy ? "Processing…" : isBoost ? "Confirm Boost Checkout" : "Confirm Plan Upgrade"}</Text>{busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <AppIcon name="circle-check" size={18} color="#FFFFFF" />}</ScalePressable><Text style={styles.note}>Payments are processed and recorded server-side. In this deployment verification is simulated until a live provider is configured.</Text></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { padding: 20, paddingBottom: 34 }, header: { alignItems: "center", flexDirection: "row", gap: 12, paddingTop: 4 }, back: { alignItems: "center", backgroundColor: "#EEF3F4", borderRadius: 20, height: 40, justifyContent: "center", width: 40 }, headerCopy: { flex: 1 }, eyebrow: { color: "#0891B2", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 }, title: { color: "#17201A", fontSize: 25, fontWeight: "800", lineHeight: 31, marginTop: 4 }, subtitle: { color: "#66736A", fontSize: 13, lineHeight: 18, marginTop: 5 }, summary: { alignItems: "center", backgroundColor: "#DCF1F6", borderRadius: 15, flexDirection: "row", gap: 10, marginTop: 22, padding: 15 }, summaryIcon: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 20, height: 40, justifyContent: "center", width: 40 }, summaryCopy: { flex: 1 }, summaryTitle: { color: "#17201A", fontSize: 15, fontWeight: "800" }, summaryDetail: { color: "#526158", fontSize: 11.5, marginTop: 3 }, summaryContext: { color: "#66736A", fontSize: 10.5, lineHeight: 15, marginTop: 4 }, price: { color: "#0891B2", fontSize: 17, fontWeight: "800" }, sectionLabel: { color: "#17201A", fontSize: 13, fontWeight: "800", marginTop: 24 }, payment: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE5DF", borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 10, minHeight: 68, paddingHorizontal: 13 }, selected: { backgroundColor: "#EEF7FA", borderColor: "#8BD3E3" }, paymentCopy: { flex: 1 }, paymentTitle: { color: "#17201A", fontSize: 12.5, fontWeight: "800" }, paymentMeta: { color: "#66736A", fontSize: 10.5, marginTop: 3 }, total: { borderTopColor: "#DCE5DF", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 24, paddingTop: 15 }, totalLabel: { color: "#526158", fontSize: 12.5, fontWeight: "700" }, totalPrice: { color: "#17201A", fontSize: 17, fontWeight: "800" }, primary: { alignItems: "center", backgroundColor: "#0891B2", borderRadius: 13, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 19, minHeight: 52 }, primaryDisabled: { backgroundColor: "#9CC7D3" }, primaryText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "800" }, note: { color: "#849087", fontSize: 11, lineHeight: 16, marginTop: 11, textAlign: "center" } });