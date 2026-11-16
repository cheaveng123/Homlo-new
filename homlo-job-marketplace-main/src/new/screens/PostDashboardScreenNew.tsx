import React, { useEffect } from 'react';
import { Image, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIconNameNew, AppIconNew } from '../icons/AppIconNew';
import { TextNew } from '../components/TextNew';
import {
  AvatarNew, ButtonNew, ChipNew, FloatingShapeNew, IconDiscNew, PressableScaleNew, PulseDotNew, RoundButtonNew, SectionTitleNew, UnderlineTabsNew, cardBoxNew,
} from '../components/PrimitivesNew';
import { ProgressRingNew } from '../components/ProgressRingNew';
import { colorsNew, radiusNew } from '../theme/tokensNew';
import { useCopyNew } from '../theme/copyNew';
import { useCountUpNew, useEnterNew, motionNew } from '../theme/motionNew';
import { DashboardJobRowsSkeleton, DashboardStatCardSkeleton } from '@/src/new/components/NewSkeletons';

export type ManageItemNew = { key: string; icon: AppIconNameNew; label: string; count: number; series: number[] }; // Applications, Job Posts, Live Jobs, View Applications
export type DashJobNew = { id: string; title: string; dateLabel: string; positionsLeft: number; positionsLeftLabel: string; positionsLabel: string; employerInitials: string; imageUri?: string };

type Props = {
  stats: { live: number; posted: number; applications: number; newApplicants: number };
  initials: string; hasUnread?: boolean; onPressBell: () => void; onPressSearch?: () => void; // keep the dashboard search if the app has one
  onAddJob: () => void;
  manage: ManageItemNew[]; onPressManage: (key: string) => void;
  tabs: { key: string; label: string }[]; activeTab: string; onChangeTab: (k: string) => void; // Live / Draft / Review with counts in the label
  jobs: DashJobNew[]; onPressJob: (id: string) => void; onPressJobMenu: (id: string) => void;
  onRefresh?: () => void; refreshing?: boolean; bottomInset?: number; loading?: boolean;
};

function Spark({ series }: { series: number[] }) {
  const max = Math.max(...series, 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 20 }}>
      {series.map((v, i) => <Bar key={i} h={Math.max(3, (v / max) * 20)} last={i === series.length - 1} delay={300 + i * 70} />)}
    </View>
  );
}
function Bar({ h, last, delay }: { h: number; last: boolean; delay: number }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? h : 2);
  useEffect(() => { if (!reduced) v.value = withDelay(delay, withTiming(h, { duration: 700 })); }, [h, reduced]);
  const a = useAnimatedStyle(() => ({ height: v.value }));
  return <Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: last ? colorsNew.primary : colorsNew.tint2 }, a]} />;
}
function KV({ label, value }: { label: string; value: number }) {
  const n = useCountUpNew(value);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <TextNew variant="meta" color={colorsNew.muted}>{label}</TextNew>
      <TextNew variant="title" heading weight="extrabold">{n}</TextNew>
    </View>
  );
}

