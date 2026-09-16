import { memo as reactMemo } from "react";
import { Image, Platform, Pressable, StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";

import { type Job, useJobStore } from "@/components/job-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Text } from "@/components/ui/text";
import { haptic } from "@/lib/haptics";
import { normalizeJob } from "@/lib/job-utils";
import { localImageUris } from "@/lib/local-image-uris";
import { useAuth } from "@/hooks/use-auth";
import { usePressLock } from "@/hooks/use-press-lock";
import { logJobEvent } from "@/lib/event-logging";

type SearchJobCardProps = {
  job: Job;
  onPress?: (job: Job) => void;
  style?: StyleProp<ViewStyle>;
};

function pillFor(job: Job) {
  if (job.arrangement === "Remote") return { label: "Remote", color: "#16803C" };
  if (job.tag === "Weekend") return { label: "Weekend", color: "#23739A" };
  if (job.tag === "Internship") return { label: "Internship", color: "#23739A" };
  if (job.tag) return { label: job.tag, color: "#16803C" };
  if (job.noExperience) return { label: "No experience", color: "#16803C" };
  return { label: "Flexible", color: "#16803C" };
}

function postedText(raw?: string) {
  const cleaned = (raw ?? "").replace(/^Posted\s*/i, "").trim();
  return cleaned || "Recently";
}

function SearchJobCardImpl({ job, onPress, style }: SearchJobCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { isSaved, toggleSaved } = useJobStore();
  const safeJob = normalizeJob(job);
  const saved = safeJob ? isSaved(safeJob.id) : false;

  const handleOpen = usePressLock(() => {
    if (!safeJob) return;
    haptic.light();
    if (onPress) onPress(safeJob);
    else {
      logJobEvent({ jobId: safeJob.id, eventType: "click", feedContext: "search" });
      router.push({ pathname: "/job/[id]", params: { id: safeJob.id } } as never);
    }
  });

  if (!safeJob) return null;

  const pill = pillFor(safeJob);
  const shortLocation = safeJob.location.split(",")[0].trim();
  const localUri = localImageUris[safeJob.id] ?? null;
  const resolved =
    safeJob.image?.startsWith("http") || safeJob.image?.startsWith("file:") || safeJob.image?.startsWith("data:")
      ? safeJob.image
      : localUri;
  const flexibility = safeJob.arrangement ?? "Flexible";

  const handleBookmark = (event: GestureResponderEvent) => {
    event.stopPropagation();
    haptic.selection();
    if (!user) {
      router.push("/login" as never);
      return;
    }
    logJobEvent({ jobId: safeJob.id, eventType: saved ? "unsave" : "save" });
    toggleSaved(safeJob.id);
  };

  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={`${safeJob.title} at ${safeJob.company}`}
      style={[styles.card, style]}
    >
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${safeJob.title}`} onPress={handleOpen} style={({ pressed }) => [styles.touchArea, pressed && styles.pressed]}>
        <View style={styles.imageWrap}>
          {resolved && Platform.OS === "web" ? (
            <View
              accessibilityLabel={`${safeJob.title} banner`}
              style={{
                backgroundColor: "#E8F0EC",
                backgroundImage: `url("${resolved}")`,
                backgroundPosition: "center",
                backgroundSize: "cover",
                height: 152,
                width: "100%",
              }}
            />
          ) : resolved ? (
            <Image accessibilityLabel={`${safeJob.title} banner`} resizeMode="cover" source={{ uri: resolved }} style={styles.image} />
          ) : (
            <View style={styles.imageFallback}>
              <IconSymbol name="briefcase.fill" size={34} color="#B9C7C0" />
            </View>
          )}

          <View style={styles.pill}>
            <Text style={[styles.pillText, { color: pill.color }]}>{pill.label}</Text>
          </View>

          <Pressable
            accessibilityLabel={saved ? `Remove ${safeJob.title} from saved jobs` : `Save ${safeJob.title}`}
            accessibilityRole="button"
            onPress={handleBookmark}
            hitSlop={10}
            style={({ pressed }) => [styles.heart, pressed && styles.pressed]}
          >
            <IconSymbol name={saved ? "heart.fill" : "heart"} size={20} color={saved ? "#16803C" : "#FFFFFF"} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.title}>{safeJob.title}</Text>
            <Text style={styles.time}>{postedText(safeJob.posted)}</Text>
          </View>
          <View style={styles.companyRow}>
            <Text numberOfLines={1} style={styles.company}>{safeJob.company}</Text>
            <IconSymbol name="checkmark.circle.fill" size={13} color="#16803C" />
          </View>
          <View style={styles.metaRow}>
            <IconSymbol name="banknote" size={14} color="#83918A" />
            <Text numberOfLines={1} style={styles.metaText}>{safeJob.pay}</Text>
            <View style={styles.metaDot} />
            <IconSymbol name="mappin.and.ellipse" size={14} color="#83918A" />
            <Text numberOfLines={1} style={styles.metaText}>{shortLocation}</Text>
            <View style={styles.metaDot} />
            <IconSymbol name="briefcase" size={14} color="#83918A" />
            <Text numberOfLines={1} style={styles.metaText}>{flexibility}</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export const SearchJobCard = reactMemo(SearchJobCardImpl, (prev, next) => {
  return prev.job === next.job && prev.onPress === next.onPress && prev.style === next.style;
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#173C25",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    ...Platform.select({
      web: { boxShadow: "0 4px 14px rgba(23,60,37,0.08)" },
      default: {},
    }),
  },
  touchArea: { flex: 1 },
  pressed: { opacity: 0.8 },
  imageWrap: { height: 152, position: "relative", width: "100%" },
  image: { backgroundColor: "#E8F0EC", height: 152, width: "100%" },
  imageFallback: { alignItems: "center", backgroundColor: "#EDF2EF", height: 152, justifyContent: "center", width: "100%" },
  pill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: "absolute",
    top: 12,
  },
  pillText: { fontSize: 11, fontWeight: "700" },
  heart: {
    alignItems: "center",
    backgroundColor: "rgba(23,32,26,0.28)",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    top: 12,
    width: 32,
  },
  body: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 12 },
  titleRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  title: { color: "#17201A", flex: 1, fontSize: 15.5, fontWeight: "700", letterSpacing: -0.2 },
  time: { color: "#94A098", fontSize: 11, marginLeft: 8 },
  companyRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 3 },
  company: { color: "#66736A", flex: 1, fontSize: 12.5, fontWeight: "500" },
  metaRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 9 },
  metaText: { color: "#66736A", flexShrink: 1, fontSize: 11.5, fontWeight: "500" },
  metaDot: { backgroundColor: "#D0D9D4", borderRadius: 2, height: 3, marginHorizontal: 2, width: 3 },
});