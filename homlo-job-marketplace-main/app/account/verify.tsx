import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "@/lib/router";

import { ConsentCheckbox } from "@/components/legal/LegalUI";
import { Btn, Card, ErrorText, Muted, TrustScreen, trustStyles } from "@/components/legal/TrustScreen";
import { CONSENT_WORDING } from "@/lib/legal/consent-wording";
import { trpc } from "@/lib/trpc";

const message = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.");

/**
 * /account/verify: everything an account needs before it can post a job:
 * current Terms accepted and email confirmed (link). Phone verification is
 * not required (no free SMS provider). The database enforces the same rules
 * (jobs_trust_safety_gate).
 * ?next=<path> returns there once everything is done.
 */
export default function VerifyAccountScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const utils = trpc.useUtils();
  // While the email is unconfirmed, keep checking, so the screen turns green by
  // itself once the link in the email is opened (no "I confirmed it" tap).
  const status = trpc.trust.status.useQuery(undefined, {
    refetchInterval: (query) => (query.state.data && !query.state.data.emailVerified ? 4000 : false),
  });
  const acceptTerms = trpc.trust.acceptCurrentTerms.useMutation();
  const sendEmail = trpc.trust.verification.sendEmail.useMutation();

  const [agreed, setAgreed] = useState(false);
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
  const allDone = Boolean(s?.acceptedCurrentTerms && s.emailVerified);

  // Coming back from the mail app: check right away instead of waiting for the next poll.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void utils.trust.status.invalidate();
    });
    return () => sub.remove();
  }, [utils]);

  return (
    <TrustScreen title="Verify your account">
      <Muted>To keep job seekers safe, every employer confirms their email address before posting. We do not check ID documents.</Muted>
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
            <Muted>We sent a confirmation link to {s?.email ?? "your email"}. Tap “Confirm my email” in that email. This screen updates by itself.</Muted>
            <View style={[trustStyles.row, { marginBottom: 12 }]}>
              <ActivityIndicator size="small" />
              <Muted>Waiting for you to confirm…</Muted>
            </View>
            <View style={trustStyles.row}>
              <Btn label={sendEmail.isSuccess ? "Link sent again" : "Send the link again"} tone="secondary" busy={sendEmail.isPending} onPress={() => run(sendEmail.mutateAsync())} />
            </View>
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