export function PostDashboardScreenNew(p: Props) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const enter = useEnterNew();
  const live = useCountUpNew(p.stats.live);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colorsNew.white }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 + (p.bottomInset ?? 0) }}
      showsVerticalScrollIndicator={false}
      refreshControl={p.onRefresh ? <RefreshControl refreshing={!!p.refreshing} onRefresh={p.onRefresh} tintColor={colorsNew.primary} colors={[colorsNew.primary]} /> : undefined}
    >
      <Animated.View entering={enter(0)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
        <View style={{ gap: 6 }}>
          <TextNew variant="hero">{copy.post.title}</TextNew>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: colorsNew.tint, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 }}>
            <PulseDotNew />
            <TextNew variant="caption" weight="semibold" color={colorsNew.deep}>{p.loading ? copy.post.live : copy.post.liveNow(p.stats.live)}</TextNew>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {p.onPressSearch && <RoundButtonNew icon="search" onPress={p.onPressSearch} />}
          <RoundButtonNew icon="bell" dot={p.hasUnread} onPress={p.onPressBell} />
          <AvatarNew initials={p.initials} />
        </View>
      </Animated.View>

      {/* overview: tinted card with drifting shapes, ring fills on entry, numbers count up */}
      {p.loading ? (
        <DashboardStatCardSkeleton />
      ) : (
        <Animated.View entering={enter(1)} style={[cardBoxNew, { marginHorizontal: 16, marginTop: 16 }]}>
          <LinearGradient colors={[colorsNew.tint, colorsNew.white]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 0.4 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <FloatingShapeNew style={{ right: -30, top: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: colorsNew.tint2, opacity: 0.5 }} />
          <FloatingShapeNew dx={-12} dy={-10} duration={11000} style={{ right: 30, bottom: -30, width: 70, height: 70, borderRadius: 22, backgroundColor: colorsNew.cream, opacity: 0.9 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 }}>
            <ProgressRingNew progress={p.stats.posted ? p.stats.live / p.stats.posted : 0} size={96} stroke={11}>
              <View style={{ alignItems: 'center' }}>
                <TextNew variant="hero">{live}</TextNew>
                <TextNew variant="caption" color={colorsNew.muted}>{copy.post.live}</TextNew>
              </View>
            </ProgressRingNew>
            <View style={{ flex: 1, gap: 10 }}>
              <KV label={copy.post.posted} value={p.stats.posted} />
              <KV label={copy.post.applications} value={p.stats.applications} />
              <KV label={copy.post.newApplicants} value={p.stats.newApplicants} />
            </View>
          </View>
        </Animated.View>
      )}

      <Animated.View entering={enter(2)} style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <ButtonNew sweep leftIcon="plus" label={copy.post.add} onPress={p.onAddJob} />
      </Animated.View>

      <Animated.View entering={enter(3)}>
        <SectionTitleNew title={copy.post.manage} />
        <View style={[cardBoxNew, { marginHorizontal: 16, shadowOpacity: 0 }]}>
          {p.manage.map((m, i) => (
            <PressableScaleNew key={m.key} onPress={() => p.onPressManage(m.key)}
              style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderColor: colorsNew.border }}>
              <IconDiscNew icon={m.icon} tone={i % 2 ? 'sunrise' : 'lagoon'} />
              <TextNew variant="title" weight="medium" style={{ flex: 1 }} numberOfLines={1}>{m.label}</TextNew>
              <Spark series={m.series} />
              {!p.loading && <TextNew variant="title" heading weight="extrabold" style={{ minWidth: 28, textAlign: 'right' }}>{m.count}</TextNew>}
              <AppIconNew name="chev" size={18} color={colorsNew.muted} />
            </PressableScaleNew>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={enter(4)} style={{ marginTop: 24 }}>
        <UnderlineTabsNew tabs={p.tabs} active={p.activeTab} onChange={p.onChangeTab} />
        {p.loading ? (
          <DashboardJobRowsSkeleton />
        ) : (
          p.jobs.map((j, i) => (
            <Animated.View key={j.id} entering={enter(i + 5)}>
              <PressableScaleNew scaleTo={motionNew.pressCard} onPress={() => p.onPressJob(j.id)}
                style={[cardBoxNew, { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 12, padding: 10 }]}>
                <View style={{ width: 84, height: 84, borderRadius: radiusNew.tile, overflow: 'hidden' }}>
                  {j.imageUri ? <Image source={{ uri: j.imageUri }} style={{ width: 84, height: 84 }} /> : <LinearGradient colors={['#D8C7A8', '#F4ECDD', '#BFD0CF']} style={{ flex: 1 }} />}
                  <View style={{ position: 'absolute', left: 6, top: 6 }}><AvatarNew initials={j.employerInitials} size={28} border /></View>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <TextNew variant="meta" color={colorsNew.muted}>{j.dateLabel}</TextNew>
                  <TextNew variant="title" weight="semibold" numberOfLines={1}>{j.title}</TextNew>
                  <ChipNew label={j.positionsLeftLabel} tone={j.positionsLeft <= 1 ? 'clay' : 'lagoon'} />
                  <TextNew variant="body" heading weight="extrabold">{j.positionsLabel}</TextNew>
                </View>
                <PressableScaleNew onPress={() => p.onPressJobMenu(j.id)} accessibilityLabel="More" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <AppIconNew name="dots" color={colorsNew.muted} />
                </PressableScaleNew>
              </PressableScaleNew>
            </Animated.View>
          ))
        )}
      </Animated.View>
    </ScrollView>
  );
}
