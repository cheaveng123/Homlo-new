// ApplicantTicketCard: ticket-style application card with dashed cut + side notches, Accept / Reject only
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from './job-management-tokens';

export type ApplicantStatus = 'pending' | 'accepted' | 'rejected';
export type Applicant = {
  id: string;
  name: string;
  appliedAt: string;
  note: string;
  location: string;
  status: ApplicantStatus;
  /**
   * Unread. Set by the employer applicant screens from `JobApplicant.isNew`,
   * which is derived from the `viewed_at` read receipt (migration 042) rather
   * than the pipeline status. Left undefined by callers that don't track it.
   */
  isNew?: boolean;
  /**
   * Which listing this applicant applied to. Only rendered by screens that mix
   * applicants from several jobs (New applicants); per-job screens leave it off.
   */
  jobTitle?: string;
};

/**
 * Collapses the six pipeline statuses onto the three the ticket can express.
 *
 * Lives here rather than in a screen so the per-job list and the cross-job list
 * can't drift apart on what "accepted" means.
 */
export function ticketStatus(status: string): ApplicantStatus {
  if (status === 'hired') return 'accepted';
  if (status === 'declined' || status === 'withdrawn') return 'rejected';
  return 'pending';
}

type Props = {
  applicant: Applicant;
  onAccept: () => void;
  onReject: () => void;
  onMessage: () => void;
  /** Makes the header open the applicant detail screen. Omitted where the ticket's own actions are the point. */
  onPress?: () => void;
};

const TAG = {
  pending: { bg: colors.amberBg, fg: colors.amberText, label: 'Pending' },
  accepted: { bg: colors.tint, fg: colors.mint, label: 'Accepted' },
  rejected: { bg: colors.redTint, fg: colors.red, label: 'Rejected' },
};

export default function ApplicantTicketCard({ applicant: a, onAccept, onReject, onMessage, onPress }: Props) {
  const tag = TAG[a.status];
  return (
    <View style={styles.ticket}>
      {/* Only the header opens the detail screen; the Accept/Reject buttons
          below stay separate so a mis-tap can't change a pipeline status. */}
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.top, pressed && styles.topPressed]}
      >
        <View style={styles.who}>
          <View style={styles.av}>
            <Text style={styles.avTx}>{a.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, !a.isNew && styles.nameSeen]}>{a.name}</Text>
            <Text style={styles.small}>Applied {a.appliedAt}</Text>
          </View>
          <View style={styles.tagWrap}>
            {a.isNew ? <View style={styles.unreadDot} /> : null}
            <View style={[styles.tag, { backgroundColor: tag.bg }]}>
              <Text style={[styles.tagTx, { color: tag.fg }]}>{tag.label}</Text>
            </View>
          </View>
        </View>
        {a.note ? (
          <View style={styles.note}>
            <Text style={styles.noteTx}>{'"'}{a.note}{'"'}</Text>
          </View>
        ) : null}
        {a.jobTitle ? (
          <Text style={styles.meta} numberOfLines={1}>{a.jobTitle}{' · '}{a.location}</Text>
        ) : (
          <Text style={styles.meta}>{a.location}</Text>
        )}
      </Pressable>

      {a.status !== 'rejected' && (
        <>
          <View style={styles.cut}>
            <View style={styles.dashes}>
              {Array.from({ length: 30 }).map((_, i) => (
                <View key={i} style={styles.dash} />
              ))}
            </View>
            <View style={[styles.notch, { left: -10 }]} />
            <View style={[styles.notch, { right: -10 }]} />
          </View>
          <View style={styles.bot}>
            {a.status === 'pending' ? (
              <>
                <Pressable onPress={onReject} style={[styles.btn, styles.rej, { flex: 1 }]}>
                  <Text style={[styles.btnTx, { color: colors.red }]}>Reject</Text>
                </Pressable>
                <Pressable onPress={onAccept} style={[styles.btn, { backgroundColor: colors.mint, flex: 1.4 }]}>
                  <Text style={[styles.btnTx, { color: colors.white }]}>Accept</Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={onMessage} style={[styles.btn, { backgroundColor: colors.white, flex: 1 }]}>
                <Text style={[styles.btnTx, { color: colors.forest }]}>Message</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: { backgroundColor: colors.bg, borderRadius: 26, marginBottom: 16 },
  top: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  av: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  avTx: { fontFamily: font.h800, fontSize: 16, color: colors.mint },
  name: { fontFamily: font.b600, fontSize: 15, color: colors.forest },
  // Read applications recede so the unread dot is the only thing competing for attention.
  nameSeen: { color: colors.muted },
  small: { fontFamily: font.b400, fontSize: 12, color: colors.muted, marginTop: 1 },
  tagWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mint },
  tag: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999 },
  tagTx: { fontFamily: font.b600, fontSize: 11 },
  note: { marginTop: 12, backgroundColor: colors.white, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  noteTx: { fontFamily: font.b400, fontSize: 13, lineHeight: 19, color: colors.forest },
  topPressed: { opacity: 0.7 },
  meta: { marginTop: 10, fontFamily: font.b400, fontSize: 12, color: colors.muted },
  cut: { height: 0, overflow: 'visible' },
  dashes: { position: 'absolute', left: 22, right: 22, top: -1, height: 2, flexDirection: 'row', justifyContent: 'space-between' },
  dash: { width: 5, height: 2, backgroundColor: colors.dash },
  notch: { position: 'absolute', top: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  bot: { flexDirection: 'row', gap: 10, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16 },
  btn: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  rej: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.redBorder },
  btnTx: { fontFamily: font.b600, fontSize: 15 },
});