import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { AppIconNameNew } from '../icons/AppIconNew';
import { TextNew } from '../components/TextNew';
import { AvatarNew, ChipNew, EmptyStateNew, FieldNew, IconDiscNew, PressableScaleNew, RoundButtonNew, SectionTitleNew, SkeletonNew, TicketNew, UnderlineTabsNew } from '../components/PrimitivesNew';
import Avatar from '../../../components/chat/Avatar';
import { colorsNew } from '../theme/tokensNew';
import { useCopyNew } from '../theme/copyNew';
import { useEnterNew } from '../theme/motionNew';
import { ScreenStateNew } from '../types/jobNew';

export type NotificationNew = { id: string; icon: AppIconNameNew; title: string; body: string; timeLabel: string; unread?: boolean };
export type NotificationGroupNew = { title: string; items: NotificationNew[] }; // Today / Yesterday ...
export type ConversationNew = { id: string; name: string; initials: string; color?: string; photo?: string | null; preview: string; timeLabel: string; unreadCount?: number };
export type UpcomingNew = { eyebrow: string; title: string; subtitle?: string; stubTop: string; stubBottom?: string; onPress?: () => void }; // only render when the app has this data

type Props = {
  state: ScreenStateNew; tab: string; onChangeTab: (t: string) => void; onPressSearch?: () => void;
  // Tabs are supplied by the adapter so the app's own tab set (Applications /
  // Messages / Updates) is preserved. Defaults to the design's two tabs.
  tabs?: { key: string; label: string }[];
  upcoming?: UpcomingNew;
  active?: { id: string; label: string; initials: string; color?: string }[]; onPressActive?: (id: string) => void;
  filters?: { id: string; label: string; icon?: AppIconNameNew }[]; activeFilterId?: string; onSelectFilter?: (id: string) => void;
  groups: NotificationGroupNew[]; onPressNotification: (id: string) => void;
  conversations: ConversationNew[]; contactQuery: string; onChangeContactQuery: (q: string) => void; onPressConversation: (id: string) => void;
  applicationsTab?: React.ReactNode;
  refreshing?: boolean; onRefresh?: () => void;
  onRetry: () => void;
};

