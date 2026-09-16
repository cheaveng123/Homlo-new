import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { getJob } from "@/components/job-store";
import ApplyScreen from "@/components/job-details/apply-screen";
import { mapJobToDetails } from "@/components/job-details/map-job-to-details";
import { colors } from "@/components/job-details/colors";
import { type } from "@/components/job-details/typography";
import { usePublishedJobs } from "@/hooks/use-published-jobs";
import { logJobEvent, isCanonicalJobId } from "@/lib/event-logging";

export default function ApplyRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jobs: availableJobs, loading: liveJobsLoading } = usePublishedJobs();
  const job = availableJobs.find((candidate) => candidate.id === id) ?? getJob(id);

  const canonical = isCanonicalJobId(id);
  useEffect(() => {
    if (canonical) logJobEvent({ jobId: id, eventType: "apply_started" });
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

  return <ApplyScreen job={mapJobToDetails(job)} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.background },
  stateText: { ...type.body, color: colors.ink, textAlign: "center", marginTop: 12 },
  backPill: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 14, paddingHorizontal: 18, paddingVertical: 10 },
  backPillText: { ...type.button, color: colors.mintDeep },
});