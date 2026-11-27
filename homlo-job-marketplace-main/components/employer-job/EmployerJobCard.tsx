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
import { useRouter } from "@/lib/router";

import { ScalePressable } from "@/components/ui/scale-pressable";
import Svg, { Path } from "react-native-svg";
import { JobStatusBadge, type ListingStatus as JobStatus } from "@/components/employer-job/manager/JobStatusBadge";
import { AP } from "@/components/employer-job/applicants/tokens";
import { ChevronGlyph, PinGlyph } from "@/components/employer-job/applicants/ApplicantGlyphs";
import { useBoostCountdown } from "@/components/boost/useBoostCountdown";
import { formatPostedAgo } from "@/lib/format";
import { getProfilePhotoUrl } from "@/lib/profile-photo";
import { isNewApplicant, type EmployerApplication } from "@/hooks/use-employer-applications";
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
  /** Employer-side boost state (from GET /api/boosts/job/:id or the job row). */
  boost?: EmployerJob['boost'];
  /** Called when the boost expires so the parent can refetch. */
  onExpire?: () => void;
};

export function EmployerJobCard({ job, applications, positionsAvailable, boost, onExpire }: EmployerJobCardProps) {
  const router = useRouter();

  const unread = applications.filter(isNewApplicant).length;
  const shown = applications.slice(0, MAX_AVATARS);
  const overflow = applications.length - shown.length;

  const location = job.locationLabel?.trim() || job.category?.trim() || "";
  const posted = job.createdAt ? formatPostedAgo(job.createdAt) : "";

  const activeBoost = boost?.status === 'active';
  const { expired, label: boostLeft } = useBoostCountdown(activeBoost ? boost?.endsAt ?? null : null, boost?.serverNow ?? null, onExpire);
  const showEmployerBadge = Boolean(boost && boost.status !== 'none' && !expired);

  return (
    <ScalePressable
      hapticFeedback
      containerStyle={styles.wrap}
      style={[styles.card, showEmployerBadge ? styles.cardBoosted : null]}
      accessibilityRole="button"
      accessibilityLabel={`${job.title}, ${applications.length} ${
        applications.length === 1 ? "applicant" : 'applicants'
      }${unread > 0 ? `, ${unread} new` : ""}${showEmployerBadge ? ', boosted' : ''}`}
      onPress={() =>
        router.push({
          pathname: "/employer/job/[id]",
          params: { id: job.id },
        } as never)
      }
    >
      <View style={styles.headRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.title} numberOfLines={2}>
            {job.title || "Untitled job"}
          </Text>
          {location ? (
            <View style={styles.metaRow}>
              <PinGlyph />
              <Text style={styles.meta} numberOfLines={1}>{location}</Text>
            </View>
          ) : null}
        </View>
        {showEmployerBadge && (
          <View style={styles.boostCol} accessibilityLabel={boostLeft ? `Boosted, ${boostLeft} left` : 'Boosted'}>
            <View style={styles.boostTile}>
              <Svg width={18} height={18} viewBox="0 0 24 24"><Path d="M13.4 2.8 5.6 13.2h5.5l-1.3 8 7.9-10.6h-5.6Z" fill={AP.amber} /></Svg>
            </View>
            {boostLeft ? <Text style={styles.boostLeft}>{boostLeft}</Text> : null}
          </View>
        )}
      </View>

      <View style={styles.tagRow}>
        <JobStatusBadge status={pillStatus(job.status)} positionsAvailable={positionsAvailable} />
        {unread > 0 ? (
          <View style={styles.newBadge}>
            <View style={styles.newDot} />
            <Text style={styles.newBadgeText}>{unread} new</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footRow}>
        {applications.length > 0 ? (
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
            <Text style={styles.applicantCount}>
              {applications.length === 1 ? "1 applicant" : `${applications.length} applicants`}
            </Text>
          </View>
        ) : (
          <Text style={styles.noApplicants}>No applicants yet</Text>
        )}
        <View style={styles.footRight}>
          {posted ? <Text style={styles.posted}>{posted}</Text> : null}
          <ChevronGlyph />
        </View>
      </View>
    </ScalePressable>
  );
}

const F = { h: 'PlusJakartaSans_800ExtraBold', hb: 'PlusJakartaSans_700Bold', m: 'Inter_500Medium', s: 'Inter_600SemiBold' };

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E3E9EC',
    shadowColor: '#12303C',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardBoosted: { borderColor: '#EAD7AE' },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: F.h, fontSize: 17, lineHeight: 22, color: AP.navy },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { flexShrink: 1, fontFamily: F.m, fontSize: 13, color: AP.muted },
  boostCol: { alignItems: 'center', gap: 4 },
  boostTile: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAD7AE',
  },
  boostLeft: { fontFamily: F.hb, fontSize: 10.5, color: AP.amberDeep },
  tagRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  newBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 9,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E9EC',
  },
  newDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: AP.amber },
  newBadgeText: { fontFamily: F.hb, fontSize: 12.5, color: AP.amberDeep },
  footRow: {
    marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D9E3E7',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  avatars: { flexDirection: 'row', alignItems: 'center', paddingLeft: 6 },
  avatar: {
    width: 28, height: 28, borderRadius: 14, marginLeft: -6, borderWidth: 2, borderColor: '#FFFFFF',
    backgroundColor: AP.tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarInitials: { fontFamily: F.hb, fontSize: 10, color: AP.cyanDeep },
  avatarOverflow: { backgroundColor: AP.bg },
  avatarOverflowText: { fontFamily: F.hb, fontSize: 10, color: AP.muted },
  applicantCount: { marginLeft: 8, fontFamily: F.s, fontSize: 13, color: AP.ink },
  noApplicants: { fontFamily: F.m, fontSize: 13, color: AP.muted },
  footRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  posted: { fontFamily: F.m, fontSize: 12, color: AP.faint },
});
