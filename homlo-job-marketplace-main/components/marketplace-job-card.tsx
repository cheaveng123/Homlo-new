import { memo as reactMemo } from "react";
import { Image, Platform, Pressable, StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";

import { type Job, useJobStore } from "@/components/job-store";
import { AppIcon } from "@/components/ui/AppIcon";
import { Text } from "@/components/ui/text";
import { haptic } from "@/lib/haptics";
import { normalizeJob } from "@/lib/job-utils";
import { localImageUris } from "@/lib/local-image-uris";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { usePressLock } from "@/hooks/use-press-lock";
import { logJobEvent } from "@/lib/event-logging";

const palette = ["#E8F2EC", "#EAF1FA", "#FBF1E5", "#F4ECF7", "#F8ECEC", "#EAF6F0"];
const inkPalette = ["#0891B2", "#1F5397", "#A65C18", "#7144A4", "#A04141", "#0E8A6A"];

function avatarFor(company: string) {
  const trimmed = company.trim();
  if (!trimmed) return { letter: "·", tone: "#E8F0EC", ink: "#66736A" };
  const first = trimmed.charAt(0).toUpperCase();
  let hash = 0;
  for (let index = 0; index < trimmed.length; index += 1) {
    hash = (hash << 5) - hash + trimmed.charCodeAt(index);
    hash |= 0;
  }
  const idx = Math.abs(hash) % palette.length;
  return { letter: first, tone: palette[idx], ink: inkPalette[idx] };
}

type MarketplaceJobCardProps = {
  job: Job;
  selected?: boolean;
  onPress?: (job: Job) => void;
  showBookmark?: boolean;
  style?: StyleProp<ViewStyle>;
};

function MarketplaceJobCardImpl({ job, selected = false, onPress, showBookmark = true, style }: MarketplaceJobCardProps) {
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
  const avatar = avatarFor(safeJob.company);
  const shortLocation = safeJob.location.split(",")[0].trim();
  const tags: string[] = [];
  if (safeJob.arrangement === "Remote") tags.push("Remote");
  else if (safeJob.tag) tags.push(safeJob.tag);
  if (safeJob.noExperience) tags.push("No experience");
  if (tags.length < 2 && safeJob.experience && safeJob.experience !== "Entry level") tags.push(safeJob.experience);

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
      className={cn("flex-row overflow-hidden rounded-2xl border bg-white px-4 py-3.5")}
      style={[styles.card, selected ? styles.cardSelected : null, style]}
    >
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${safeJob.title}`} onPress={handleOpen} style={({ pressed }) => [styles.touchArea, pressed && styles.pressed]}>
        <MarketplaceCardImage imageUri={safeJob.image} jobId={safeJob.id} title={safeJob.title} fallback={avatar} />
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.title}>{safeJob.title}</Text>
          <View style={styles.companyRow}>
            <Text numberOfLines={1} style={styles.company}>{safeJob.company}</Text>
            <AppIcon name="circle-check" size={12} color="#0891B2" />
          </View>
          <Text numberOfLines={1} style={styles.pay}>{safeJob.pay}</Text>
          <View style={styles.metaRow}>
            <AppIcon name="pin" size={12} color="#83918A" style={styles.metaIcon} />
            <Text numberOfLines={1} style={styles.metaText}>{shortLocation}</Text>
            <View style={styles.metaDot} />
            <AppIcon name="clock" size={12} color="#83918A" style={styles.metaIcon} />
            <Text numberOfLines={1} style={styles.metaText}>{safeJob.posted?.replace("Posted ", "") || "Recently"}</Text>
          </View>
          {tags.length ? (
            <View style={styles.tagRow}>
              {tags.slice(0, 3).map((tag) => (
                <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
              ))}
            </View>
          ) : null}
        </View>
        {showBookmark ? (
          <Pressable
            accessibilityLabel={saved ? `Remove ${safeJob.title} from saved jobs` : `Save ${safeJob.title}`}
            accessibilityRole="button"
            onPress={handleBookmark}
            hitSlop={10}
            style={({ pressed }) => [styles.bookmark, pressed && styles.bookmarkPressed]}
          >
            <AppIcon name="heart" size={18} color={saved ? "#0891B2" : "#83918A"} />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

function MarketplaceCardImage({ imageUri, jobId, title, fallback }: { imageUri: string; jobId: string; title: string; fallback: { letter: string; tone: string; ink: string } }) {
  const localUri = localImageUris[jobId] ?? null;
  const resolved = imageUri?.startsWith("http") || imageUri?.startsWith("file:") || imageUri?.startsWith("data:") ? imageUri : localUri;
  if (resolved && Platform.OS === "web") {
    return <View accessibilityLabel={`${title} banner`} style={[styles.avatar, { backgroundImage: `url("${resolved}")`, backgroundColor: "#E8F0EC", backgroundPosition: "center", backgroundSize: "cover" } as unknown as ViewStyle]} />;
  }
  if (resolved) {
    return <Image accessibilityLabel={`${title} banner`} resizeMode="cover" source={{ uri: resolved }} style={[styles.avatar, styles.avatarImage]} />;
  }
  return <View style={[styles.avatar, { backgroundColor: fallback.tone }]}><Text style={[styles.avatarLetter, { color: fallback.ink }]}>{fallback.letter}</Text></View>;
}

export const MarketplaceJobCard = reactMemo(MarketplaceJobCardImpl, (prev, next) => {
  return prev.job === next.job && prev.selected === next.selected && prev.showBookmark === next.showBookmark && prev.style === next.style;
});

const styles = StyleSheet.create({
  card: {
    borderColor: "#E8ECEA",
    borderWidth: 1,
    marginBottom: 10,
    ...Platform.select({
      web: { transitionProperty: "border-color, box-shadow, transform", transitionDuration: "160ms" },
      default: {},
    }),
  },
  cardSelected: { borderColor: "#0891B2", backgroundColor: "#F1F8F2" },
  touchArea: { flexDirection: "row", alignItems: "flex-start", flex: 1 },
  pressed: { opacity: 0.78 },
  avatar: {
    alignItems: "center",
    backgroundColor: "#E8F0EC",
    borderRadius: 12,
    height: 72,
    justifyContent: "center",
    marginTop: 1,
    width: 72,
  },
  avatarImage: { backgroundColor: "#E8F0EC" },
  avatarLetter: { fontSize: 22, fontWeight: "700" },
  body: { flex: 1, marginLeft: 12, minWidth: 0, paddingRight: 28 },
  title: { color: "#17201A", fontSize: 14.5, fontWeight: "600", letterSpacing: -0.1, lineHeight: 19 },
  companyRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 3 },
  company: { color: "#66736A", fontSize: 12, fontWeight: "500" },
  pay: { color: "#0891B2", fontSize: 14, fontWeight: "700", marginTop: 6 },
  metaRow: { alignItems: "center", flexDirection: "row", marginTop: 5 },
  metaIcon: { marginRight: 3 },
  metaText: { color: "#83918A", fontSize: 11, fontWeight: "400" },
  metaDot: { backgroundColor: "#D0D9D4", borderRadius: 2, height: 3, marginHorizontal: 5, width: 3 },
  tagRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 },
  tag: { backgroundColor: "#EAF6EC", borderColor: "#D5EBDC", borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: "#0891B2", fontSize: 10, fontWeight: "600" },
  bookmark: { alignItems: "center", height: 44, justifyContent: "center", position: "absolute", right: 0, top: 0, width: 32 },
  bookmarkPressed: { opacity: 0.55, transform: [{ scale: 0.9 }] },
});
