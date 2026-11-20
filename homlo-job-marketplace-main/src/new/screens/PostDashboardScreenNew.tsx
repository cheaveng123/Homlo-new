import React from 'react';
import { RefreshControl, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import { useCopyNew } from '../theme/copyNew';
import { EmptyStateNew } from '../components/PrimitivesNew';
import { DashboardJobRowsSkeleton } from '@/src/new/components/NewSkeletons';
import { DashHeaderNew } from '../components/dashboard/DashHeaderNew';
import { DashHeroNew } from '../components/dashboard/DashHeroNew';
import { DashManageNew } from '../components/dashboard/DashManageNew';
import { DashTabsNew, type DashTab } from '../components/dashboard/DashTabsNew';
import { DashJobCardNew, type DashCardJob } from '../components/dashboard/DashJobCardNew';
import { DashBottomNavNew, dashNavHeight } from '../components/dashboard/DashBottomNavNew';
import { dash, HEADER_H } from '../components/dashboard/dashTokens';

/** Applications, Closed jobs, Live jobs, New applicants. `key` picks the animated icon. */
export type ManageItemNew = { key: string; label: string; count: number };
export type DashJobNew = DashCardJob;

type Props = {
  stats: { live: number; posted: number; applications: number; newApplicants: number };
  initials: string; hasUnread?: boolean; onPressBell: () => void; onPressSearch?: () => void;
  onAddJob: () => void;
  manage: ManageItemNew[]; onPressManage: (key: string) => void;
  /** Live / Draft / Review. `count` is omitted while loading. */
  tabs: DashTab[]; activeTab: string; onChangeTab: (k: string) => void;
  jobs: DashJobNew[]; onBoostExpire?: () => void; onPressJob: (id: string) => void; onPressJobMenu: (id: string) => void;
  onRefresh?: () => void; refreshing?: boolean; loading?: boolean;
  /** Shown instead of a blank area when the current tab has no jobs. */
  empty?: { title: string; actionLabel?: string; onAction?: () => void };
  /** Own bottom bar for the stack route; omitted when the tab layout draws it. */
  nav?: { activeKey: string; onSelect: (key: string) => void; badgeCount?: number };
};

export function PostDashboardScreenNew(p: Props) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const headerH = HEADER_H + insets.top;
  const navH = p.nav ? dashNavHeight(insets.bottom) : 0;

  // One scroll value drives header, hero parallax, sticky tabs, card reveal and photo parallax.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const viewportH = useSharedValue(800); // visible area between the top and the nav
  const sheetY = useSharedValue(0);
  const tabsY = useSharedValue(0);
  const listY = useSharedValue(0);
  const listTop = useSharedValue(0);
  const syncListTop = () => { listTop.value = sheetY.value + listY.value; };

  // Tabs stick right under the absolute header (an equivalent of stickyHeaderIndices with a top offset).
  const stickyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, scrollY.value + headerH - (sheetY.value + tabsY.value)) }],
  }));

  return (
    <View style={s.root}>
      <Animated.ScrollView
        style={s.root}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onLayout={(e: LayoutChangeEvent) => { viewportH.value = e.nativeEvent.layout.height - navH; }}
        contentContainerStyle={{ paddingBottom: navH + 16 }}
        refreshControl={
          p.onRefresh ? (
            <RefreshControl
              refreshing={!!p.refreshing}
              onRefresh={p.onRefresh}
              tintColor="#fff"
              colors={[dash.cyan]}
              progressViewOffset={headerH}
            />
          ) : undefined
        }
      >
        {/* keeps the iOS pull-down bounce cyan instead of white */}
        <View pointerEvents="none" style={s.overscroll} />

        <DashHeroNew
          topInset={insets.top}
          scrollY={scrollY}
          live={p.stats.live}
          liveRatio={p.stats.posted ? p.stats.live / p.stats.posted : 0}
          liveLabel={copy.post.liveShort}
          rows={[
            { label: copy.post.posted, value: p.stats.posted },
            { label: copy.post.applications, value: p.stats.applications },
            { label: copy.post.newApplicants, value: p.stats.newApplicants },
          ]}
          loading={p.loading}
          addLabel={copy.post.add}
          onAddJob={p.onAddJob}
        />

        <View
          style={s.sheet}
          onLayout={(e) => { sheetY.value = e.nativeEvent.layout.y; syncListTop(); }}
        >
          <DashManageNew title={copy.post.manage} items={p.manage} loading={p.loading} focused={focused} onPress={p.onPressManage} />

          <Animated.View
            style={[s.tabs, stickyStyle]}
            onLayout={(e) => { tabsY.value = e.nativeEvent.layout.y; }}
          >
            <DashTabsNew tabs={p.tabs} active={p.activeTab} onChange={p.onChangeTab} />
          </Animated.View>

          <View onLayout={(e) => { listY.value = e.nativeEvent.layout.y; syncListTop(); }}>
            {p.loading ? (
              <View style={s.skeleton}><DashboardJobRowsSkeleton /></View>
            ) : (
              // Keyed by tab so switching tabs re-plays the card entrance.
              <View key={p.activeTab}>
                {p.jobs.length === 0 && p.empty ? (
                  <EmptyStateNew icon="search" title={p.empty.title} actionLabel={p.empty.actionLabel} onAction={p.empty.onAction} />
                ) : null}
                {p.jobs.map((j, i) => (
                  <DashJobCardNew
                    key={j.id}
                    job={j}
                    index={i}
                    scrollY={scrollY}
                    listTop={listTop}
                    viewportH={viewportH}
                    focused={focused}
                    onPress={() => p.onPressJob(j.id)}
                    onPressMenu={() => p.onPressJobMenu(j.id)}
                    onBoostExpire={p.onBoostExpire}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      <DashHeaderNew
        title={copy.post.title}
        topInset={insets.top}
        scrollY={scrollY}
        initials={p.initials}
        hasUnread={p.hasUnread}
        onPressSearch={p.onPressSearch}
        onPressBell={p.onPressBell}
      />

      {/* Rendered last with zIndex 50: nothing in the scroll view may paint over it. */}
      {p.nav && <DashBottomNavNew activeKey={p.nav.activeKey} onSelect={p.nav.onSelect} badgeCount={p.nav.badgeCount} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: dash.surface },
  overscroll: { position: 'absolute', top: -1000, left: 0, right: 0, height: 1000, backgroundColor: '#0B7F9B' },
  sheet: {
    marginTop: -26,
    backgroundColor: dash.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 22,
    paddingHorizontal: 16,
  },
  // full-bleed white so cards scrolling under the stuck tabs never show in the gutters
  tabs: { marginTop: 24, marginHorizontal: -16, paddingHorizontal: 16, zIndex: 10, backgroundColor: dash.surface },
  skeleton: { marginHorizontal: -16 },
});
