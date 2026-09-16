import { useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { jobs } from "@/components/job-store";
import { ScreenContainer } from "@/components/screen-container";
import { Text } from "@/components/ui/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { localImageUris } from "@/lib/local-image-uris";

type Tab = "applied" | "invited" | "completed";
type GatewayApplication = { id: string; job_id: string; status: "applied" | "reviewed" | "interview" | "hired" | "declined" | "withdrawn"; message: string | null; created_at: string; updated_at: string; job_title: string; job_location_text: string | null; employer_id: string; employer_name: string | null };

function statusLabel(status: GatewayApplication["status"]) {
  if (status === "applied") return "Applied";
  if (status === "reviewed") return "Viewed";
  if (status === "interview") return "Interview";
  if (status === "hired") return "Hired";
  if (status === "declined") return "Rejected";
  if (status === "withdrawn") return "Withdrawn";
  return status;
}

function matchesTab(status: GatewayApplication["status"], tab: Tab) {
  if (tab === "applied") return status === "applied" || status === "reviewed";
  if (tab === "invited") return status === "interview";
  return status === "hired" || status === "declined" || status === "withdrawn";
}

function statusColor(status: GatewayApplication["status"]) {
  if (status === "applied") return "#0F7D5E";
  if (status === "reviewed") return "#6B7280";
  if (status === "interview") return "#2563EB";
  if (status === "hired") return "#0F7D5E";
  if (status === "declined") return "#DC2626";
  return "#6B7280";
}

function statusBg(status: GatewayApplication["status"]) {
  if (status === "applied") return "#EAF6F3";
  if (status === "reviewed") return "#F3F4F6";
  if (status === "interview") return "#EFF6FF";
  if (status === "hired") return "#EAF6F3";
  if (status === "declined") return "#FEF2F2";
  return "#F3F4F6";
}

export default function ApplicationsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const applications = trpc.homlo.applications.list.useQuery(undefined, { enabled: Boolean(user), refetchOnMount: true });
  const rows = ((applications.data as { applications?: GatewayApplication[] } | undefined)?.applications ?? []);
  const [tab, setTab] = useState<Tab>("applied");

  if (authLoading || applications.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color="#16803C" /></ScreenContainer>;
  if (!user) return <ScreenContainer className="items-center justify-center p-6"><IconSymbol name="person" size={28} color="#16803C" /><Text style={styles.emptyTitle}>Sign in to view applications</Text><Text style={styles.emptyCopy}>Your applications are linked to your secure Homlo account.</Text><Pressable onPress={() => router.replace("/login" as never)} style={styles.signIn}><Text style={styles.signInText}>Sign in</Text></Pressable></ScreenContainer>;

  const filtered = rows.filter((r) => matchesTab(r.status, tab));

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background">
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="chevron.left" size={18} color="#17201A" />
          </Pressable>
          <Text style={styles.title}>My Applications</Text>
        </View>
        <View style={styles.tabBar}>
          {(["applied", "invited", "completed"] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={styles.tab}>
              <Text style={[styles.tabText, tab === t && styles.tabActive]}>{t === "applied" ? "Applied" : t === "invited" ? "Invited" : "Completed"}</Text>
              {tab === t && <View style={styles.tabUnderline} />}
            </Pressable>
          ))}
        </View>
        <FlatList
          contentContainerStyle={styles.list}
          data={filtered}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <IconSymbol name="briefcase" size={26} color="#A8B5AF" />
              <Text style={styles.emptyTitle}>No applications here</Text>
              <Text style={styles.emptyText}>Applications in this category will appear here.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const matchedJob = jobs.find((j) => j.id === item.job_id);
            const uri = matchedJob ? (localImageUris[matchedJob.id] || matchedJob.image) : null;
            return (
              <Pressable onPress={() => router.push(`/applications/${item.id}` as never)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <View style={styles.imageWrap}>
                  {uri ? <Image resizeMode="cover" source={{ uri }} style={styles.image} /> : <View style={[styles.image, styles.imagePlaceholder]}><IconSymbol name="briefcase" size={18} color="#A8B5AF" /></View>}
                </View>
                <View style={styles.rowBody}>
                  <Text numberOfLines={1} style={styles.rowTitle}>{item.job_title}</Text>
                  <Text numberOfLines={1} style={styles.rowCompany}>{item.employer_name ?? "Employer"}</Text>
                  <View style={styles.rowBottom}>
                    <View style={[styles.badge, { backgroundColor: statusBg(item.status) }]}>
                      <Text style={[styles.badgeText, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
                    </View>
                    <Text style={styles.rowDate}>{new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={16} color="#C4CBC7" />
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { alignItems: "center", flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  backBtn: { alignItems: "center", backgroundColor: "#EDF1EE", borderRadius: 18, height: 34, justifyContent: "center", width: 34 },
  title: { color: "#17201A", fontSize: 18, fontWeight: "700" },
  tabBar: { borderBottomColor: "#E8ECE9", borderBottomWidth: 1, flexDirection: "row", marginTop: 12, paddingHorizontal: 16 },
  tab: { marginRight: 20, paddingBottom: 10 },
  tabText: { color: "#71847D", fontSize: 13, fontWeight: "500" },
  tabActive: { color: "#0F7D5E", fontWeight: "600" },
  tabUnderline: { backgroundColor: "#0F7D5E", borderRadius: 1, height: 2, marginTop: 6, width: "100%" },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },
  row: { alignItems: "center", borderBottomColor: "#F0F3F1", borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 11 },
  rowPressed: { opacity: 0.6 },
  imageWrap: { borderRadius: 8, overflow: "hidden" },
  image: { borderRadius: 8, height: 58, width: 58 },
  imagePlaceholder: { alignItems: "center", backgroundColor: "#EDF1EE", justifyContent: "center" },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { color: "#17201A", fontSize: 13.5, fontWeight: "600" },
  rowCompany: { color: "#53615D", fontSize: 12, marginTop: 1 },
  rowBottom: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 5 },
  badge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "600" },
  rowDate: { color: "#9CA3AF", fontSize: 11 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyTitle: { color: "#17201A", fontSize: 15, fontWeight: "600", marginTop: 12 },
  emptyCopy: { color: "#71847D", fontSize: 13, marginTop: 5, textAlign: "center" },
  emptyText: { color: "#71847D", fontSize: 13, marginTop: 5, textAlign: "center" },
  signIn: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 12, justifyContent: "center", marginTop: 18, minHeight: 44, paddingHorizontal: 20 },
  signInText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
