import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { getJob, useJobStore } from "@/components/job-store";
import { JobBannerImage } from "@/components/job-banner-image";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { Text } from "@/components/ui/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { motion } from "@/lib/animation-presets";
import { haptic } from "@/lib/haptics";
import { localImageUris } from "@/lib/local-image-uris";
import { usePublishedJobs } from "@/hooks/use-published-jobs";
import { useAuth } from "@/hooks/use-auth";
import { logJobEvent, isCanonicalJobId } from "@/lib/event-logging";

export default function JobDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jobs: availableJobs, loading: liveJobsLoading } = usePublishedJobs();
  const job = availableJobs.find((candidate) => candidate.id === id) ?? getJob(id);
  const { isSaved, toggleSaved } = useJobStore();
  const { user } = useAuth();
  const scrollY = useSharedValue(0);
  const backRouteLock = useRef(false);
  const goBack = () => {
    if (backRouteLock.current) return;
    backRouteLock.current = true;
    router.back();
  };

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

  const handleToggleSaved = () => {
    haptic.selection();
    if (!user) {
      router.push("/login" as never);
      return;
    }
    if (job) {
      const savedNow = isSaved(job.id);
      logJobEvent({ jobId: job.id, eventType: savedNow ? "unsave" : "save" });
      toggleSaved(job.id);
    }
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const bannerStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, motion.detailBannerCollapseDistance],
      [motion.detailBannerHeight + insets.top, motion.detailBannerCompactHeight + insets.top],
      Extrapolation.CLAMP,
    ),
  }));

  const bannerImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [0, motion.detailBannerCollapseDistance], [0, -24], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [0, motion.detailBannerCollapseDistance], [1, 1.08], Extrapolation.CLAMP) },
    ],
  }));

  const heroContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 84], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 84], [0, -14], Extrapolation.CLAMP) }],
  }));

  const compactTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [52, motion.detailBannerCollapseDistance], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [52, motion.detailBannerCollapseDistance], [7, 0], Extrapolation.CLAMP) }],
  }));

  const navigationSurfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(scrollY.value, [0, motion.detailBannerCollapseDistance], ["rgba(15,92,43,0.02)", "rgba(247,248,246,0.98)"]),
    borderBottomColor: interpolateColor(scrollY.value, [0, motion.detailBannerCollapseDistance], ["rgba(255,255,255,0)", "#E2E8E5"]),
    borderBottomWidth: interpolate(scrollY.value, [0, motion.detailBannerCollapseDistance], [0, 1], Extrapolation.CLAMP),
  }));

  if (!job && liveJobsLoading) {
    return <ScreenContainer className="items-center justify-center p-6"><ActivityIndicator color="#16803C" /><Text style={styles.missingTitle}>Loading this opportunity…</Text></ScreenContainer>;
  }
  if (!job) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text style={styles.missingTitle}>This role is no longer available.</Text>
        <ScalePressable hapticFeedback onPress={goBack} style={styles.backButton}><Text style={styles.backText}>Go back</Text></ScalePressable>
      </ScreenContainer>
    );
  }

  const saved = isSaved(job.id);
  const handleApply = () => {
    if (!job) return;
    haptic.light();
    router.push({ pathname: "/job/[id]/apply", params: { id: job.id, from: "detail" } } as never);
  };

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["left", "right", "bottom"]}>
      <View style={styles.screen}>
        <Animated.ScrollView contentContainerStyle={[styles.content, { paddingBottom: 126 + Math.max(insets.bottom, 10) }]} onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.banner, bannerStyle]}>
            <Animated.View style={[styles.bannerImageLayer, bannerImageStyle]}>
              <JobHeroImage job={job} />
              <View style={styles.bannerTint} />
            </Animated.View>
            <Animated.View style={[styles.bannerCopy, heroContentStyle]}>
              <View style={styles.bannerTag}><Text style={styles.bannerTagText}>{job.category}</Text></View>
              <Text style={styles.bannerCompany}>{job.company}</Text>
              <Text numberOfLines={2} style={styles.bannerTitle}>{job.title}</Text>
              <View style={styles.bannerMeta}><IconSymbol name="mappin.and.ellipse" size={15} color="#D8F3ED" /><Text style={styles.bannerMetaText}>{job.location}</Text></View>
            </Animated.View>
          </Animated.View>

          <View style={styles.mainContent}>
            <View style={styles.identityRow}>
              <View style={styles.companyMark}><Text style={styles.companyMarkText}>{job.company.charAt(0)}</Text></View>
              <View style={styles.identityCopy}><Text style={styles.companyName}>{job.company}</Text><View style={styles.verifiedRow}><IconSymbol name="checkmark.circle.fill" size={13} color="#16803C" /><Text style={styles.companyLabel}>Verified company · {job.category}</Text></View></View>
            </View>
            <View style={styles.detailHeading}><Text style={styles.detailTitle}>{job.title}</Text><View style={styles.hiringRow}><View style={styles.hiringDot} /><Text style={styles.hiringText}>{job.status === "Hiring" ? "Actively hiring" : job.posted}</Text></View></View>
            <View style={styles.salaryBlock}><Text style={styles.salaryLabel}>COMPENSATION</Text><Text style={styles.salaryValue}>{job.pay}</Text><Text style={styles.salaryNote}>Salary details shared by the employer</Text></View>
            <Text style={styles.overviewTitle}>Job overview</Text>
            <View style={styles.overviewGrid}>
              <OverviewCell label="Work type" value={job.tag} />
              <OverviewCell label="Experience" value={job.experience ?? "Entry level"} />
              <OverviewCell label="Workplace" value={job.arrangement ?? "On-site"} />
              <OverviewCell label="Location" value={job.location.split(",")[0]} />
            </View>
            <Text style={styles.sectionTitle}>About this role</Text>
            <Text style={styles.description}>{job.description}</Text>
            <Text style={styles.sectionTitle}>What you'll do</Text>
            <Bullet text={`Work closely with the ${job.company} team to deliver a thoughtful customer experience.`} />
            <Bullet text="Keep priorities clear, communicate early, and contribute to a reliable daily rhythm." />
            <Bullet text={`Bring energy and care to each ${job.category.toLowerCase()} task.`} />
            <Text style={styles.sectionTitle}>What we're looking for</Text>
            <Bullet text={`Availability for the listed ${job.schedule.toLowerCase()} schedule.`} />
            <Bullet text="A friendly, reliable approach to working with people." />
            <Bullet text="A willingness to learn and contribute as part of a team." />
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillWrap}>{[job.category, "Communication", "Teamwork", job.arrangement ?? "On-site"].map((skill) => <View key={skill} style={styles.skillTag}><Text style={styles.skillText}>{skill}</Text></View>)}</View>
            <Text style={styles.sectionTitle}>Benefits</Text>
            <View style={styles.benefitGrid}><Benefit text="Supportive team" /><Benefit text="Learning & training" /><Benefit text="Flexible working" /><Benefit text="Growth pathway" /></View>
            <Text style={styles.sectionTitle}>About the company</Text>
            <View style={styles.companyCard}><View style={styles.companyCardMark}><Text style={styles.companyCardMarkText}>{job.company.charAt(0)}</Text></View><View style={styles.companyCardCopy}><Text style={styles.companyCardTitle}>{job.company}</Text><Text style={styles.companyCardMeta}>{job.category} · {job.location.split(",")[0]}</Text><Text style={styles.companyCardDescription}>A verified Homlo employer building thoughtful opportunities for people in the community.</Text><Text style={styles.companyCardLink}>View company →</Text></View></View>
          </View>
        </Animated.ScrollView>

        <Animated.View pointerEvents="box-none" style={[styles.navigationSurface, { height: 54 + insets.top, paddingTop: insets.top }, navigationSurfaceStyle]}>
          <ScalePressable accessibilityLabel="Go back" hapticFeedback onPress={goBack} style={styles.navButton}><IconSymbol name="chevron.left" size={22} color="#16211F" /></ScalePressable>
          <Animated.View style={[styles.compactTitleWrap, compactTitleStyle]} pointerEvents="none"><Text numberOfLines={1} style={styles.compactTitle}>{job.title}</Text></Animated.View>
          <View style={styles.navRightActions}>
            <ScalePressable accessibilityLabel={saved ? "Remove from saved jobs" : "Save job"} hapticFeedback onPress={handleToggleSaved} style={styles.navButton}><IconSymbol name={saved ? "heart.fill" : "heart"} size={21} color={saved ? "#16803C" : "#17201A"} /></ScalePressable>
            <ScalePressable accessibilityLabel="More options" hapticFeedback onPress={() => haptic.light()} style={styles.navButton}><IconSymbol name="ellipsis" size={22} color="#16211F" /></ScalePressable>
          </View>
        </Animated.View>

        <View style={[styles.applyLayer, { bottom: Math.max(insets.bottom, 10) + 12 }]}>
          <View style={styles.applyActions}><ScalePressable accessibilityLabel={`Apply for ${job.title}`} hapticFeedback onPress={handleApply} style={styles.applyButton}><Text style={styles.applyText}>Apply now</Text><IconSymbol name="arrow.right" size={21} color="#FFFFFF" /></ScalePressable></View>
        </View>
      </View>
    </ScreenContainer>
  );
}