export function InboxScreenNew(p: Props) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const enter = useEnterNew();
  const tabs = p.tabs ?? [{ key: 'notifications', label: copy.inbox.notifications }, { key: 'messages', label: copy.inbox.messages }];
  return (
    <View style={{ flex: 1, backgroundColor: colorsNew.white, paddingTop: insets.top + 8 }}>
      <Animated.View entering={enter(0)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
        <TextNew variant="hero">{copy.inbox.title}</TextNew>
        {p.onPressSearch && <RoundButtonNew icon="search" onPress={p.onPressSearch} />}
      </Animated.View>
      <View style={{ marginTop: 8 }}>
        <UnderlineTabsNew tabs={tabs} active={p.tab} onChange={(k) => p.onChangeTab(k)} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          p.onRefresh ? (
            <RefreshControl
              colors={[colorsNew.primary]}
              onRefresh={p.onRefresh}
              refreshing={Boolean(p.refreshing)}
              tintColor={colorsNew.primary}
            />
          ) : undefined
        }
      >
        {p.state === 'loading' && [0, 1, 2, 3].map((i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12, padding: 16, alignItems: 'center' }}>
            <SkeletonNew width={44} height={44} radius={22} /><View style={{ flex: 1, gap: 8 }}><SkeletonNew height={14} width="50%" /><SkeletonNew height={12} /></View>
          </View>
        ))}
        {p.state === 'error' && <EmptyStateNew icon="x" tone="clay" title={copy.results.error} actionLabel={copy.common.retry} onAction={p.onRetry} />}
        {p.state === 'empty' && <EmptyStateNew icon="bell" title={p.tab === 'messages' ? copy.inbox.emptyMessages : copy.inbox.empty} />}

        {p.state === 'ready' && p.tab === 'notifications' && (
          <>
            {p.upcoming && <Animated.View entering={enter(1)} style={{ marginTop: 16 }}><TicketNew {...p.upcoming} /></Animated.View>}
            {!!p.active?.length && (
              <Animated.View entering={enter(2)}>
                <SectionTitleNew title={copy.inbox.active} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                  {p.active.map((a) => (
                    <PressableScaleNew key={a.id} onPress={() => p.onPressActive?.(a.id)} style={{ width: 64, alignItems: 'center', gap: 4 }}>
                      <View style={{ padding: 2, borderRadius: 30, borderWidth: 2, borderColor: colorsNew.tint2 }}><AvatarNew initials={a.initials} size={52} bg={a.color} /></View>
                      <TextNew variant="caption" numberOfLines={1}>{a.label}</TextNew>
                    </PressableScaleNew>
                  ))}
                </ScrollView>
              </Animated.View>
            )}
            {!!p.filters?.length && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginTop: 16 }}>
                {p.filters.map((f) => <ChipNew key={f.id} size="lg" icon={f.icon} label={f.label} selected={f.id === p.activeFilterId} onPress={() => p.onSelectFilter?.(f.id)} />)}
              </ScrollView>
            )}
            {p.groups.map((g, gi) => (
              <Animated.View key={g.title} entering={enter(gi + 3)}>
                <TextNew variant="caption" weight="semibold" color={colorsNew.muted} style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 4 }}>{g.title.toUpperCase()}</TextNew>
                <View>
                  <View style={{ position: 'absolute', left: 37, top: 20, bottom: 20, width: 2, backgroundColor: colorsNew.track }} />
                  {g.items.map((n) => (
                    <PressableScaleNew key={n.id} onPress={() => p.onPressNotification(n.id)} style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'flex-start' }}>
                      <IconDiscNew icon={n.icon} round />
                      <View style={{ flex: 1 }}>
                        <TextNew variant="title" weight={n.unread ? 'semibold' : 'medium'}>{n.title}</TextNew>
                        <TextNew variant="meta" color={colorsNew.muted}>{n.body}</TextNew>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <TextNew variant="meta" color={colorsNew.muted}>{n.timeLabel}</TextNew>
                        {n.unread && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colorsNew.primary }} />}
                      </View>
                    </PressableScaleNew>
                  ))}
                </View>
              </Animated.View>
            ))}
          </>
        )}

        {p.state === 'ready' && p.tab !== 'notifications' && p.tab !== 'applications' && (
          <Animated.View entering={enter(1)} style={{ paddingHorizontal: 0 }}>
            <View style={{ paddingHorizontal: 16 }}>
              <FieldNew leftIcon="search" value={p.contactQuery} onChangeText={p.onChangeContactQuery} placeholder={copy.inbox.searchContacts} />
            </View>
            {p.conversations.map((c) => (
              <PressableScaleNew key={c.id} onPress={() => p.onPressConversation(c.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 72 }}>
                <Avatar photo={c.photo} style={{ width: 52, height: 52, borderRadius: 26 }}>
                  <AvatarNew initials={c.initials} size={52} bg={c.color} />
                </Avatar>
                <View style={{ flex: 1 }}>
                  <TextNew variant="title" weight="semibold">{c.name}</TextNew>
                  <TextNew variant="meta" color={colorsNew.muted} numberOfLines={1}>{c.preview}</TextNew>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <TextNew variant="meta" color={colorsNew.muted}>{c.timeLabel}</TextNew>
                  {!!c.unreadCount && (
                    <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colorsNew.primary, alignItems: 'center', justifyContent: 'center' }}>
                      <TextNew variant="caption" weight="semibold" color={colorsNew.white}>{c.unreadCount}</TextNew>
                    </View>
                  )}
                </View>
              </PressableScaleNew>
            ))}
          </Animated.View>
        )}

        {p.state === 'ready' && p.tab === 'applications' && (
          <Animated.View entering={enter(1)}>{p.applicationsTab}</Animated.View>
        )}
      </ScrollView>
    </View>
  );
}
