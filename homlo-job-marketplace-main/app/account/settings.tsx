import { useState } from "react";
import { Alert, Linking, Platform, Share, Text } from "react-native";
import { useRouter } from "@/lib/router";

import { ConsentCheckbox } from "@/components/legal/LegalUI";
import { Btn, Card, ErrorText, Muted, TrustScreen, trustStyles } from "@/components/legal/TrustScreen";
import { useAuth } from "@/hooks/use-auth";
import { CONSENT_WORDING } from "@/lib/legal/consent-wording";
import { trpc } from "@/lib/trpc";

const message = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.");
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

const STORE_SUBSCRIPTIONS_URL = Platform.OS === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions";

/** /account/settings: edit profile, subscription (renewal date + one-click cancel), marketing, export, delete. */
export default function AccountSettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const utils = trpc.useUtils();
  const status = trpc.trust.status.useQuery();
  const sub = trpc.trust.subscription.useQuery();
  const cancel = trpc.trust.cancelSubscription.useMutation();
  const resume = trpc.trust.resumeSubscription.useMutation();
  const setMarketing = trpc.trust.setMarketing.useMutation();
  const exportData = trpc.trust.exportMyData.useMutation();
  const deleteAccount = trpc.homlo.account.delete.useMutation();
  const [error, setError] = useState<string | null>(null);

  const run = (p: Promise<unknown>) => {
    setError(null);
    p.then(() => Promise.all([utils.trust.subscription.invalidate(), utils.trust.status.invalidate()])).catch((e) => setError(message(e)));
  };

  const download = async () => {
    setError(null);
    try {
      const data = await exportData.mutateAsync();
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `homlo-my-data-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ title: "My Homlo data", message: json });
      }
    } catch (e) {
      setError(message(e));
    }
  };

  const confirmDelete = () => {
    const go = () =>
      deleteAccount
        .mutateAsync({ confirm: "DELETE" })
        .then(async () => {
          await logout();
          router.replace("/login" as never);
        })
        .catch((e) => setError(message(e)));
    const text =
      "Your profile and listings are removed now and the rest of your data is deleted or anonymized within 90 days. Consent and moderation records are kept as the Privacy Policy explains. App Store / Google Play subscriptions must be cancelled in the store.";
    if (Platform.OS === "web") {
      if (globalThis.confirm?.(`Delete your account?\n\n${text}`)) void go();
    } else {
      Alert.alert("Delete your account?", text, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: () => void go() },
      ]);
    }
  };

  const s = sub.data;
  return (
    <TrustScreen title="Privacy, data & subscription">
      <ErrorText>{error}</ErrorText>

      <Card title="Profile">
        <Muted>Change your name, photo, phone and other details.</Muted>
        <Btn label="Edit profile" tone="secondary" onPress={() => router.push("/profile/edit" as never)} />
      </Card>

      <Card title="Subscription">
        {!s || s.plan === "free" ? (
          <Muted>You are on the free plan. Nothing renews.</Muted>
        ) : (
          <>
            <Text style={{ fontWeight: "700" }}>{s.plan[0].toUpperCase() + s.plan.slice(1)} plan</Text>
            {s.renewsAt ? <Muted>Renews automatically on {day(s.renewsAt)}. We email you a reminder a few days before.</Muted> : null}
            {s.endsAt ? <Muted>Cancelled. Your plan stays active until {day(s.endsAt)} and will not renew.</Muted> : null}
            {s.managedByStore ? (
              <>
                <Muted>This subscription was bought through the app store, so it is cancelled there.</Muted>
                <Btn label="Manage in the app store" tone="secondary" onPress={() => void Linking.openURL(STORE_SUBSCRIPTIONS_URL)} />
              </>
            ) : s.cancelAtPeriodEnd ? (
              <Btn label="Keep my subscription" tone="secondary" busy={resume.isPending} onPress={() => run(resume.mutateAsync())} />
            ) : (
              <Btn label="Cancel subscription" tone="danger" busy={cancel.isPending} onPress={() => run(cancel.mutateAsync())} />
            )}
          </>
        )}
      </Card>

      <Card title="Emails">
        <ConsentCheckbox
          label={CONSENT_WORDING.marketing}
          required={false}
          checked={Boolean(status.data?.marketingOptIn)}
          onChange={(optIn) => run(setMarketing.mutateAsync({ optIn }))}
        />
        <Muted>Account, security, receipt and safety emails are always sent.</Muted>
      </Card>

      <Card title="Your data">
        <Muted>Download a copy of everything we hold about you, as a JSON file.</Muted>
        <Btn label="Download my data" tone="secondary" busy={exportData.isPending} onPress={() => void download()} />
      </Card>

      <Card title="Delete account">
        <Muted>Permanently close your account. This cannot be undone.</Muted>
        <Btn label="Delete my account" tone="danger" busy={deleteAccount.isPending} onPress={confirmDelete} />
      </Card>

      {status.data?.accountStatus && status.data.accountStatus !== "active" ? (
        <Text style={trustStyles.ok}>Your account is {status.data.accountStatus}. You can appeal at /appeal.</Text>
      ) : null}
    </TrustScreen>
  );
}
