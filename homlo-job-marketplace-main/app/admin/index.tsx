import { useState } from "react";
import { Text, View } from "react-native";

import { Btn, Card, ErrorText, Input, Muted, TrustScreen, trustStyles } from "@/components/legal/TrustScreen";
import { trpc } from "@/lib/trpc";

type Tab = "review" | "reports" | "appeals" | "chargeback";
type Action = "approve" | "remove" | "warn" | "suspend" | "ban" | "reinstate" | "dismiss_report";

const message = (e: unknown) => (e instanceof Error && e.message ? e.message : "Action failed.");
const when = (v: unknown) => (v ? new Date(String(v)).toLocaleString() : "");

/**
 * /admin: moderation dashboard. Only accounts listed in admin_users can load
 * it (the server checks every call). Every action needs a written reason and
 * is stored in moderation_actions (who, what, when, why, plus a snapshot of
 * removed content).
 */
export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("review");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const utils = trpc.useUtils();
  const queue = trpc.trust.admin.reviewQueue.useQuery(undefined, { enabled: tab === "review" });
  const reports = trpc.trust.admin.reports.useQuery(undefined, { enabled: tab === "reports" });
  const appeals = trpc.trust.admin.appeals.useQuery(undefined, { enabled: tab === "appeals" });
  const evidence = trpc.trust.admin.chargebackEvidence.useQuery({ paymentRef: paymentRef.trim() }, { enabled: false, retry: false });
  const act = trpc.trust.admin.act.useMutation();
  const decide = trpc.trust.admin.decideAppeal.useMutation();

  const done = () => {
    setReason("");
    void utils.trust.admin.invalidate();
  };
  const doAction = (action: Action, targetType: "job" | "user" | "report", targetId: string, reportId?: string) => {
    setError(null);
    if (reason.trim().length < 3) return setError("Write the reason first. It is stored with the action and sent to the user.");
    act.mutateAsync({ action, targetType, targetId, reportId, reason: reason.trim() }).then(done).catch((e) => setError(message(e)));
  };

  const forbidden = [queue.error, reports.error, appeals.error].some((e) => e && /admins only/i.test(e.message));
  if (forbidden) {
    return (
      <TrustScreen title="Moderation">
        <Muted>This page is for moderators only.</Muted>
      </TrustScreen>
    );
  }

  return (
    <TrustScreen title="Moderation" maxWidth={980}>
      <View style={trustStyles.row}>
        {(["review", "reports", "appeals", "chargeback"] as Tab[]).map((t) => (
          <Btn key={t} label={{ review: "Review queue", reports: "Reports", appeals: "Appeals", chargeback: "Chargeback evidence" }[t]} tone={tab === t ? "primary" : "secondary"} onPress={() => setTab(t)} />
        ))}
      </View>

      {tab !== "chargeback" ? (
        <Input label="Reason for your next action (required, shown to the user)" value={reason} onChangeText={setReason} multiline />
      ) : null}
      <ErrorText>{error}</ErrorText>

      {tab === "review" ? (
        <>
          {queue.data?.length === 0 ? <Muted>Nothing waiting for review.</Muted> : null}
          {(queue.data as Record<string, unknown>[] | undefined)?.map((j) => (
            <Card key={String(j.id)} title={String(j.title ?? "(no title)")}>
              <Text style={{ color: "#B45309", fontWeight: "700" }}>Why: {(j.moderation_reasons as string[]).join("; ")}</Text>
              <Muted>
                {String(j.employer_name ?? "")} · {String(j.location_text ?? j.city ?? "")} · {String(j.pay_type)} {String(j.pay_amount ?? "")} {String(j.pay_currency ?? "")} · contact: {String(j.contact_method)} {String(j.contact_value ?? "")}
              </Muted>
              <Muted>Submitted {when(j.first_submitted_at)} · account created {when(j.account_created_at)}</Muted>
              <Text selectable>{String(j.description ?? "")}</Text>
              {j.requirements ? <Text selectable>Requirements: {String(j.requirements)}</Text> : null}
              <View style={trustStyles.row}>
                <Btn label="Approve" busy={act.isPending} onPress={() => doAction("approve", "job", String(j.id))} />
                <Btn label="Remove" tone="danger" busy={act.isPending} onPress={() => doAction("remove", "job", String(j.id))} />
                <Btn label="Warn poster" tone="secondary" onPress={() => doAction("warn", "user", String(j.employer_id))} />
                <Btn label="Suspend poster" tone="secondary" onPress={() => doAction("suspend", "user", String(j.employer_id))} />
                <Btn label="Ban poster" tone="danger" onPress={() => doAction("ban", "user", String(j.employer_id))} />
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {tab === "reports" ? (
        <>
          {reports.data?.length === 0 ? <Muted>No open reports.</Muted> : null}
          {(reports.data as Record<string, unknown>[] | undefined)?.map((r) => {
            const isJob = r.target_type === "job";
            const target = String(r.target_id);
            const rid = String(r.id);
            return (
              <Card key={rid} title={`${String(r.category)}: ${isJob ? "listing" : "profile"} “${String(r.target_label ?? target)}”`}>
                <Muted>Reported {when(r.created_at)} · current status: {String(r.target_status)}</Muted>
                {r.details ? <Text selectable>{String(r.details)}</Text> : null}
                <View style={trustStyles.row}>
                  {isJob ? <Btn label="Remove listing" tone="danger" onPress={() => doAction("remove", "job", target, rid)} /> : null}
                  {!isJob ? <Btn label="Warn" tone="secondary" onPress={() => doAction("warn", "user", target, rid)} /> : null}
                  {!isJob ? <Btn label="Suspend" tone="secondary" onPress={() => doAction("suspend", "user", target, rid)} /> : null}
                  {!isJob ? <Btn label="Ban" tone="danger" onPress={() => doAction("ban", "user", target, rid)} /> : null}
                  <Btn label="Dismiss" tone="secondary" onPress={() => doAction("dismiss_report", "report", rid)} />
                </View>
              </Card>
            );
          })}
        </>
      ) : null}

      {tab === "appeals" ? (
        <>
          {appeals.data?.length === 0 ? <Muted>No open appeals.</Muted> : null}
          {(appeals.data as Record<string, unknown>[] | undefined)?.map((a) => (
            <Card key={String(a.id)} title={`Appeal about ${String(a.target_type)} ${String(a.target_id ?? "(no reference)")}`}>
              <Muted>From {String(a.contact_email)} · {when(a.created_at)}</Muted>
              <Text selectable>{String(a.message)}</Text>
              <View style={trustStyles.row}>
                <Btn
                  label="Uphold (reverse decision)"
                  onPress={() =>
                    reason.trim().length < 3
                      ? setError("Write the reason first.")
                      : decide.mutateAsync({ appealId: String(a.id), upheld: true, reason }).then(done).catch((e) => setError(message(e)))
                  }
                />
                <Btn
                  label="Reject"
                  tone="danger"
                  onPress={() =>
                    reason.trim().length < 3
                      ? setError("Write the reason first.")
                      : decide.mutateAsync({ appealId: String(a.id), upheld: false, reason }).then(done).catch((e) => setError(message(e)))
                  }
                />
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {tab === "chargeback" ? (
        <Card title="Chargeback evidence">
          <Muted>Enter a payment id or the provider transaction id. You get the accepted terms (with time, IP, device), the listing, what was delivered and all timestamps.</Muted>
          <Input label="Payment reference" value={paymentRef} onChangeText={setPaymentRef} autoCapitalize="none" />
          <Btn label="Look up" disabled={paymentRef.trim().length < 3} busy={evidence.isFetching} onPress={() => void evidence.refetch()} />
          <ErrorText>{evidence.error ? message(evidence.error) : null}</ErrorText>
          {evidence.data ? <Text selectable style={{ fontFamily: "monospace", fontSize: 12 }}>{JSON.stringify(evidence.data, null, 2)}</Text> : null}
        </Card>
      ) : null}
    </TrustScreen>
  );
}
