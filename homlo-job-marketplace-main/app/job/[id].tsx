import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { getJob, useJobStore } from "@/components/job-store";
import JobDetailsScreen from "@/components/job-details/job-details-screen";
import { mapJobToDetails } from "@/components/job-details/map-job-to-details";
import { colors } from "@/components/job-details/colors";
import { type } from "@/components/job-details/typography";
import { usePublishedJobs } from "@/hooks/use-published-jobs";
import { useAuth } from "@/hooks/use-auth";
import { logJobEvent, isCanonicalJobId } from "@/lib/event-logging";
import { haptic } from "@/lib/haptics";

export default function JobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jobs: availableJobs, loading: liveJobsLoading } = usePublishedJobs();
  const job = availableJobs.find((candidate) => candidate.id === id) ?? getJob(id);
  const { isSaved, toggleSaved } = useJobStore();
  const { user } = useAuth();

  const canonical = isCanonicalJobId(id);
  const viewStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (!canonical) return;
    logJobEvent({ jobId: id, eventType: "view" });
    viewStartRef.current = Date.now();
    return () => {
      const duration = viewStartRef.current ? Date.now() - viewStartRef.current : 0;
      if (duration > 0) logJobEvent({ jobId: id, eventType: "view", dwellTimeMs: duration });
    };
  }, [canonical, id]);

  if (!job && liveJobsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.mint} />
        <Text style={styles.stateText}>Loading this opportunity…</Text>
      </View>
    );
  }
  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={styles.stateText}>This role is no longer available.</Text>
        <TouchableOpacity style={styles.backPill} onPress={() => router.back()}>
          <Text style={styles.backPillText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const saved = isSaved(job.id);
  const handleToggleSaved = () => {
    haptic.selection();
    if (!user) {
      router.push("/login" as never);
      return;
    }
    const savedNow = isSaved(job.id);
    logJobEvent({ jobId: job.id, eventType: savedNow ? "unsave" : "save" });
    toggleSaved(job.id);
  };

  return <JobDetailsScreen job={mapJobToDetails(job)} saved={saved} onToggleSaved={handleToggleSaved} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.background },
  stateText: { ...type.body, color: colors.ink, textAlign: "center", marginTop: 12 },
  backPill: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 14, paddingHorizontal: 18, paddingVertical: 10 },
  backPillText: { ...type.button, color: colors.mintDeep },
});