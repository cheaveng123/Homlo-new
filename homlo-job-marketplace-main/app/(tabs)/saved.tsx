import { useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { jobs, type Job, useJobStore } from "@/components/job-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { Text } from "@/components/ui/text";
import { localImageUris } from "@/lib/local-image-uris";

type Tab = "saved" | "viewed";

export default function SavedScreen() {
  const router = useRouter();
  const { savedIds, toggleSaved } = useJobStore();
  const [tab, setTab] = useState<Tab>("saved");
  const savedJobs = jobs.filter((job) => savedIds.includes(job.id));

  const data = tab === "saved" ? savedJobs : [];

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background">
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Saved Jobs</Text>
        </View>
        <View style={styles.tabBar}>
          <Pressable onPress={() => setTab("saved")} style={styles.tab}>
            <Text style={[styles.tabText, tab === "saved" && styles.tabActive]}>Saved</Text>
            {tab === "saved" && <View style={styles.tabUnderline} />}
          </Pressable>
          <Pressable onPress={() => setTab("viewed")} style={styles.tab}>
            <Text style={[styles.tabText, tab === "viewed" && styles.tabActive]}>Viewed</Text>
            {tab === "viewed" && <View style={styles.tabUnderline} />}
          </Pressable>
        </View>
        <FlatList
          contentContainerStyle={styles.list}
          data={data}
          keyExtractor={(job) => job.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <IconSymbol name="bookmark" size={28} color="#A8B5AF" />
              <Text style={styles.emptyTitle}>{tab === "saved" ? "No saved jobs yet" : "No viewed jobs yet"}</Text>
              <Text style={styles.emptyText}>{tab === "saved" ? "Tap the bookmark on any role to build your shortlist." : "Jobs you view will appear here."}</Text>
            </View>
          }
          renderItem={({ item }) => <SavedRow job={item} saved onToggle={() => { haptic.selection(); toggleSaved(item.id); }} onPress={() => { haptic.light(); router.push({ pathname: "/job/[id]", params: { id: item.id } } as never); }} />}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </ScreenContainer>
  );
}

function SavedRow({ job, saved, onToggle, onPress }: { job: Job; saved: boolean; onToggle: () => void; onPress: () => void }) {
  const uri = localImageUris[job.id] || job.image;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.imageWrap}>
        {uri ? <Image resizeMode="cover" source={{ uri }} style={styles.image} /> : <View style={[styles.image, styles.imagePlaceholder]} />}
      </View>
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={styles.rowTitle}>{job.title}</Text>
        <Text numberOfLines={1} style={styles.rowCompany}>{job.company}</Text>
        <Text numberOfLines={1} style={styles.rowMeta}>{job.pay} · {job.location.split(",")[0]}</Text>
        <View style={styles.rowBottom}>
          <View style={styles.tagPill}>
            <Text style={styles.tagText}>{job.tag}</Text>
          </View>
          <Pressable accessibilityLabel={saved ? "Unsave job" : "Save job"} hitSlop={8} onPress={(e) => { e.stopPropagation(); onToggle(); }}>
            <IconSymbol name={saved ? "heart.fill" : "heart"} size={18} color={saved ? "#E53E3E" : "#A8B5AF"} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  title: { color: "#17201A", fontSize: 20, fontWeight: "700" },
  tabBar: { borderBottomColor: "#E8ECE9", borderBottomWidth: 1, flexDirection: "row", marginTop: 12, paddingHorizontal: 16 },
  tab: { marginRight: 24, paddingBottom: 10 },
  tabText: { color: "#71847D", fontSize: 14, fontWeight: "500" },
  tabActive: { color: "#0F7D5E", fontWeight: "600" },
  tabUnderline: { backgroundColor: "#0F7D5E", borderRadius: 1, height: 2, marginTop: 6, width: "100%" },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },
  row: { borderBottomColor: "#F0F3F1", borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingVertical: 12 },
  rowPressed: { opacity: 0.65 },
  imageWrap: { borderRadius: 10, overflow: "hidden" },
  image: { borderRadius: 10, height: 65, width: 65 },
  imagePlaceholder: { backgroundColor: "#E8F5EE" },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { color: "#17201A", fontSize: 14, fontWeight: "600" },
  rowCompany: { color: "#53615D", fontSize: 12, marginTop: 1 },
  rowMeta: { color: "#71847D", fontSize: 11, marginTop: 2 },
  rowBottom: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
  tagPill: { backgroundColor: "#EAF6F3", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: "#0F7D5E", fontSize: 10, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyTitle: { color: "#17201A", fontSize: 15, fontWeight: "600", marginTop: 12 },
  emptyText: { color: "#71847D", fontSize: 13, marginTop: 5, textAlign: "center" },
});
