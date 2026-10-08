/**
 * The job card shared by all three employer list screens (Applications, Jobs
 * posted, Live now).
 *
 * There is deliberately one of these rather than one per screen: the three
 * screens differ only in which jobs they include and how they are sorted, so
 * duplicating the card would let the three lists drift apart visually.
 *
 * Reads the same `viewed_at` receipt as everything else on the employer side,
 * so the "new" badge here agrees with the dashboard tiles and the
 * New applicants screen.
 */
import { Image, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ScalePressable } from "@/components/ui/scale-pressable";
import { JobStatusPill, type JobStatus } from "@/components/job-details/job-status-pill";
import { colors, fontFamily } from "@/components/home/theme";
import { formatPostedAgo } from "@/lib/format";
import { getProfilePhotoUrl } from "@/lib/profile-photo";
import type { EmployerApplication } from "@/hooks/use-employer-applications";
import type { EmployerJob } from "@/backend/domain/models";

/** Avatars shown before the row collapses the remainder into a "+N" chip. */
const MAX_AVATARS = 3;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

/** The statuses the pill understands; anything unexpected renders as `open`. */
function pillStatus(status: string | null): JobStatus {
  switch (status) {
    case "open":
    case "filled":
    case "closed":
    case "expired":
    case "cancelled":
    case "draft":
      return status;
    default:
      return "open";
  }
}

export type EmployerJobCardProps = {
  job: EmployerJob;
  applications: EmployerApplication[];
  /** Positions still open, only meaningful while the listing is live. */
  positionsAvailable?: number;
};

export function EmployerJobCard({ job, applications, positionsAvailable }: EmployerJobCardProps) {
  const router = useRouter();

  const unread = applications.filter((application) => application.isNew).length;
  const shown = applications.slice(0, MAX_AVATARS);
  const overflow = applications.length - shown.length;

  const location = job.locationLabel?.trim() || job.category?.trim() || "";
  const posted = job.createdAt ? formatPostedAgo(job.createdAt) : "";

  return (
    <ScalePressable
      hapticFeedback
      containerStyle={styles.wrap}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${job.title}, ${applications.length} ${
        applications.length === 1 ? "applicant" : 'applicants'
      }${unread > 0 ? `, ${unread} new` : ""}`}
      onPress={() =>
        router.push({
          pathname: "/employer/job/[id]",
          params: { id: job.id },
        } as never)
      }
    >
      <View style={styles.headRow}>
        <Text style={styles.title} numberOfLines={2}>
          {job.title || "Untitled job"}
        </Text>
        {unread > 0 ? (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>{unread} new</Text>
          </View>
        ) : null}
      </View>

      {location ? (
        <Text style={styles.meta} numberOfLines={1}>
          {location}
        </Text>
      ) : null}

      <View style={styles.tagRow}>
        <JobStatusPill status={pillStatus(job.status)} positionsAvailable={positionsAvailable} />
        {posted ? <Text style={styles.posted}>{posted}</Text> : null}
      </View>

      {applications.length > 0 ? (
        <View style={styles.footRow}>
          <View style={styles.avatars}>
            {shown.map((application) => {
              const url = application.avatarUrl ? getProfilePhotoUrl(application.avatarUrl) : null;
              return url ? (
                <Image
                  key={application.id}
                  source={{ uri: url }}
                  style={styles.avatar}
                  accessibilityLabel={`Photo of ${application.fullName}`}
                />
              ) : (
                <View key={application.id} style={styles.avatar}>
                  <Text style={styles.avatarInitials}>{initialsOf(application.fullName)}</Text>
                </View>
              );
            })}
            {overflow > 0 ? (
              <View style={[styles.avatar, styles.avatarOverflow]}>
                <Text style={styles.avatarOverflowText}>+{overflow}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.applicantCount}>
            {applications.length === 1 ? "1 applicant" : `${applications.length} applicants`}
          </Text>
        </View>
      ) : (
        <Text style={styles.noApplicants}>No applicants yet</Text>
      )}
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginBottom: 12 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 22,
    padding: 16,
    // Matches the stat card's elevation language so the two read as one system.
    shadowColor: colors.greenDark,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: {
    flex: 1,
    fontFamily: fontFamily.extraBold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.ink,
  },
  meta: {
    marginTop: 4,
    fontFamily: fontFamily.interMedium,
    fontSize: 13,
    color: colors.sub,
  },
  tagRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  posted: {
    fontFamily: fontFamily.interRegular,
    fontSize: 12,
    color: colors.sub,
  },
  newBadge: {
    backgroundColor: colors.amberTint,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newBadgeText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 11,
    color: colors.amberDark,
  },
  footRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginLeft: -6,
    borderWidth: 2,
    borderColor: colors.cardBg,
    backgroundColor: colors.mintTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitials: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 10,
    color: colors.green,
  },
  avatarOverflow: { backgroundColor: colors.chipBg },
  avatarOverflowText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 10,
    color: colors.sub,
  },
  applicantCount: {
    fontFamily: fontFamily.interMedium,
    fontSize: 12,
    color: colors.sub,
  },
  noApplicants: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    fontFamily: fontFamily.interRegular,
    fontSize: 12,
    color: colors.sub,
  },
});