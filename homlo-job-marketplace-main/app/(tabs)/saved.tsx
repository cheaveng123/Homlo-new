import { FlatList, Pressable, StyleSheet, View } from "react-native";
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
            <Text style={styles.eyebrow}>Your shortlist</Text>
            <Text style={styles.title}>Saved jobs</Text>
            <Text style={styles.subtitle}>Keep opportunities here so you can return when you are ready.</Text>
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
        renderItem={({ item }) => <JobCard job={item} />}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, paddingBottom: 28 },
  header: { marginBottom: 19, marginTop: 5 },
  eyebrow: { color: "#08675F", fontSize: 13, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  title: { color: "#16211F", fontSize: 28, fontWeight: "800", letterSpacing: -0.8, marginTop: 5 },
  subtitle: { color: "#64716E", fontSize: 14, lineHeight: 20, marginTop: 7, maxWidth: 300 },
  emptyState: { alignItems: "center", backgroundColor: "#F0F8F6", borderRadius: 23, marginTop: 25, paddingHorizontal: 25, paddingVertical: 35 },
  iconWell: { alignItems: "center", backgroundColor: "#DDF1EC", borderRadius: 34, height: 68, justifyContent: "center", width: 68 },
  emptyTitle: { color: "#16211F", fontSize: 18, fontWeight: "800", marginTop: 17 },
  emptyText: { color: "#64716E", fontSize: 13.5, lineHeight: 19, marginTop: 7, textAlign: "center" },
  browseButton: { alignItems: "center", backgroundColor: "#08675F", borderRadius: 13, flexDirection: "row", gap: 8, marginTop: 21, paddingHorizontal: 18, paddingVertical: 12 },
  browseText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  buttonPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
});
