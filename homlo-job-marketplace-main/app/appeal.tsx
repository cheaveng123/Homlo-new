import { useState } from "react";
import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Btn, Card, ErrorText, Input, Muted, TrustScreen, trustStyles } from "@/components/legal/TrustScreen";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

/**
 * /appeal: for users whose listing was removed or whose account was
 * suspended/banned. Works without signing in (banned users cannot sign in).
 * Optional params: ?type=job|account&id=<uuid>
 */
export default function AppealScreen() {
  const params = useLocalSearchParams<{ type?: string; id?: string }>();
  const { user } = useAuth();
  const submit = trpc.trust.submitAppeal.useMutation();
  const [email, setEmail] = useState(user?.email ?? "");
  const [targetType, setTargetType] = useState<"job" | "account">(params.type === "job" ? "job" : "account");
  const [reference, setReference] = useState(typeof params.id === "string" ? params.id : "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const uuid = /^[0-9a-f-]{36}$/i;
  const valid = /\S+@\S+\.\S+/.test(email) && message.trim().length >= 10 && (!reference || uuid.test(reference.trim()));

  const send = () => {
    setError(null);
    submit
      .mutateAsync({ contactEmail: email.trim(), targetType, targetId: reference.trim() || undefined, message: message.trim() })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not send the appeal."));
  };

  if (submit.isSuccess) {
    return (
      <TrustScreen title="Appeal sent">
        <Card>
          <Text style={trustStyles.ok}>We received your appeal.</Text>
          <Muted>A person on our team will review it and reply by email.</Muted>
        </Card>
      </TrustScreen>
    );
  }

  return (
    <TrustScreen title="Appeal a decision">
      <Card>
        <Muted>
          If we removed your listing or suspended your account and you think it was a mistake, tell us why. Appeals are reviewed by a person.
        </Muted>
        <Input label="Your email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Text style={{ fontWeight: "600" }}>What are you appealing?</Text>
        <Btn label={targetType === "account" ? "● My account" : "○ My account"} tone="secondary" onPress={() => setTargetType("account")} />
        <Btn label={targetType === "job" ? "● A removed listing" : "○ A removed listing"} tone="secondary" onPress={() => setTargetType("job")} />
        <Input
          label="Listing or account reference (from our email, optional)"
          value={reference}
          onChangeText={setReference}
          autoCapitalize="none"
        />
        <Input label="Why should we reverse the decision?" value={message} onChangeText={setMessage} multiline maxLength={4000} />
        <ErrorText>{error}</ErrorText>
        <Btn label="Send appeal" onPress={send} disabled={!valid} busy={submit.isPending} />
      </Card>
    </TrustScreen>
  );
}
