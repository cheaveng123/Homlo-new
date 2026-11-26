import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "@/lib/router";
import { AppIcon } from "@/components/ui/AppIcon";

import { getJob } from "@/components/job-store";
import { JobLocationMap } from "@/components/job-location-map";
import { colors } from "@/components/job-details/colors";
import { type, fonts } from "@/components/job-details/typography";
import { defaultSearchCenter, jobCoordinate } from "@/lib/job-geography";
import { mockJobFor } from "@/lib/mock-job";
import { DEMO_CONTENT_ENABLED } from "@/lib/demo-content";
import { usePublishedJobs } from "@/hooks/use-published-jobs";

/**
 * Virtual map view for a single job: a read-only map pinned to the job's
 * location (reuses the existing JobLocationMap component — MapView on
 * native, MapLibre on web) wrapped in a small header + info card.
 */
export default function JobLocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jobs: availableJobs } = usePublishedJobs();
  const job = availableJobs.find((candidate) => candidate.id === id) ?? getJob(id) ?? (DEMO_CONTENT_ENABLED ? mockJobFor(id) : undefined);
  const isRemote = job?.arrangement === "Remote";
  // Remote roles have no site to show, so they never get a map pin.
  const coordinate = job && !isRemote ? jobCoordinate(job) : null;

  if (!job) {
    return (
      <SafeAreaView edges={["bottom", "left", "right"]} style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.stateText}>This role is no longer available.</Text>
          <TouchableOpacity style={styles.backPill} onPress={() => router.back()}>
            <Text style={styles.backPillText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isRemote) {
    return (
      <SafeAreaView edges={["bottom", "left", "right"]} style={styles.safe}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.iconCircle} onPress={() => router.back()}>
            <AppIcon name="back" size={18} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Job location
          </Text>
          <View style={styles.iconCircleSpacer} />
        </View>
        <View style={styles.center}>
          <Text style={styles.stateText}>This is a remote job — there is no office to show.</Text>
          <TouchableOpacity style={styles.backPill} onPress={() => router.back()}>
            <Text style={styles.backPillText}>Go back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.jobTitle} numberOfLines={1}>
            {job.title}
          </Text>
          <View style={styles.locationRow}>
            <AppIcon name="pin" size={14} color={colors.mintDeep} />
            <Text style={styles.locationText} numberOfLines={1}>
              {job.location}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!coordinate) {
    return (
      <SafeAreaView edges={["bottom", "left", "right"]} style={styles.safe}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.iconCircle} onPress={() => router.back()}>
            <AppIcon name="back" size={18} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Job location
          </Text>
          <View style={styles.iconCircleSpacer} />
        </View>
        <View style={styles.center}>
          <Text style={styles.stateText}>Location details are not available for this job.</Text>
          <TouchableOpacity style={styles.backPill} onPress={() => router.back()}>
            <Text style={styles.backPillText}>Go back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.jobTitle} numberOfLines={1}>
            {job.title}
          </Text>
          <View style={styles.locationRow}>
            <AppIcon name="pin" size={14} color={colors.mintDeep} />
            <Text style={styles.locationText} numberOfLines={1}>
              {job.location}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={styles.safe}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconCircle} onPress={() => router.back()}>
          <AppIcon name="back" size={18} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Job location
        </Text>
        <View style={styles.iconCircleSpacer} />
      </View>

      <View style={styles.mapWrap}>
        <JobLocationMap coordinate={coordinate} defaultCoordinate={defaultSearchCenter} category={job.category} onChange={() => {}} />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.jobTitle} numberOfLines={1}>
          {job.title}
        </Text>
        <View style={styles.locationRow}>
          <AppIcon name="pin" size={14} color={colors.mintDeep} />
          <Text style={styles.locationText} numberOfLines={1}>
            {job.location}
          </Text>
        </View>
        <Text style={styles.caption}>The role happens around this area — tap around the map to explore.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.mintTint,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleSpacer: { width: 34 },
  headerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    lineHeight: 21,
    color: colors.ink,
    flex: 1,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  mapWrap: { flex: 1, backgroundColor: colors.placeholderBg },
  infoCard: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  jobTitle: { ...type.h1, color: colors.ink },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  locationText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.ink,
    flex: 1,
  },
  caption: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 8,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.background },
  stateText: { ...type.body, color: colors.ink, textAlign: "center", marginTop: 12 },
  backPill: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 14, paddingHorizontal: 18, paddingVertical: 10 },
  backPillText: { ...type.button, color: colors.mintDeep },
});