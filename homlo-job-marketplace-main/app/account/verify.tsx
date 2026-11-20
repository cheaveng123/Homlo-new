import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ConsentCheckbox } from "@/components/legal/LegalUI";
import { Btn, Card, ErrorText, Input, Muted, TrustScreen, trustStyles } from "@/components/legal/TrustScreen";
import { CONSENT_WORDING } from "@/lib/legal/consent-wording";
import { trpc } from "@/lib/trpc";

const message = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.");

/**
 * /account/verify: everything an account needs before it can post a job:
 * current Terms accepted, email confirmed (link), phone verified (SMS code).
 * The database enforces the same three rules (jobs_trust_safety_gate).
 * ?next=<path> returns there once everything is done.
 */
export default function VerifyAccountScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const utils = trpc.useUtils();
  const status = trpc.trust.status.useQuery();
  const acceptTerms = trpc.trust.acceptCurrentTerms.useMutation();
  const sendEmail = trpc.trust.verification.sendEmail.useMutation();
  const sendCode = trpc.trust.verification.sendPhoneCode.useMutation();
  const verifyPhone = trpc.trust.verification.verifyPhone.useMutation();

  const [agreed, setAgreed] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => utils.trust.status.invalidate();
  const run = (p: Promise<unknown>, after?: () => void) => {
    setError(null);
    p.then(() => {
      after?.();
      void refresh();
    }).catch((e) => setError(message(e)));
  };

  const s = status.data;
  const allDone = Boolean(s?.acceptedCurrentTerms && s.emailVerified && s.phoneVerified);

  return (
    <TrustScreen title="Verify your account">
      <Muted>To keep job seekers safe, every employer confirms their email and phone number before posting. We do not check ID documents.</Muted>
      <ErrorText>{error ?? (status.error ? message(status.error) : null)}</ErrorText>

      {s && !s.acceptedCurrentTerms ? (
        <Card title="1. Terms of Service">
          <Muted>Our Terms or Privacy Policy changed (version {s.legal.terms} / {s.legal.privacy}). Please review and accept them.</Muted>
          <ConsentCheckbox label={CONSENT_WORDING.signup} checked={agreed} onChange={setAgreed} />
          <Btn label="Accept" disabled={!agreed} busy={acceptTerms.isPending} onPress={() => run(acceptTerms.mutateAsync({ confirmAdultAndTerms: true }))} />
        </Card>
      ) : null}

      <Card title="Email address">
        {s?.emailVerified ? (
          <Text style={trustStyles.ok}>✓ {s.email} is confirmed</Text>
        ) : (
          <>
            <Muted>We sent a confirmation link to {s?.email ?? "your email"}. Open it, then come back and tap “I confirmed it”.</Muted>
            <View style={trustStyles.row}>
              <Btn label={sendEmail.isSuccess ? "Link sent again" : "Send the link again"} tone="secondary" busy={sendEmail.isPending} onPress={() => run(sendEmail.mutateAsync())} />
              <Btn label="I confirmed it" onPress={() => void refresh()} />
            </View>
          </>
        )}
      </Card>

      <Card title="Phone number">
        {s?.phoneVerified ? (
          <Text style={trustStyles.ok}>✓ Phone number verified</Text>
        ) : (
          <>
            <Input
              label="Mobile number, with country code"
              placeholder="+85512345678"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <Btn
              label={codeSent ? "Send a new code" : "Text me a code"}
              tone={codeSent ? "secondary" : "primary"}
              disabled={phone.trim().length < 8}
              busy={sendCode.isPending}
              onPress={() => run(sendCode.mutateAsync({ phone }), () => setCodeSent(true))}
            />
            {codeSent ? (
              <>
                <Input label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
                <Btn
                  label="Verify"
                  disabled={!/^\d{6}$/.test(code)}
                  busy={verifyPhone.isPending}
                  onPress={() => run(verifyPhone.mutateAsync({ phone, code }))}
                />
              </>
            ) : null}
          </>
        )}
      </Card>

      {s?.isNewAccount && s.newAccountListingsLeft !== null ? (
        <Muted>New accounts can post {s.newAccountListingsLeft} more listing(s) this week. Your first listing is checked by our team before it goes live.</Muted>
      ) : null}

      {allDone ? <Btn label="Continue" onPress={() => router.replace((typeof next === "string" && next.startsWith("/") ? next : "/") as never)} /> : null}
    </TrustScreen>
  );
}
