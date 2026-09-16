import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import ImagePlaceholder from "./image-placeholder";
import Badge from "./badge";
import StatsStrip from "./stats-strip";
import RequirementsList from "./requirements-list";
import EmployerCard from "./employer-card";
import { colors } from "./colors";
import { type, fonts } from "./typography";
import type { JobDetails } from "./types";
import { haptic } from "@/lib/haptics";

type Props = {
  job: JobDetails;
  saved?: boolean;
  onToggleSaved?: () => void;
  onShare?: () => void;
};

const COVER_HEIGHT = 300;

export default function JobDetailsScreen({ job, saved = false, onToggleSaved, onShare }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const badges = [...new Set([job.scheduleType, job.employmentType])];
  const priceUnit = job.salaryUnit ?? "/mo";

  const applyNow = () => {
    haptic.light();
    router.push({ pathname: "/job/[id]/apply", params: { id: job.id, from: "detail" } } as never);
  };

  return (
    // The top edge is left, right and bottom only — the cover image bleeds
    // to the very top of the device (included: status-bar area), and the
    // floating controls sit just below the top inset.
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.headerBar, { top: insets.top + 12 }]}>
          <TouchableOpacity style={styles.iconCircle} onPress={() => router.back()}>
            <Feather name="arrow-left" size={18} color={colors.ink} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconCircle} onPress={onToggleSaved}>
              <Feather name="heart" size={17} color={saved ? colors.mint : colors.ink} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconCircle} onPress={onShare}>
              <Feather name="share-2" size={16} color={colors.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {job.coverImageUrl ? (
          // IMAGE: job cover photo — full-bleed hero at the top of the page.
          <Image
            resizeMode="cover"
            source={{ uri: job.coverImageUrl }}
            style={styles.coverImage}
          />
        ) : (
          // IMAGE: job cover photo — ImagePlaceholder is the fallback for
          // listings with no uploaded banner.
          <ImagePlaceholder
            height={COVER_HEIGHT}
            borderRadius={COVER_HEIGHT * 0.15}
            label="Cover image"
          />
        )}

        {/* Separator between the cover image and the information section. */}
        <View style={styles.divider} />
        <View style={{ height: 10 }} />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            {job.companyLogoUrl ? (
              <Image source={{ uri: job.companyLogoUrl }} style={styles.logo} />
            ) : (
              <ImagePlaceholder width={55} height={55} borderRadius={14} icon="briefcase" style={{ marginRight: 13 }} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={type.h1}>{job.title}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {job.companyName} · {job.location}
              </Text>
            </View>
          </View>

          <View style={styles.badgeRow}>
            {badges.map((badge) => (
              <Badge key={badge} label={badge} />
            ))}
            {job.spotsRemaining != null && job.spotsRemaining <= 3 ? (
              <View style={styles.urgency}>
                <Feather name="alert-circle" size={15} color={colors.warning} />
                <Text style={styles.urgencyText}>Only {job.spotsRemaining} spots left</Text>
              </View>
            ) : null}
          </View>

          <StatsStrip
            stats={[
              { value: job.salary, label: job.salaryPeriod },
              { value: job.schedule, label: "Schedule" },
              { value: job.spotsLabel, label: "Spots" },
            ]}
          />

          <View style={styles.section}>
            <Text style={type.h2}>Job description</Text>
            <Text style={styles.description}>{job.description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={[type.h2, { marginBottom: 9 }]}>Requirements</Text>
            <RequirementsList items={job.requirements} />
          </View>

          <View style={styles.section}>
            <Text style={[type.h2, { marginBottom: 9 }]}>About the employer</Text>
            <EmployerCard
              name={job.companyName}
              verified={job.employerVerified}
              subtitle={job.employerSubtitle}
              avatarUrl={job.employerAvatarUrl}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.priceWrap}>
          <Text style={type.price} numberOfLines={1}>
            {job.salary}
            <Text style={styles.priceUnit}>{priceUnit}</Text>
          </Text>
        </View>
        <TouchableOpacity style={styles.applyButton} onPress={applyNow} activeOpacity={0.8}>
          <Text style={styles.applyButtonText}>Apply now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { backgroundColor: colors.background },
  scrollContent: { paddingBottom: 100 },
  headerBar: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 2,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerActions: { flexDirection: "row", gap: 9 },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverImage: {
    width: "100%",
    height: COVER_HEIGHT,
    backgroundColor: colors.background,
    borderBottomLeftRadius: COVER_HEIGHT * 0.15,
    borderBottomRightRadius: COVER_HEIGHT * 0.15,
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
  },
  logo: { width: 55, height: 55, borderRadius: 14, marginRight: 13 },
  body: { paddingHorizontal: 18, paddingBottom: 18 },
  titleRow: { flexDirection: "row", marginBottom: 16 },
  subtitle: {
    ...type.caption,
    fontSize: 14,
    color: colors.muted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 9,
    marginBottom: 18,
  },
  urgency: { flexDirection: "row", alignItems: "center", gap: 5 },
  urgencyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.warning,
  },
  section: { marginTop: 20 },
  description: {
    ...type.body,
    color: colors.ink,
    marginTop: 7,
  },
  bottomBar: {
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
  },
  priceWrap: { flex: 1, marginRight: 12 },
  priceUnit: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.muted,
  },
  applyButton: {
    backgroundColor: colors.mint,
    borderRadius: 11,
    paddingVertical: 13,
    paddingHorizontal: 27,
  },
  applyButtonText: {
    ...type.button,
    color: "#FFFFFF",
  },
});