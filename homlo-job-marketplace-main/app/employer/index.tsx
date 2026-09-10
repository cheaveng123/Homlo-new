import { useMemo, useState } from "react";
import { FlatList, Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/hooks/use-auth";
import { usePressLock } from "@/hooks/use-press-lock";
import { getBoostPlan, type BoostPlanId } from "@/lib/boost";
import { trpc } from "@/lib/trpc";

type GatewayJob = { id: string; title: string; description: string; pay_amount: number | string; pay_currency: string; pay_type: "hourly" | "daily" | "fixed"; location_text: string | null; status: "draft" | "open" | "filled" | "closed" | "expired" | "cancelled"; workers_needed: number; workers_hired: number; latitude: number | null; longitude: number | null; address_line: string | null; city: string | null; district: string | null; province: string | null; country: string | null; postal_code: string | null; banner_image: string | null; boost_id: string | null; boost_package: string | null; boost_expires_at: string | null };

type HubTab = "active" | "drafts" | "closed";

function jobPay(job: GatewayJob) {
  const interval = job.pay_type === "hourly" ? "hour" : job.pay_type === "daily" ? "day" : "project";
  return `${job.pay_currency} ${Number(job.pay_amount).toLocaleString()} / ${interval}`;
}

function statusLabel(status: GatewayJob["status"]) {
  return status === "open" ? "Live" : status[0].toUpperCase() + status.slice(1);
}

/** A listing shows its uploaded banner when present, else a title-based stock image. */
function listingImage(job: GatewayJob) {
  return job.banner_image?.trim() || jobImageForTitle(job.title);
}

export default function EmployerHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const profileQuery = trpc.homlo.profile.get.useQuery(undefined, { enabled: Boolean(user) });
  const profile = ((profileQuery.data as { profile?: { role: "worker" | "employer" | "both" } | null } | undefined)?.profile ?? null);
  const isWorkerOnly = Boolean(user) && profile?.role === "worker";
  const jobsQuery = trpc.homlo.employer.jobs.useQuery(undefined, { enabled: Boolean(user) && !isWorkerOnly });
  const deleteJob = trpc.homlo.employer.deleteJob.useMutation();
  const serviceData = jobsQuery.data as { jobs?: GatewayJob[] } | undefined;
  const listings = useMemo(() => serviceData?.jobs ?? [], [serviceData?.jobs]);
  const [tab, setTab] = useState<HubTab>("active");
  const openNewJob = usePressLock(() => { router.push("/post-job" as never); });

  const activeListings = useMemo(() => listings.filter((job) => job.status === "open"), [listings]);
  const draftListings = useMemo(() => listings.filter((job) => job.status === "draft"), [listings]);
  const closedListings = useMemo(() => listings.filter((job) => job.status === "filled" || job.status === "closed" || job.status === "expired" || job.status === "cancelled"), [listings]);

  const visibleListings = useMemo(() => (tab === "active" ? activeListings : tab === "drafts" ? draftListings : closedListings), [tab, activeListings, draftListings, closedListings]);
  const tabEmptyCopy = tab === "drafts" ? "No drafts yet" : tab === "closed" ? "No closed listings" : "No listed jobs yet";

  const openBoost = (job: GatewayJob) => {
    router.push({ pathname: "/employer/boost/[id]", params: { id: job.id, title: job.title, company: user?.name ?? "Your company", city: job.location_text ?? "Remote", salary: jobPay(job) } } as never);
  };

  const removeDraft = (jobId: string) => {
    void deleteJob.mutateAsync({ jobId }).then(() => jobsQuery.refetch());
  };

  if (authLoading || profileQuery.isLoading) {
    return <ScreenContainer className="flex-1" containerClassName="bg-background"><View style={styles.gateScreen}>{[1, 2].map((key) => <View key={key} style={styles.loadingRow}><View style={styles.loadingImage} /><View style={styles.loadingCopy}><View style={styles.loadingLine} /><View style={[styles.loadingLine, styles.loadingShort]} /><View style={[styles.loadingLine, styles.loadingMeta]} /></View><View style={styles.loadingAction} /></View>)}</View></ScreenContainer>;
  }

  if (!user) {
    return <ScreenContainer className="flex-1" containerClassName="bg-background"><View style={styles.gateScreen}><SignedOutState onSignIn={() => router.replace("/login" as never)} /></View></ScreenContainer>;
  }

  if (isWorkerOnly) {
    return <ScreenContainer className="flex-1" containerClassName="bg-background"><View style={styles.gateScreen}><View style={styles.empty}><IconSymbol name="briefcase.fill" size={24} color="#16803C" /><Text style={styles.emptyTitle}>Employer access required</Text><Text style={styles.emptyText}>Your account is set to Worker. Switch to Both or Employer in your profile to manage job listings.</Text><ScalePressable hapticFeedback onPress={() => router.replace("/profile" as never)} style={styles.signInButton}><Text style={styles.signInText}>Update your role</Text></ScalePressable></View></View></ScreenContainer>;
  }

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background">
      <View style={styles.screen}>
        <FlatList
          contentContainerStyle={styles.content}
          data={visibleListings}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={authLoading || jobsQuery.isLoading ? <LoadingRows /> : !user ? <SignedOutState onSignIn={() => router.replace("/login" as never)} /> : <EmptyListings title={tabEmptyCopy} />}
          ListHeaderComponent={<View style={styles.header}><ScalePressable accessibilityLabel="Back to Home" hapticFeedback onPress={() => router.replace("/" as never)} style={styles.backLink}><IconSymbol name="chevron.left" size={19} color="#405148" /><Text style={styles.backLinkText}>Home</Text></ScalePressable><Text style={styles.title}>Listed Jobs</Text><Text style={styles.subtitle}>Manage the opportunities your company has created.</Text><View style={styles.tabs}><ScalePressable hapticFeedback onPress={() => setTab("active")} style={[styles.tabChip, tab === "active" && styles.tabChipActive]}><Text style={[styles.tabChipText, tab === "active" && styles.tabChipTextActive]}>Live ({activeListings.length})</Text></ScalePressable><ScalePressable hapticFeedback onPress={() => setTab("drafts")} style={[styles.tabChip, tab === "drafts" && styles.tabChipActive]}><Text style={[styles.tabChipText, tab === "drafts" && styles.tabChipTextActive]}>Drafts ({draftListings.length})</Text></ScalePressable><ScalePressable hapticFeedback onPress={() => setTab("closed")} style={[styles.tabChip, tab === "closed" && styles.tabChipActive]}><Text style={[styles.tabChipText, tab === "closed" && styles.tabChipTextActive]}>Closed ({closedListings.length})</Text></ScalePressable></View><View style={styles.listHeading}><Text style={styles.listHeadingText}>{authLoading || jobsQuery.isLoading ? "LOADING" : visibleListings.length ? `YOUR LISTINGS · ${tab.toUpperCase()}` : "NO LISTINGS"}</Text></View></View>}
          renderItem={({ item }) => <EmployerListingRow job={item} tab={tab} onBoost={() => openBoost(item)} onOpen={() => tab === "drafts" ? router.push({ pathname: "/post-job", params: { jobId: item.id } } as never) : router.push({ pathname: "/employer/job/[id]", params: { id: item.id } } as never)} onDelete={tab === "drafts" ? () => removeDraft(item.id) : undefined} />}
          showsVerticalScrollIndicator={false}
        />
        <ScalePressable accessibilityLabel="Create a new job listing" hapticFeedback onPress={() => user && !authLoading ? openNewJob() : router.replace("/login" as never)} style={[styles.fab, { bottom: Math.max(insets.bottom, 12) + 18 }]}><IconSymbol name="plus" size={24} color="#FFFFFF" /></ScalePressable>
      </View>
    </ScreenContainer>
  );
}

