import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppIcon } from "@/components/ui/AppIcon";
import { SafeAreaView } from "react-native-safe-area-context";
import cardImage from "@/assets/images/boost-card.png";

import { BoostHeader } from "@/components/BoostHeader";
import { findPlan, fmt, priceFor, useIsPro } from "@/lib/boostData";
import { boostPayments, type PayMethod } from "@/lib/boostPayments";
import { accents, colors as lagoon, font as lagoonFont, shadow } from "@/components/jobs-v2/theme";

type CardDetails = {
  number: string;
  expiry: string;
  cvc: string;
  name: string;
};

export default function BoostPaymentScreen() {
  const router = useRouter();
  const { jobId, planId } = useLocalSearchParams<{ jobId?: string; planId?: string }>();
  const plan = findPlan(planId);
  const isPro = useIsPro();
  const amount = priceFor(plan, isPro);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<CardDetails>({ number: "", expiry: "", cvc: "", name: "" });

  const pay = async (method: PayMethod) => {
    if (busy) return;
    if (!jobId) {
      router.replace({ pathname: "/boost/failed", params: { planId: plan.id, reason: "network" } } as never);
      return;
    }
    setBusy(true);
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
      setBusy(false);
    }
  };

  const formatNumber = (value: string) => value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <BoostHeader step={2} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Payment</Text>
        <View style={styles.summaryCard}>
          <SummaryRow label={`${plan.name} boost · ${plan.days} days`} value={fmt(amount)} />
          <View style={styles.totalRow}>
            <Text style={styles.totalText}>Total</Text>
            <Text style={styles.totalText}>{fmt(amount)}</Text>
          </View>
        </View>

        {Platform.OS === "ios" ? (
          <Pressable disabled={busy} onPress={() => void pay("apple_pay")} style={[styles.walletButton, styles.applePay]}>
            <Text style={styles.walletText}>Apple Pay</Text>
          </Pressable>
        ) : null}
        {Platform.OS === "android" ? (
          <Pressable disabled={busy} onPress={() => void pay("google_pay")} style={[styles.walletButton, styles.googlePay]}>
            <Text style={styles.walletTextDark}>
              <Text style={styles.googleG}>G</Text> Pay
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or pay with card</Text>
          <View style={styles.divider} />
        </View>
        <Field
          autoComplete="off"
          keyboardType="number-pad"
          label="Card number"
          onChangeText={(value) => setCard((current) => ({ ...current, number: formatNumber(value) }))}
          placeholder="1234 5678 9012 3456"
          value={card.number}
        />
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Field
              keyboardType="number-pad"
              label="Expiry"
              onChangeText={(value) => setCard((current) => ({ ...current, expiry: formatExpiry(value) }))}
              placeholder="MM/YY"
              value={card.expiry}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Field
              keyboardType="number-pad"
              label="CVC"
              onChangeText={(value) => setCard((current) => ({ ...current, cvc: value.replace(/\D/g, "").slice(0, 4) }))}
              placeholder="•••"
              secureTextEntry
              value={card.cvc}
            />
          </View>
        </View>
        <Field
          autoCapitalize="words"
          label="Name on card"
          onChangeText={(value) => setCard((current) => ({ ...current, name: value }))}
          placeholder="Full name"
          value={card.name}
        />
        <View style={styles.secureRow}>
          <AppIcon name="lock" color={lagoon.teal} size={13} />
          <Text style={styles.secureText}>Card details are never sent to Homlo; a payment processor handles the charge.</Text>
        </View>
      </ScrollView>
      <Pressable disabled={busy} onPress={() => void pay("card")} style={styles.cta}>
        <View style={styles.ctaImageContainer}>
          <Image source={cardImage} style={styles.ctaImage} />
        </View>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.ctaText}>Pay {fmt(amount)}</Text>}
      </Pressable>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryText}>{label}</Text>
      <Text style={styles.summaryText}>{value}</Text>
    </View>
  );
}

function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        placeholderTextColor={lagoon.muted}
        style={[styles.input, focused && styles.inputFocused, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: lagoon.bg, flex: 1 },
  body: { padding: 18, paddingBottom: 24 },
  title: { color: lagoon.deepTeal, fontFamily: lagoonFont.head, fontSize: 26, marginBottom: 14 },
  summaryCard: { backgroundColor: lagoon.cream, borderColor: accents.sunrise.mid, borderRadius: 24, borderWidth: 1, marginBottom: 12, padding: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryText: { color: lagoon.muted, fontFamily: lagoonFont.medium, fontSize: 13 },
  totalRow: { borderTopColor: accents.sunrise.mid, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10 },
  totalText: { color: lagoon.deepTeal, fontFamily: lagoonFont.headBold, fontSize: 15 },
  walletButton: { alignItems: "center", borderRadius: 999, height: 50, justifyContent: "center", marginTop: 4 },
  applePay: { backgroundColor: "#000000" },
  googlePay: { backgroundColor: lagoon.card, borderColor: lagoon.border, borderWidth: 1 },
  walletText: { color: "#FFFFFF", fontFamily: lagoonFont.semi, fontSize: 15 },
  walletTextDark: { color: lagoon.text, fontFamily: lagoonFont.semi, fontSize: 15 },
  googleG: { color: "#4285F4" },
  dividerRow: { alignItems: "center", flexDirection: "row", gap: 10, marginBottom: 2, marginTop: 16 },
  divider: { backgroundColor: lagoon.border, flex: 1, height: 1 },
  dividerText: { color: lagoon.muted, fontFamily: lagoonFont.medium, fontSize: 12 },
  field: { marginTop: 10 },
  fieldRow: { flexDirection: "row", gap: 10 },
  fieldHalf: { flex: 1 },
  fieldLabel: { color: lagoon.muted, fontFamily: lagoonFont.semi, fontSize: 11 },
  input: { backgroundColor: lagoon.card, borderColor: lagoon.border, borderRadius: 14, borderWidth: 1, color: lagoon.text, fontFamily: lagoonFont.medium, fontSize: 15, height: 50, marginTop: 4, paddingHorizontal: 12 },
  inputFocused: { borderColor: lagoon.teal, borderWidth: 1.5 },
  secureRow: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 14 },
  secureText: { color: lagoon.muted, flex: 1, fontFamily: lagoonFont.medium, fontSize: 11.5 },
  cta: { alignItems: "center", backgroundColor: lagoon.teal, borderRadius: 999, height: 52, justifyContent: "center", marginBottom: 8, marginHorizontal: 18, flexDirection: "row", ...shadow },
  ctaImage: { width: 24, height: 24, marginRight: 8 },
  ctaImageContainer: { flexDirection: "row", alignItems: "center" },
  ctaText: { color: lagoon.white, fontFamily: lagoonFont.semi, fontSize: 15 },
});
