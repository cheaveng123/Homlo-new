import { FlatList, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";

import { jobs, useJobStore } from "@/components/job-store";
import { JobCard } from "@/components/job-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { Text } from "@/components/ui/text";

export default function SavedScreen() {
  const router = useRouter();
  const { savedIds } = useJobStore();
  const savedJobs = jobs.filter((job) => savedIds.includes(job.id));

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background">
      <FlatList
        contentContainerStyle={styles.content}
        data={savedJobs}
        keyExtractor={(job) => job.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Saved jobs</Text>
            <View style={styles.tabs}>
              <View style={[styles.tab, styles.tabActive]}><Text style={styles.tabActiveText}>Saved</Text></View>
              <View style={styles.tab}><Text style={styles.tabText}>Viewed</Text></View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.iconWell}><IconSymbol name="heart" size={31} color="#08675F" /></View>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyText}>Tap the heart on any role to build your shortlist.</Text>
            <Pressable
              onPress={() => { haptic.light(); router.push("/jobs" as never); }}
              style={({ pressed }) => [styles.browseButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.browseText}>Browse jobs</Text>
              <IconSymbol name="arrow.right" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        }
        renderItem={({ item, index }) => <Animated.View entering={FadeInDown.delay(index * 45).duration(220)}><JobCard job={item} compact /></Animated.View>}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 18, paddingBottom: 28 },
  header: { marginBottom: 10, marginTop: 5 },
  title: { color: "#16211F", fontSize: 27, fontWeight: "800", letterSpacing: -0.8 },
  tabs: { borderBottomColor: "#E2E8E5", borderBottomWidth: 1, flexDirection: "row", gap: 26, marginTop: 18 },
  tab: { alignItems: "center", paddingBottom: 11, paddingHorizontal: 6 },
  tabActive: { borderBottomColor: "#0F7D5E", borderBottomWidth: 2 },
  tabText: { color: "#94A098", fontSize: 12.5, fontWeight: "600" },
  tabActiveText: { color: "#0F7D5E", fontSize: 12.5, fontWeight: "800" },
  emptyState: { alignItems: "center", backgroundColor: "#F0F8F6", borderRadius: 23, marginTop: 25, paddingHorizontal: 25, paddingVertical: 35 },
  iconWell: { alignItems: "center", backgroundColor: "#DDF1EC", borderRadius: 34, height: 68, justifyContent: "center", width: 68 },
  emptyTitle: { color: "#16211F", fontSize: 18, fontWeight: "800", marginTop: 17 },
  emptyText: { color: "#64716E", fontSize: 13.5, lineHeight: 19, marginTop: 7, textAlign: "center" },
  browseButton: { alignItems: "center", backgroundColor: "#08675F", borderRadius: 13, flexDirection: "row", gap: 8, marginTop: 21, paddingHorizontal: 18, paddingVertical: 12 },
  browseText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  buttonPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
});
