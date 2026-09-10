import { useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import { useRouter } from "expo-router";

import { type Job, useJobStore } from "@/components/job-store";
import { JobBannerImage } from "@/components/job-banner-image";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Text } from "@/components/ui/text";
import { haptic } from "@/lib/haptics";
import { localImageUris } from "@/lib/local-image-uris";
import { normalizeJob } from "@/lib/job-utils";
import { useAuth } from "@/hooks/use-auth";
import { logJobEvent } from "@/lib/event-logging";

const DEFAULT_ASPECT_RATIO = 16 / 9;

type JobCardProps = { job: Job; emphasized?: boolean; compact?: boolean };

export function JobCard({ job, emphasized = false, compact = false }: JobCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { isSaved, toggleSaved } = useJobStore();
  const safeJob = normalizeJob(job);
  const openingRef = useRef(false);

  if (!safeJob) return null;

  const saved = isSaved(safeJob.id);

  const openJob = () => {
    if (openingRef.current) return;
    openingRef.current = true;
    haptic.light();
    logJobEvent({ jobId: safeJob.id, eventType: "click", feedContext: "feed" });
    router.push({ pathname: "/job/[id]", params: { id: safeJob.id } } as never);
    setTimeout(() => { openingRef.current = false; }, 500);
  };

  const toggle = () => {
    haptic.selection();
    if (!user) {
      router.push("/login" as never);
      return;
    }
    logJobEvent({ jobId: safeJob.id, eventType: saved ? "unsave" : "save" });
    toggleSaved(safeJob.id);
  };

  if (compact) return <CompactJobCardBody job={safeJob} onOpen={openJob} onToggleSaved={toggle} saved={saved} />;

  return (
    <View style={[styles.card, emphasized && styles.emphasizedCard]}>
      <Pressable onPress={openJob} style={({ pressed }) => [styles.imageArea, pressed && styles.pressed]}>
        <JobCardImage job={safeJob} />
        <View style={styles.imageOverlay}>
          <View style={styles.imageTopRow}>
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>{safeJob.tag}</Text>
            </View>
            <Pressable
              accessibilityLabel={saved ? `Remove ${safeJob.title} from saved jobs` : `Save ${safeJob.title}`}
              accessibilityRole="button"
              onPress={toggle}
              hitSlop={10}
              style={({ pressed }) => [styles.saveButton, pressed && styles.savePressed]}
            >
              <IconSymbol name={saved ? "heart.fill" : "heart"} size={20} color={saved ? "#FFFFFF" : "#FFFFFF"} />
            </Pressable>
          </View>
        </View>
      </Pressable>

      <Pressable onPress={openJob} style={({ pressed }) => [styles.bodyArea, pressed && styles.pressed]}>
        <Text numberOfLines={2} style={styles.title}>{safeJob.title}</Text>
        <View style={styles.companyRow}>
          <Text numberOfLines={1} style={styles.company}>{safeJob.company}</Text>
          <IconSymbol name="checkmark.circle.fill" size={13} color="#16803C" />
        </View>

        <View style={styles.salaryRow}>
          <Text numberOfLines={1} style={styles.salary}>{safeJob.pay}</Text>
        </View>

        <View style={styles.metaRow}>
          <IconSymbol name="mappin.and.ellipse" size={13} color="#83918A" />
          <Text numberOfLines={1} style={styles.metaText}>{safeJob.location.split(",")[0]}</Text>
          <View style={styles.metaDot} />
          <IconSymbol name="clock3" size={13} color="#83918A" />
          <Text numberOfLines={1} style={styles.metaText}>{safeJob.posted?.replace("Posted ", "") || "Recently"}</Text>
        </View>

        {safeJob.arrangement === "Remote" ? (
          <View style={styles.remoteRow}>
            <IconSymbol name="mappin.and.ellipse" size={12} color="#16803C" />
            <Text style={styles.remoteText}>Remote</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function CompactJobCardBody({ job, onOpen, onToggleSaved, saved }: { job: Job; onOpen: () => void; onToggleSaved: () => void; saved: boolean }) {
  return (
    <Pressable
      accessibilityLabel={`Open ${job.title} at ${job.company}`}
      onPress={onOpen}
      style={({ pressed }) => [styles.compactCard, pressed && styles.compactPressed]}
    >
      <View style={styles.compactImageWrap}>
        <CompactCardImage job={job} />
        <View style={styles.compactBadgeRow}>
          <View style={styles.compactBadge}>
            <Text style={styles.compactBadgeText}>{job.tag}</Text>
          </View>
        </View>
      </View>
      <View style={styles.compactBody}>
        <Text numberOfLines={2} style={styles.compactTitle}>{job.title}</Text>
        <Text numberOfLines={1} style={styles.compactCompany}>{job.company}</Text>
        <Text numberOfLines={1} style={styles.compactSalary}>{job.pay}</Text>
        <View style={styles.compactMeta}>
          <IconSymbol name="mappin.and.ellipse" size={11} color="#83918A" />
          <Text numberOfLines={1} style={styles.compactMetaText}>{job.location.split(",")[0]}</Text>
          <View style={styles.metaDot} />
          <IconSymbol name="clock3" size={11} color="#83918A" />
          <Text numberOfLines={1} style={styles.compactMetaText}>{job.posted?.replace("Posted ", "") || "Recently"}</Text>
        </View>
        <Pressable
          accessibilityLabel={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
          accessibilityRole="button"
          onPress={(event: GestureResponderEvent) => { event.stopPropagation(); onToggleSaved(); }}
          style={styles.compactSave}
        >
          <IconSymbol name={saved ? "heart.fill" : "heart"} size={17} color={saved ? "#16803C" : "#66736A"} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function JobCardImage({ job }: { job: Job }) {
  const imageUri = localImageUris[job.id] || job.image;
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!imageUri) return;
    let cancelled = false;
    if (Platform.OS === "web") {
      const img = new window.Image();
      img.onload = () => { if (!cancelled) setDimensions({ width: img.naturalWidth, height: img.naturalHeight }); };
      img.src = imageUri;
    } else {
      Image.getSize(
        imageUri,
        (w, h) => { if (!cancelled) setDimensions({ width: w, height: h }); },
        () => {},
      );
    }
    return () => { cancelled = true; };
  }, [imageUri]);

  const aspectRatio = dimensions ? dimensions.width / dimensions.height : DEFAULT_ASPECT_RATIO;

  if (imageUri) {
    return (
      <View style={[styles.imageContainer, { aspectRatio }]}>
        <JobBannerImage blur={false} accessibilityLabel={`${job.company} workplace`} uri={imageUri} style={styles.imageFill} />
      </View>
    );
  }

  const initial = (job.company?.trim().charAt(0).toUpperCase() || job.title?.trim().charAt(0).toUpperCase() || "H").toUpperCase();
  return (
    <View style={[styles.imageContainer, { aspectRatio: DEFAULT_ASPECT_RATIO }, styles.fallback]}>
      <Text style={styles.fallbackText}>{initial}</Text>
    </View>
  );
}

function CompactCardImage({ job }: { job: Job }) {
  const imageUri = localImageUris[job.id] || job.image;
  if (imageUri) {
    return <JobBannerImage blur={false} accessibilityLabel={`${job.company} workplace`} uri={imageUri} style={styles.compactImage} />;
  }
  const initial = (job.company?.trim().charAt(0).toUpperCase() || job.title?.trim().charAt(0).toUpperCase() || "H").toUpperCase();
  return <View style={[styles.compactImage, styles.compactFallback]}><Text style={styles.compactFallbackText}>{initial}</Text></View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E8ECEA",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    overflow: "hidden",
    ...Platform.select({
      web: { transitionProperty: "border-color, box-shadow, transform", transitionDuration: "160ms" },
      default: {},
    }),
  },
  emphasizedCard: {
    borderColor: "#B9D9D1",
    borderLeftColor: "#16803C",
    borderLeftWidth: 3,
  },
  imageArea: {
    position: "relative",
    width: "100%",
    backgroundColor: "#E8F0EC",
  },
  imageContainer: {
    width: "100%",
    backgroundColor: "#E8F0EC",
  },
  imageFill: {
    height: "100%",
    width: "100%",
  },
  fallback: {
    alignItems: "center",
    backgroundColor: "#0F5C2B",
    justifyContent: "center",
  },
  fallbackText: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "800",
  },
  imageOverlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  imageTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 10,
  },
  badgePill: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backdropFilter: "blur(8px)",
  },
  badgeText: {
    color: "#17201A",
    fontSize: 11,
    fontWeight: "600",
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "rgba(15, 92, 43, 0.55)",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  savePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.9 }],
  },
  pressed: {
    opacity: 0.72,
  },
  bodyArea: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  title: {
    color: "#17201A",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  companyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 4,
  },
  company: {
    color: "#66736A",
    fontSize: 13,
    fontWeight: "500",
  },
  salaryRow: {
    marginTop: 10,
  },
  salary: {
    color: "#16803C",
    fontSize: 17,
    fontWeight: "700",
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginTop: 8,
  },
  metaText: {
    color: "#83918A",
    fontSize: 12,
    fontWeight: "400",
    flexShrink: 1,
  },
  metaDot: {
    backgroundColor: "#D0D9D4",
    borderRadius: 2,
    height: 3,
    marginHorizontal: 1,
    width: 3,
  },
  remoteRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 6,
  },
  remoteText: {
    color: "#16803C",
    fontSize: 12,
    fontWeight: "500",
  },

  compactCard: {
    alignItems: "flex-start",
    borderBottomColor: "#ECEEEC",
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 110,
    paddingVertical: 12,
  },
  compactPressed: {
    opacity: 0.72,
  },
  compactImageWrap: {
    position: "relative",
    marginLeft: 1,
  },
  compactImage: {
    backgroundColor: "#E8F0EC",
    borderRadius: 10,
    height: 80,
    width: 80,
  },
  compactFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  compactFallbackText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  compactBadgeRow: {
    bottom: 6,
    left: 6,
    position: "absolute",
  },
  compactBadge: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  compactBadgeText: {
    color: "#17201A",
    fontSize: 9,
    fontWeight: "600",
  },
  compactBody: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
    paddingRight: 32,
  },
  compactTitle: {
    color: "#17201A",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
  },
  compactCompany: {
    color: "#66736A",
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 2,
  },
  compactSalary: {
    color: "#16803C",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  compactMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 4,
  },
  compactMetaText: {
    color: "#83918A",
    flex: 1,
    fontSize: 10.5,
  },
  compactSave: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    position: "absolute",
    right: 4,
    top: 0,
    width: 30,
  },
});
