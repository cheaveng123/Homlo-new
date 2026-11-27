import { RefreshControl, View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { BlurView } from "@react-native-community/blur";
import { useRouter } from "@/lib/router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import ImagePlaceholder from "./image-placeholder";
import { AppIcon } from "@/components/ui/AppIcon";
import StatsStrip from "./stats-strip";
import RequirementsList from "./requirements-list";
import EmployerCard from "./employer-card";
import { LocationPill } from "./LocationPill";
import { PositionsProgress } from "./PositionsProgress";
import { JobDistanceSection } from "./job-distance-section";
import { colors } from "./colors";
import { type, fonts } from "./typography";
import type { JobDetails } from "./types";
import { haptic } from "@/lib/haptics";
import { resolveJobField } from "@/lib/job-fields";
import { JobFieldArtwork } from "@/components/shared/JobFieldArtwork";
import { HERO_IMAGE_HEIGHT } from "@/constants/hero";

type Props = {
  job: JobDetails;
  saved?: boolean;
  onToggleSaved?: () => void;
  onShare?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

const COVER_HEIGHT = HERO_IMAGE_HEIGHT;

type JobLocationMetadata = Pick<JobDetails, "id"> & {
  arrangement?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function getOnSiteJobCoordinate(job: JobLocationMetadata) {
  if (job.arrangement !== "On-site") return null;
  if (typeof job.latitude !== "number" || !Number.isFinite(job.latitude)) return null;
  if (typeof job.longitude !== "number" || !Number.isFinite(job.longitude)) return null;
  return { latitude: job.latitude, longitude: job.longitude };
}

export default function JobDetailsScreen({ job, saved = false, onToggleSaved, onShare, onRefresh, refreshing }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const priceUnit = job.salaryUnit ?? "/mo";
  const isFilled = job.jobStatus === "filled";
  const onSiteJobCoordinate = getOnSiteJobCoordinate(job);
  // The job's category arrives in whatever spelling the data layer holds (legacy
  // taxonomy title, DB slug, or free-text industry), so resolve it once here
  // rather than at each of the two places below.
  const field = resolveJobField(job.category);
  const fieldSvg = field?.svg ?? null;

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const headerTitleStyle = useAnimatedStyle(() => {
    const progress = interpolate(scrollY.value, [COVER_HEIGHT - 60, COVER_HEIGHT], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: progress,
      transform: [{ translateY: (1 - progress) * -30 }],
    };
  });

  const blurStyle = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [COVER_HEIGHT - 60, COVER_HEIGHT], [0, 1], Extrapolation.CLAMP);
    return { opacity: p * 0.92 };
  });

  const heroStyle = useAnimatedStyle(() => {
    const up = Math.max(scrollY.value, 0);
    const pulled = Math.min(scrollY.value, 0);
    const p = interpolate(up, [0, COVER_HEIGHT], [0, 1], Extrapolation.CLAMP);
    return {
      transform: [
        { translateY: up * 0.65 + pulled * 0.5 },
        { scale: 1 + p * 0.08 - pulled * 0.0022 },
      ],
    };
  });

  const scrimStyle = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [0, COVER_HEIGHT], [0, 1], Extrapolation.CLAMP);
    return { opacity: p * 0.32 };
  });

  const applyNow = () => {
    if (isFilled) return;
    haptic.light();
    router.push({ pathname: "/job/[id]/apply", params: { id: job.id, from: "detail" } } as never);
  };

  return (
    // The top edge is left, right and bottom only — the cover image bleeds
    // to the very top of the device (included: status-bar area), and the
    // floating controls sit just below the top inset.
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
              tintColor={colors.mint}
              colors={[colors.mint]}
            />
          ) : undefined
        }
      >
        <Animated.View style={[styles.heroWrap, heroStyle]}>
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

          <Animated.View pointerEvents="none" style={[styles.heroScrim, scrimStyle]} />
        </Animated.View>

        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            {job.companyLogoUrl ? (
              <Image source={{ uri: job.companyLogoUrl }} style={styles.logo} />
            ) : fieldSvg ? (
              // No company logo uploaded, so the slot carries the job's field
              // illustration instead of the generic briefcase placeholder. The
              // tile keeps the placeholder's own background so the slot reads
              // identically whether it holds a real logo or a field.
              <View style={styles.fieldLogo}>
                <JobFieldArtwork xml={fieldSvg} width={42} height={42} />
              </View>
            ) : (
              <ImagePlaceholder width={55} height={55} borderRadius={14} icon="briefcase" style={{ marginRight: 13 }} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={type.h1}>{job.title}</Text>
              <View style={styles.subtitleRow}>
                {fieldSvg ? <JobFieldArtwork xml={fieldSvg} width={16} height={16} /> : null}
                <Text style={styles.subtitle} numberOfLines={1}>
                  {job.companyName} · {job.location}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.locationWrap}>
            <LocationPill
              locationName={job.locationFull}
              onPress={() => router.push({ pathname: "/job/[id]/location", params: { id: job.id } } as never)}
            />
          </View>

          {onSiteJobCoordinate ? <JobDistanceSection jobCoordinate={onSiteJobCoordinate} /> : null}

          <StatsStrip
            stats={[
              { value: job.salary, label: job.salaryPeriod },
              { value: job.employmentType, label: "Job type" },
              { value: job.spotsLabel, label: "Positions" },
            ]}
          />

          {typeof job.positionsTotal === "number" ? (
            <PositionsProgress positionsTotal={job.positionsTotal} positionsFilled={job.positionsFilled ?? 0} />
          ) : null}

          <View style={styles.section}>
            <Text style={type.h2}>Job description</Text>
            <Text style={styles.description}>{job.description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={[type.h2, { marginBottom: 9 }]}>Requirements</Text>
            <RequirementsList items={job.requirements} />
          </View>

          <View style={styles.sectionLarge}>
            <Text style={[type.h2, { marginBottom: 12 }]}>About the employer</Text>
            <EmployerCard
              name={job.companyName}
              verified={job.employerVerified}
              subtitle={job.employerSubtitle}
              avatarUrl={job.employerAvatarUrl}
              onPress={
                job.employerId
                  ? () => router.push(`/employer/${job.employerId}` as never)
                  : undefined
              }
            />
          </View>
        </View>
      </Animated.ScrollView>

      {/* Pinned header — sibling of the ScrollView so it stays fixed while
          the content scrolls. The bar stays transparent; the job title slides
          down from above once the user scrolls past the hero. The pill
          buttons keep their own white circles. */}
      <Animated.View style={[styles.headerBar, { paddingTop: insets.top }]}>
        <Animated.View pointerEvents="none" style={[styles.headerBlur, blurStyle]}>
          <BlurView blurAmount={10} blurType="light" style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconCircle} onPress={() => router.back()}>
            <AppIcon name="back" size={18} color={colors.ink} />
          </TouchableOpacity>
          <Animated.Text numberOfLines={1} ellipsizeMode="tail" style={[styles.headerTitle, headerTitleStyle]}>
            {job.title}
          </Animated.Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconCircle} onPress={onToggleSaved}>
              <AppIcon name="heart" size={17} color={saved ? colors.mint : colors.ink} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconCircle} onPress={onShare}>
              <AppIcon name="share" size={16} color={colors.ink} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <View style={styles.bottomBar}>
        <View style={styles.priceWrap}>
          <Text style={type.price} numberOfLines={1}>
            {job.salary}
            <Text style={styles.priceUnit}>{priceUnit}</Text>
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.applyButton, isFilled && styles.applyButtonDisabled]}
          onPress={applyNow}
          disabled={isFilled}
          activeOpacity={0.8}
        >
          <Text style={styles.applyButtonText}>{isFilled ? "Job filled" : "Apply now"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { backgroundColor: colors.background },
  scrollContent: { paddingBottom: 280 },
  headerBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerBlur: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    overflow: "hidden",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12,
    // Same typeface/weight/ink as the container title (type.h1) so the title
    // doesn't visibly restyle itself when the hero collapses.
    fontFamily: type.h1.fontFamily,
    fontSize: 15,
    fontWeight: "700",
    color: type.h1.color,
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
  heroWrap: {
    width: "100%",
    height: COVER_HEIGHT,
    transformOrigin: "top",
  },
  heroScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: COVER_HEIGHT,
    backgroundColor: "rgba(10,22,17,1)",
  },
  coverImage: {
    width: "100%",
    height: COVER_HEIGHT,
    backgroundColor: colors.background,
  },
  logo: { width: 55, height: 55, borderRadius: 14, marginRight: 13 },
  // Stands in for a missing company logo. Same box and background as the
  // `ImagePlaceholder` it replaces, so the slot doesn't shift when an employer
  // eventually uploads a real logo; the illustration is inset so the cutout
  // isn't flush against the rounded corners.
  fieldLogo: {
    width: 55,
    height: 55,
    borderRadius: 14,
    marginRight: 13,
    backgroundColor: colors.placeholderBg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fieldLogoImage: { width: 42, height: 42 },
  sheet: {
    marginTop: 12,
    paddingTop: 44,
    paddingHorizontal: 18,
    paddingBottom: 56,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  titleRow: { flexDirection: "row", marginBottom: 16 },
  locationWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 9,
    marginBottom: 18,
  },
  subtitleRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  // Cutouts are near-square with varying proportions, so the box is square and
  // the image is contained rather than stretched.
  subtitleFieldIcon: { width: 16, height: 16 },
  subtitle: {
    ...type.jobSubtitle,
    flexShrink: 1,
  },
  section: { marginTop: 32 },
  sectionLarge: { marginTop: 56, paddingBottom: 24 },
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
  applyButtonDisabled: {
    backgroundColor: colors.border,
  },
  applyButtonText: {
    ...type.button,
    color: "#FFFFFF",
  },
});