function OverviewCell({ label, value }: { label: string; value: string }) { return <View style={styles.overviewCell}><Text style={styles.overviewLabel}>{label}</Text><Text numberOfLines={2} style={styles.overviewValue}>{value}</Text></View>; }
function JobHeroImage({ job }: { job: NonNullable<ReturnType<typeof getJob>> }) {
  const uri = localImageUris[job.id] || job.image;
  if (uri) return <JobBannerImage accessibilityLabel={`${job.company} workplace`} uri={uri} style={styles.bannerImage} />;
  return <View accessibilityLabel={`${job.company} workplace`} style={styles.bannerImage} />;
}
function Bullet({ text }: { text: string }) { return <View style={styles.bullet}><IconSymbol name="checkmark.circle.fill" size={17} color="#22A447" /><Text style={styles.bulletText}>{text}</Text></View>; }
function Benefit({ text }: { text: string }) { return <View style={styles.benefit}><IconSymbol name="checkmark.circle.fill" size={15} color="#22A447" /><Text style={styles.benefitText}>{text}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, position: "relative" },
  content: { paddingBottom: 126 },
  banner: { backgroundColor: "#0F5C2B", overflow: "hidden", position: "relative" },
  bannerImageLayer: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  bannerImage: { height: "100%", width: "100%" },
  bannerTint: { backgroundColor: "rgba(15, 92, 43, 0.44)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  bannerCopy: { bottom: 23, left: 20, position: "absolute", right: 20 },
  bannerTag: { alignSelf: "flex-start", backgroundColor: "rgba(237, 255, 250, 0.2)", borderColor: "rgba(237, 255, 250, 0.42)", borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  bannerTagText: { color: "#E4FFF8", fontSize: 11, fontWeight: "600" },
  bannerCompany: { color: "#D8F3ED", fontSize: 13, fontWeight: "500", marginTop: 13 },
  bannerTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "700", letterSpacing: -0.9, lineHeight: 34, marginTop: 3 },
  bannerMeta: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 10 },
  bannerMetaText: { color: "#D8F3ED", flex: 1, fontSize: 12.5 },
  mainContent: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -24, minHeight: 570, paddingHorizontal: 20, paddingTop: 19 },
  identityRow: { alignItems: "center", flexDirection: "row" },
  companyMark: { alignItems: "center", backgroundColor: "#E0F1ED", borderColor: "#FFFFFF", borderRadius: 19, borderWidth: 3, height: 43, justifyContent: "center", marginTop: -37, shadowColor: "#153E37", shadowOpacity: 0.11, shadowRadius: 8, width: 43 },
  companyMarkText: { color: "#16803C", fontSize: 17, fontWeight: "700" },
  identityCopy: { flex: 1, marginLeft: 9 },
  companyName: { color: "#1B2825", fontSize: 15, fontWeight: "600" },
  verifiedRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 4 },
  companyLabel: { color: "#60716B", fontSize: 10.5 },
  detailHeading: { marginTop: 19 },
  detailTitle: { color: "#16211F", fontSize: 25, fontWeight: "700", letterSpacing: -0.7 },
  hiringRow: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 7 },
  hiringDot: { backgroundColor: "#22A447", borderRadius: 4, height: 7, width: 7 },
  hiringText: { color: "#58716A", fontSize: 12.5 },
  salaryBlock: { backgroundColor: "#EDF7EF", borderColor: "#E2E8E5", borderLeftColor: "#16803C", borderLeftWidth: 3, borderRadius: 14, borderWidth: 1, marginTop: 20, padding: 15 },
  salaryLabel: { color: "#0F5C2B", fontSize: 10.5, fontWeight: "600", letterSpacing: 0.65 },
  salaryValue: { color: "#16803C", fontSize: 25, fontWeight: "800", letterSpacing: -0.65, marginTop: 5 },
  salaryNote: { color: "#62807A", fontSize: 11.5, marginTop: 4 },
  overviewTitle: { color: "#16211F", fontSize: 18, fontWeight: "600", marginTop: 25 },
  overviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 11 },
  overviewCell: { backgroundColor: "#F7FAF9", borderRadius: 12, minHeight: 70, padding: 11, width: "48.5%" },
  overviewLabel: { color: "#7A8782", fontSize: 9.5, fontWeight: "600", letterSpacing: 0.55, textTransform: "uppercase" },
  overviewValue: { color: "#263430", fontSize: 12.5, fontWeight: "600", marginTop: 5 },
  sectionTitle: { color: "#16211F", fontSize: 18, fontWeight: "600", marginTop: 25 },
  description: { color: "#53615D", fontSize: 14, lineHeight: 21, marginTop: 8 },
  bullet: { alignItems: "flex-start", flexDirection: "row", gap: 9, marginTop: 12 },
  bulletText: { color: "#53615D", flex: 1, fontSize: 14, lineHeight: 20 },
  skillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 11 },
  skillTag: { backgroundColor: "#F0F6F4", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  skillText: { color: "#36544E", fontSize: 11.5, fontWeight: "500" },
  benefitGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 11 },
  benefit: { alignItems: "center", backgroundColor: "#F7FAF9", borderRadius: 10, flexDirection: "row", gap: 6, minHeight: 37, paddingHorizontal: 9, width: "48%" },
  benefitText: { color: "#53615D", flex: 1, fontSize: 11.5 },
  companyCard: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 14, borderWidth: 1, flexDirection: "row", marginTop: 11, padding: 14 },
  companyCardMark: { alignItems: "center", backgroundColor: "#E0F1ED", borderRadius: 17, height: 34, justifyContent: "center", width: 34 },
  companyCardMarkText: { color: "#16803C", fontSize: 14, fontWeight: "700" },
  companyCardCopy: { flex: 1, marginLeft: 10 },
  companyCardTitle: { color: "#16211F", fontSize: 14, fontWeight: "600" },
  companyCardMeta: { color: "#6E7C77", fontSize: 11.5, marginTop: 3 },
  companyCardDescription: { color: "#53615D", fontSize: 12, lineHeight: 17, marginTop: 10 },
  companyCardLink: { color: "#16803C", fontSize: 12, fontWeight: "600", marginTop: 10 },
  navigationSurface: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", left: 0, paddingHorizontal: 14, position: "absolute", right: 0, top: 0, zIndex: 10 },
  navButton: { alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.94)", borderRadius: 18, height: 37, justifyContent: "center", width: 37 },
  navRightActions: { flexDirection: "row", gap: 7 },
  compactTitleWrap: { left: 61, position: "absolute", right: 108 },
  compactTitle: { color: "#16211F", fontSize: 14, fontWeight: "600", textAlign: "center" },
  applyLayer: { alignItems: "center", left: 0, position: "absolute", right: 0, zIndex: 15 },
  applyActions: { width: "88%" },
  applyButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 32, flexDirection: "row", gap: 10, justifyContent: "center", minHeight: 64, paddingHorizontal: 26, shadowColor: "#0F5C2B", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.22, shadowRadius: 12 },
  applyDisabled: { opacity: 0.7 },
  applyText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  missingTitle: { color: "#16211F", fontSize: 18, fontWeight: "600", textAlign: "center" },
  backButton: { backgroundColor: "#08675F", borderRadius: 12, marginTop: 16, paddingHorizontal: 18, paddingVertical: 11 },
  backText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
});