function payIntervalLabel(type: GatewayJob["pay_type"]) {
  return type === "hourly" ? "Hourly" : type === "daily" ? "Daily" : "Fixed-term";
}

function statusTone(status: GatewayJob["status"]) {
  if (status === "open") return { bg: "#EAF6EC", text: "#16803C" };
  if (status === "draft") return { bg: "#F5EFDF", text: "#8A6412" };
  return { bg: "#F1F4F2", text: "#526158" };
}

function EmployerListingRow({ job, tab, onBoost, onOpen, onDelete }: { job: GatewayJob; tab: HubTab; onBoost: () => void; onOpen: () => void; onDelete?: () => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 480;
  const tone = statusTone(job.status);
  const hires = job.workers_needed > 0 ? ` · ${job.workers_hired} of ${job.workers_needed} hired` : "";
  const boostedPlan = job.boost_id && job.boost_package ? getBoostPlan(job.boost_package as BoostPlanId) : null;
  const boostExpires = job.boost_id && job.boost_expires_at ? ` · ends ${new Date(job.boost_expires_at).toLocaleDateString()}` : "";
  return (
    <View style={styles.jobCard}>
      <ScalePressable accessibilityLabel={`Open ${job.title}`} hapticFeedback onPress={onOpen} style={styles.cardMain}>
        <Image accessibilityLabel={`${job.title} workplace`} resizeMode="cover" source={{ uri: listingImage(job) }} style={[styles.jobImage, compact && styles.jobImageCompact]} />
        <View style={styles.textBlock}>
          <View style={styles.titleRow}>
            <Text numberOfLines={2} style={[styles.jobTitle, compact && styles.jobTitleCompact]}>{job.title}</Text>
            <View style={[styles.statusPill, { backgroundColor: tone.bg }]}><Text style={[styles.statusPillText, { color: tone.text }]}>{statusLabel(job.status)}</Text></View>
          </View>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>PAY RATE</Text>
            <Text style={[styles.jobPay, compact && styles.jobPayCompact]}>{jobPay(job)}</Text>
          </View>
          <Text numberOfLines={1} style={styles.metadata}>{job.location_text || "Remote"} · {payIntervalLabel(job.pay_type)}{tab === "drafts" ? " · Drafts are only visible to you" : hires}</Text>
          {boostedPlan ? <View style={styles.boostTag}><IconSymbol name="star.fill" size={12} color="#16803C" /><Text numberOfLines={1} style={styles.boostTagText}>Boosted · {boostedPlan.name} · {boostedPlan.duration}{boostExpires}</Text></View> : null}
        </View>
      </ScalePressable>
      <View style={styles.actionsRow}>
        {tab === "drafts" && onDelete ? (
          <ScalePressable accessibilityLabel={`Delete draft ${job.title}`} hapticFeedback onPress={onDelete} style={[styles.boostButton, styles.deleteButton, compact && styles.boostButtonCompact]}>
            <Text style={[styles.boostText, styles.deleteText, compact && styles.boostTextCompact]}>Delete</Text>
          </ScalePressable>
        ) : null}
        <ScalePressable accessibilityLabel={`Boost ${job.title}`} hapticFeedback onPress={onBoost} style={[styles.boostButton, compact && styles.boostButtonCompact]}>
          <Text style={[styles.boostText, compact && styles.boostTextCompact]}>{boostedPlan ? "Change Boost" : "Boost"}</Text>
        </ScalePressable>
      </View>
    </View>
  );
}

function LoadingRows() { return <View>{[1, 2].map((key) => <View key={key} style={styles.loadingRow}><View style={styles.loadingImage} /><View style={styles.loadingCopy}><View style={styles.loadingLine} /><View style={[styles.loadingLine, styles.loadingShort]} /><View style={[styles.loadingLine, styles.loadingMeta]} /></View><View style={styles.loadingAction} /></View>)}</View>; }
function EmptyListings({ title }: { title: string }) { return <View style={styles.empty}><IconSymbol name="briefcase.fill" size={24} color="#16803C" /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>Use the plus button to create the first opportunity for your company.</Text></View>; }
function SignedOutState({ onSignIn }: { onSignIn: () => void }) { return <View style={styles.empty}><IconSymbol name="person.fill" size={24} color="#16803C" /><Text style={styles.emptyTitle}>Sign in to manage jobs</Text><Text style={styles.emptyText}>Your published listings and applicants are protected by your Homlo account.</Text><ScalePressable hapticFeedback onPress={onSignIn} style={styles.signInButton}><Text style={styles.signInText}>Sign in</Text></ScalePressable></View>; }
function jobImageForTitle(title: string) { const value = title.toLowerCase(); if (value.includes("restaurant") || value.includes("coffee") || value.includes("kitchen")) return "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=240&q=80"; if (value.includes("retail")) return "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=240&q=80"; if (value.includes("technology") || value.includes("design") || value.includes("developer")) return "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=240&q=80"; return "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=240&q=80"; }

const styles = StyleSheet.create({
  screen: { flex: 1, position: "relative" }, gateScreen: { flex: 1, justifyContent: "center", padding: 20 }, content: { padding: 20, paddingBottom: 110 }, header: { paddingTop: 3 }, backLink: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 1, marginBottom: 14, paddingVertical: 4 }, backLinkText: { color: "#405148", fontSize: 12.5, fontWeight: "600" }, title: { color: "#17201A", fontSize: 27, fontWeight: "700", letterSpacing: -0.75 }, subtitle: { color: "#66736A", fontSize: 13, lineHeight: 18, marginTop: 6 }, listHeading: { borderBottomColor: "#E2E8E5", borderBottomWidth: 1, marginTop: 24, paddingBottom: 10 }, listHeadingText: { color: "#66736A", fontSize: 10.5, fontWeight: "700", letterSpacing: 0.75 }, tabs: { flexDirection: "row", gap: 8, marginTop: 18 }, tabChip: { alignItems: "center", backgroundColor: "#F1F5F3", borderRadius: 999, justifyContent: "center", minHeight: 34, paddingHorizontal: 14 }, tabChipActive: { backgroundColor: "#0E6B5A" }, tabChipText: { color: "#66736A", fontSize: 12, fontWeight: "700" }, tabChipTextActive: { color: "#FFFFFF" }, jobCard: { backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 14, borderWidth: 1, marginBottom: 12, padding: 12 }, cardMain: { alignItems: "center", flexDirection: "row" }, jobImage: { backgroundColor: "#E8F0EC", borderRadius: 12, height: 100, width: 100 }, jobImageCompact: { borderRadius: 10, height: 80, width: 80 }, textBlock: { flex: 1, minWidth: 0, paddingLeft: 12 }, titleRow: { alignItems: "flex-start", flexDirection: "row" }, jobTitle: { color: "#17201A", flex: 1, fontSize: 17, fontWeight: "800", letterSpacing: -0.35, lineHeight: 22 }, jobTitleCompact: { fontSize: 15, lineHeight: 19 }, statusPill: { borderRadius: 999, flexShrink: 0, marginLeft: 8, marginTop: 2, paddingHorizontal: 8, paddingVertical: 3 }, statusPillText: { fontSize: 10, fontWeight: "700" }, payRow: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 6 }, payLabel: { color: "#83918A", fontSize: 9, fontWeight: "700", letterSpacing: 0.7 }, jobPay: { color: "#16803C", fontSize: 16.5, fontWeight: "800", letterSpacing: -0.35 }, jobPayCompact: { fontSize: 14.5 }, metadata: { color: "#68756F", fontSize: 10.5, lineHeight: 15, marginTop: 5 }, boostTag: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#EAF7EF", borderColor: "#BEE7C9", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, marginTop: 9, maxWidth: "100%", paddingHorizontal: 9, paddingVertical: 4 }, boostTagText: { color: "#16803C", flexShrink: 1, fontSize: 10.5, fontWeight: "800" }, actionsRow: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 12, paddingTop: 1 }, boostButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 10, elevation: 3, justifyContent: "center", minHeight: 40, paddingHorizontal: 20, shadowColor: "#16803C", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 8 }, boostButtonCompact: { borderRadius: 9, minHeight: 36, paddingHorizontal: 16 }, boostText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", letterSpacing: 0.1 }, boostTextCompact: { fontSize: 12 }, deleteButton: { backgroundColor: "#FFFFFF", borderColor: "#D9C4C4", borderWidth: 1, elevation: 0, shadowOpacity: 0 }, deleteText: { color: "#B54242" }, empty: { alignItems: "center", paddingHorizontal: 32, paddingTop: 54 }, emptyTitle: { color: "#17201A", fontSize: 17, fontWeight: "700", marginTop: 11 }, emptyText: { color: "#66736A", fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: "center" }, signInButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 12, justifyContent: "center", marginTop: 16, minHeight: 46, paddingHorizontal: 21 }, signInText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "800" }, fab: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 28, elevation: 5, height: 56, justifyContent: "center", position: "absolute", right: 20, shadowColor: "#0F5C2B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, width: 56 }, loadingRow: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 14, borderWidth: 1, flexDirection: "row", marginBottom: 12, minHeight: 124, padding: 12 }, loadingImage: { backgroundColor: "#E8EDEA", borderRadius: 12, height: 100, marginRight: 12, width: 100 }, loadingCopy: { flex: 1 }, loadingLine: { backgroundColor: "#E8EDEA", borderRadius: 4, height: 11, marginBottom: 9, width: "78%" }, loadingShort: { width: "40%" }, loadingMeta: { marginTop: 6, width: "90%" }, loadingAction: { backgroundColor: "#E8EDEA", borderRadius: 10, height: 40, marginLeft: 10, width: 84 },
});
