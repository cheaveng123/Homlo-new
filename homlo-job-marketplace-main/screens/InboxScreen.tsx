/**
 * screens/InboxScreen.tsx
 *
 * Composes: InboxHeader, InboxSearchBar, SegmentedTabs, "Today / Earlier"
 * meta row, the message list (SectionList), and the FAB.
 *
 * Data: real conversations from the messaging service (`getConversations`),
 * refreshed on focus + on realtime message events. The redesigned list is a
 * single "Today / Earlier" feed; the segmented tabs filter the same
 * conversation data (Messages = all, Applications = has an application,
 * Updates = post-application status changes).
 *
 * Bottom tab bar is assumed to come from your Expo Router <Tabs />
 * navigator already — it is NOT re-implemented here.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import InboxHeader from '../components/inbox/InboxHeader';
import InboxSearchBar from '../components/inbox/InboxSearchBar';
import SegmentedTabs from '../components/common/SegmentedTabs';
import SectionLabel from '../components/common/SectionLabel';
import MessageRow, { MessageRowData } from '../components/inbox/MessageRow';
import { colors, radius, sizes, spacing, type } from '../theme/tokens';
import { useAuth } from '@/hooks/use-auth';
import { getMessagingService } from '@/lib/messaging';
import type { ConversationSummary } from '@/lib/messaging/types';
import { getProfilePhotoUrl } from '@/lib/profile-photo';
import { haptic } from '@/lib/haptics';

const TABS = ['Applications', 'Messages', 'Updates'];

const STATUS_LABELS: Record<string, string> = {
  applied: 'applicant',
  reviewed: 'applicant',
  interview: 'interview',
  hired: 'hired',
  rejected: 'rejected',
  declined: 'rejected',
  withdrawn: 'withdrawn',
};

const UPDATE_STATUSES = new Set(['interview', 'hired', 'rejected', 'declined', 'withdrawn']);

function initialsOf(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

function toMessageRowData(c: ConversationSummary): MessageRowData {
  const status = c.applicationStatus;
  const messageStatus: MessageRowData['status'] =
    status === 'interview' ? 'interview' : status ? 'applied' : null;
  const statusLabel = status ? (STATUS_LABELS[status] ?? status) : 'applicant';
  return {
    id: c.id,
    initial: initialsOf(c.otherParticipant.name),
    photo: c.otherParticipant.photo,
    jobTitle: c.jobTitle,
    time: timeAgo(c.lastMessageAt),
    fromLabel: `${c.otherParticipant.name} · ${statusLabel}`,
    snippet: c.lastMessage ?? '',
    unread: c.unreadCount > 0,
    status: messageStatus,
  };
}

type Props = {
  onOpenThread?: (id: string) => void;
};

export default function InboxScreen({ onOpenThread }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('Messages');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      const svc = await getMessagingService();
      const data = await svc.getConversations();
      setError(null);
      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Initial load + refresh whenever the inbox tab gains (or regains) focus.
  // useFocusEffect fires on mount for the focused screen too, so a plain
  // mount-time effect here would only double-fetch.
  useFocusEffect(
    useCallback(() => {
      void loadConversations();
    }, [loadConversations]),
  );

  /**
   * Content crossfade, so the feed under the tabs settles into the new tab
   * instead of swapping in on a single frame.
   *
   * Deliberately not keyed on `activeTab`: remounting the SectionList would
   * throw away the scroll offset every time the user peeks at another tab and
   * comes back. Animating opacity in place keeps the list mounted, so the
   * position survives.
   */
  const contentFade = useSharedValue(1);
  const isFirstTab = useRef(true);

  useEffect(() => {
    // Skip the very first render so the list doesn't fade in on mount, which
    // would fight the screen's own entrance.
    if (isFirstTab.current) {
      isFirstTab.current = false;
      return;
    }
    contentFade.value = 0;
    contentFade.value = withTiming(1, { duration: 240 });
  }, [activeTab, contentFade]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentFade.value,
    // A short rise rather than a slide across, which would fight the
    // horizontal movement of the pill above.
    transform: [{ translateY: (1 - contentFade.value) * 10 }],
  }));

  const filtered = useMemo(() => {
    if (activeTab === 'Applications') {
      return conversations.filter((c) => c.applicationStatus);
    }
    if (activeTab === 'Updates') {
      return conversations.filter((c) => c.applicationStatus && UPDATE_STATUSES.has(c.applicationStatus));
    }
    return conversations;
  }, [activeTab, conversations]);

  const sections = useMemo(() => {
    const now = new Date();
    const todayRows: MessageRowData[] = [];
    const earlierRows: MessageRowData[] = [];
    for (const c of filtered) {
      const row = toMessageRowData(c);
      const d = c.lastMessageAt ? new Date(c.lastMessageAt) : null;
      if (d && d.toDateString() === now.toDateString()) todayRows.push(row);
      else earlierRows.push(row);
    }
    return [
      { title: 'Today', data: todayRows },
      { title: 'Earlier this week', data: earlierRows },
    ];
  }, [filtered]);

  const hasUnread = useMemo(
    () => conversations.some((c) => c.unreadCount > 0),
    [conversations],
  );

  const handleOpenThread = useCallback(
    (id: string) => {
      if (onOpenThread) {
        onOpenThread(id);
        return;
      }
      const summary = conversations.find((c) => c.id === id);
      if (!summary) return;
      const photo = getProfilePhotoUrl(summary.otherParticipant.photo) ?? '';
      router.push({
        pathname: '/conversations/[id]',
        params: {
          id: summary.id,
          jobId: summary.jobId ?? '',
          name: summary.otherParticipant.name,
          jobTitle: summary.jobTitle,
          applicationStatus: summary.applicationStatus ?? '',
          photo,
        },
      } as never);
    },
    [conversations, onOpenThread, router],
  );

  const markAllRead = useCallback(async () => {
    if (!user || markingRead) return;
    setMarkingRead(true);
    try {
      const svc = await getMessagingService();
      await Promise.all(conversations.map((c) => svc.markAsRead(c.id).catch(() => {})));
      setConversations((prev) => prev.map((c) => ({ ...c, unreadCount: 0 })));
      haptic.light();
    } finally {
      setMarkingRead(false);
    }
  }, [conversations, markingRead, user]);

  if (authLoading || (user && loading)) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 14 }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.mint500} />
          <Text style={[type.chatRole, styles.loadingText]}>Loading…</Text>
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 14 }]}>
        <View style={styles.center}>
          <Text style={[type.rowJobTitle, styles.emptyTitle]}>Sign in to view your inbox</Text>
          <Text style={[type.chatRole, styles.emptyCopy]}>
            Your conversations and application updates appear here.
          </Text>
          <Pressable style={styles.emptyButton} onPress={() => router.push('/login' as never)}>
            <Text style={type.viewJobLabel}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 14 }]}>
      <InboxHeader hasNotification={hasUnread} onPressBell={() => haptic.selection()} />
      <InboxSearchBar
        onPressSearch={() => haptic.selection()}
        onPressFilter={() => haptic.selection()}
      />
      <SegmentedTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <View style={styles.listMeta}>
        <SectionLabel style={styles.listMetaLabel}>Today</SectionLabel>
        {hasUnread && (
          <Pressable disabled={markingRead} onPress={markAllRead}>
            <Text style={[type.markAllRead, styles.markAllRead]}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <Animated.View style={[styles.listWrap, contentStyle]}>
          {error && activeTab === 'Messages' && conversations.length === 0 ? (
          <View style={styles.center}>
          <Text style={[type.rowJobTitle, styles.emptyTitle]}>Couldn&rsquo;t load messages</Text>
          <Text style={[type.chatRole, styles.emptyCopy]}>{error}</Text>
          <Pressable style={styles.emptyButton} onPress={loadConversations}>
            <Text style={type.viewJobLabel}>Retry</Text>
          </Pressable>
          </View>
      ) : (
          <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadConversations();
              }}
              tintColor={colors.mint500}
              colors={[colors.mint500]}
            />
          }
          renderSectionHeader={({ section }) =>
            section.title === 'Today' ? null : (
              <SectionLabel style={styles.inlineSectionLabel}>{section.title}</SectionLabel>
            )
          }
          renderItem={({ item }) => <MessageRow data={item} onPress={handleOpenThread} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.rowGap }} />}
          SectionSeparatorComponent={() => <View style={{ height: spacing.rowGap }} />}
          showsVerticalScrollIndicator={false}
          />
      )}
      </Animated.View>

      <Pressable style={styles.fab} onPress={() => haptic.selection()}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={3} stroke={colors.white} strokeWidth={1.7} />
          <Path
            d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
            stroke={colors.white}
            strokeWidth={1.3}
          />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  // flex:1 so the SectionList inside still fills the space below the tab strip.
  listWrap: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 35,
  },
  loadingText: {
    color: colors.gray,
  },
  emptyTitle: {
    color: colors.forest900,
    textAlign: 'center',
  },
  emptyCopy: {
    color: colors.gray,
    lineHeight: 19,
    textAlign: 'center',
  },
  emptyButton: {
    alignItems: 'center',
    backgroundColor: colors.mint500,
    borderRadius: radius.pill,
    marginTop: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  listMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.screenX,
    marginTop: 10,
    marginBottom: 4,
  },
  listMetaLabel: {
    marginTop: 0,
  },
  markAllRead: {
    color: colors.mint700,
  },
  inlineSectionLabel: {
    marginHorizontal: 4,
    marginTop: 8,
  },
  listContent: {
    paddingHorizontal: spacing.listX,
    paddingTop: 2,
    paddingBottom: 16 + sizes.fab + 40, // clears the FAB
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 24, // was `92px` above a bottom-nav bar in the mockup; adjust
    // to sit above your actual Expo Router tab bar height.
    width: sizes.fab,
    height: sizes.fab,
    borderRadius: radius.pill,
    backgroundColor: colors.mint500,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.mint500,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
});