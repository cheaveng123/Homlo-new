/**
 * components/inbox/MessageRow.tsx
 *
 * Redesigned message row:
 *  - job title leads (bold), "Worker · applicant" as its own line below
 *  - unread rows get a mint tint + a small coral badge on the avatar
 *  - trailing chevron affordance
 *  - NOTE: intentionally no online/presence dot on the avatar — removed
 *    per design decision, do not re-add it.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, sizes, spacing, type } from '../../theme/tokens';
import Avatar from '../chat/Avatar';

export type MessageStatus = 'applied' | 'interview' | null;

export type MessageRowData = {
  id: string;
  initial: string;
  photo?: string | null;
  jobTitle: string;
  time: string;
  fromLabel: string; // e.g. "Worker · applicant"
  snippet: string;
  unread: boolean;
  status: MessageStatus;
};

type Props = {
  data: MessageRowData;
  onPress?: (id: string) => void;
};

const STATUS_LABEL: Record<Exclude<MessageStatus, null>, string> = {
  applied: 'New applicant',
  interview: 'Interview',
};

export default function MessageRow({ data, onPress }: Props) {
  const { id, initial, photo, jobTitle, time, fromLabel, snippet, unread, status } = data;

  return (
    <Pressable
      onPress={() => onPress?.(id)}
      style={[styles.row, unread ? styles.rowUnread : styles.rowRead]}
    >
      <View style={styles.avatarWrap}>
        <Avatar photo={photo} style={[styles.avatar, unread && styles.avatarUnread]}>
          <Text style={type.avatarInitial44}>{initial}</Text>
        </Avatar>
        {unread && <View style={styles.unreadBadge} />}
      </View>

      <View style={styles.main}>
        <View style={styles.topRow}>
          <Text style={[type.rowJobTitle, styles.jobTitle]} numberOfLines={1}>
            {jobTitle}
          </Text>
          <Text style={[type.rowTime, styles.time]}>{time}</Text>
        </View>

        <Text style={[type.rowFrom, styles.from]}>{fromLabel}</Text>

        <Text
          style={[unread ? type.rowSnippetUnread : type.rowSnippet, unread ? styles.snippetUnread : styles.snippet]}
          numberOfLines={1}
        >
          {snippet}
        </Text>

        {status && (
          <View style={[styles.statusPill, status === 'applied' ? styles.statusApplied : styles.statusInterview]}>
            <Text
              style={[
                type.statusPill,
                { color: status === 'applied' ? colors.appliedText : colors.interviewText },
              ]}
            >
              {STATUS_LABEL[status]}
            </Text>
          </View>
        )}
      </View>

      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path
          d="M9 5L16 12L9 19"
          stroke={colors.sand400}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: radius.row,
    paddingVertical: spacing.rowPadY,
    paddingHorizontal: spacing.rowPadX,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.rowContentGap,
  },
  rowRead: {
    backgroundColor: colors.white,
    // shadow: 0 1px 2px rgba(14,59,42,.04), 0 8px 20px -14px rgba(14,59,42,.25)
    shadowColor: colors.forest900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  rowUnread: {
    backgroundColor: colors.mint100,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: sizes.avatarRow,
    height: sizes.avatarRow,
    borderRadius: radius.pill,
    backgroundColor: colors.mint100,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUnread: {
    backgroundColor: colors.white,
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: sizes.unreadBadge,
    height: sizes.unreadBadge,
    borderRadius: radius.pill,
    backgroundColor: colors.coral500,
    borderWidth: 2,
    borderColor: colors.white,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  jobTitle: {
    color: colors.forest900,
    flexShrink: 1,
  },
  time: {
    color: colors.sand400,
  },
  from: {
    color: colors.gray,
    marginTop: 2,
    marginBottom: 4,
  },
  snippet: {
    color: colors.gray,
  },
  snippetUnread: {
    color: colors.forest900,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 9,
    marginTop: 7,
  },
  statusApplied: {
    backgroundColor: colors.coral100,
  },
  statusInterview: {
    backgroundColor: colors.amber100,
  },
});
