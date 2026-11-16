import React, { ReactNode, useCallback, useRef } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIconNew } from '../icons/AppIconNew';
import { TextNew } from '../components/TextNew';
import { PressableScaleNew, RoundButtonNew, SectionTitleNew, TagNew } from '../components/PrimitivesNew';
import { SearchPillNew } from '../components/SearchPillNew';
import { JobCardTallNew, JobRowNew } from '../components/JobPartsNew';
import { HomeExploreGridSkeleton, HomeRecommendedSkeleton, HomeRowsSkeleton } from '@/src/new/components/NewSkeletons';
import { colorsNew, radiusNew } from '../theme/tokensNew';
import { useCopyNew } from '../theme/copyNew';
import { useEnterNew } from '../theme/motionNew';
import { JobSummaryNew } from '../types/jobNew';

export type JobFieldNew = { id: string; label: string; icon: ReactNode }; // icon = your EXISTING custom artwork
export type JobTypeNew = { id: string; label: string; tagline?: string; countLabel?: string };

type Props = {
  locationLabel: string; onPressLocation: () => void; onPressBell: () => void;
  /** Number of saved jobs — shown as a badge on the header's heart button. */
  savedCount?: number;
  onPressSearch: () => void; onPressFilter: () => void;
  searchPlaceholderSlot?: ReactNode; // pass the existing animated placeholder to keep it
  jobFields: JobFieldNew[]; selectedFieldId?: string; onSelectField: (id: string) => void;
  jobTypes: JobTypeNew[]; onSelectJobType: (id: string) => void;
  recommended: JobSummaryNew[]; onSeeAllRecommended: () => void;
  recommendedLoading?: boolean;
  nearby: JobSummaryNew[];
  nearbyLoading?: boolean;
  onPressJob: (id: string) => void; onToggleLike: (id: string) => void;
  // Optional impression tracking for FlatList sections
  onViewableItemsChanged?: (info: { viewableItems: Array<{ item?: any; isViewable?: boolean }> }) => void;
  viewabilityConfig?: any;
  // Sections retained from the pre-redesign Home (approved extension).
  popularJobs?: JobSummaryNew[]; popularLoading?: boolean; onSeePopular?: () => void;
  exploreJobs?: JobSummaryNew[]; exploreLoading?: boolean; onSeeExplore?: () => void;
  onPostJob?: () => void;
};

const PROMO = [
  { bg: colorsNew.cream, ink: colorsNew.creamStrong, sub: colorsNew.creamInk, tagBg: colorsNew.deep, tagInk: colorsNew.white },
  { bg: colorsNew.deep, ink: colorsNew.white, sub: 'rgba(255,255,255,0.85)', tagBg: colorsNew.sun, tagInk: colorsNew.deep },
  { bg: colorsNew.clayTint, ink: colorsNew.clayInk, sub: colorsNew.clayInk, tagBg: colorsNew.clay, tagInk: colorsNew.white },
];
const LOC_ROW = 56;
const PILL_H = 52;
const FIELD_ICON = 56;
const FIELD_ITEM_W = 80;
const FIELD_ITEM_H = 94;
const FIELD_ROW_GAP = 16;

export function HomeScreenNew(p: Props) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const enter = useEnterNew();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
  const travel = LOC_ROW + 8 + 40;
  
  // Track impressions for horizontal scroll views
  const recommendedScrollX = useSharedValue(0);
  const popularScrollX = useSharedValue(0);
  const exploreScrollX = useSharedValue(0);
  
  const handleRecommendedScroll = useAnimatedScrollHandler((e) => {
    recommendedScrollX.value = e.contentOffset.x;
  });
  const handlePopularScroll = useAnimatedScrollHandler((e) => {
    popularScrollX.value = e.contentOffset.x;
  });
  const handleExploreScroll = useAnimatedScrollHandler((e) => {
    exploreScrollX.value = e.contentOffset.x;
  });
  
  // Floating search
  const pill = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(y.value, travel) }],
    shadowOpacity: interpolate(y.value, [0, travel], [0.14, 0.28], Extrapolation.CLAMP),
  }));

  // Nearby jobs render item for FlatList
  const renderNearbyItem = useCallback(({ item }: { item: JobSummaryNew }) => (
    <JobRowNew key={item.id} job={item} onPress={() => p.onPressJob(item.id)} divider={false} />
  ), [p.onPressJob]);

  return (
    <View style={{ flex: 1, backgroundColor: colorsNew.white }}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}>
        {/* Main screen heading */}
        <Animated.View entering={enter(0)} style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
          <TextNew variant="title" weight="bold" color={colorsNew.deep}>Find Your Next Job</TextNew>
        </Animated.View>
        {/* location indicator */}
        <Animated.View entering={enter(1)} style={{ height: LOC_ROW, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <PressableScaleNew onPress={p.onPressLocation} accessibilityLabel={p.locationLabel} style={{ minHeight: 44, justifyContent: 'center' }}>
            <TextNew variant="caption" color={colorsNew.muted}>{copy.home.location}</TextNew>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppIconNew name="pin" color={colorsNew.clayInk} />
              <TextNew variant="header">{p.locationLabel}</TextNew>
              <AppIconNew name="down" size={18} />
            </View>
          </PressableScaleNew>
          <RoundButtonNew icon="heart" onPress={p.onPressBell} badgeCount={p.savedCount} accessibilityLabel="Saved jobs" />
        </Animated.View>
        <View style={{ height: PILL_H + 24 }} />

        {/* Job field: locked to two rows, scrolls sideways, no tile background */}
        <Animated.View entering={enter(3)}>
          <SectionTitleNew title={copy.home.jobField} style={{ marginTop: 0 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'column', flexWrap: 'wrap', height: FIELD_ITEM_H * 2 + FIELD_ROW_GAP, columnGap: 16, rowGap: FIELD_ROW_GAP }}>
              {p.jobFields.map((f) => {
                const on = f.id === p.selectedFieldId;
                return (
                  <PressableScaleNew key={f.id} onPress={() => p.onSelectField(f.id)} accessibilityState={{ selected: on }} style={{ width: FIELD_ITEM_W, height: FIELD_ITEM_H, alignItems: 'center' }}>
                    <View style={{ width: FIELD_ICON, height: FIELD_ICON, alignItems: 'center', justifyContent: 'center' }}>
                      {f.icon}
                      {on && (
                        <View style={{ position: 'absolute', right: -3, top: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: colorsNew.sun, alignItems: 'center', justifyContent: 'center' }}>
                          <AppIconNew name="chk" size={12} color={colorsNew.deep} strokeWidth={3} />
                        </View>
                      )}
                    </View>
                    <TextNew variant="caption" weight="bold" align="center" numberOfLines={2} style={{ marginTop: 6 }}>{f.label}</TextNew>
                  </PressableScaleNew>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>

        {/* Job type: ticket-style promo cards */}
        <Animated.View entering={enter(4)}>
          <SectionTitleNew title={copy.home.jobType} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {p.jobTypes.map((t, i) => {
              const c = PROMO[i % PROMO.length];
              return (
                <PressableScaleNew key={t.id} onPress={() => p.onSelectJobType(t.id)} scaleTo={0.985}
                  style={{ width: 200, borderRadius: radiusNew.hero, padding: 16, backgroundColor: c.bg, overflow: 'hidden' }}>
                  {!!t.tagline && <TagNew label={t.tagline} bg={c.tagBg} color={c.tagInk} />}
                  <TextNew variant="section" color={c.ink} style={{ marginTop: 12, marginBottom: 4 }}>{t.label}</TextNew>
                  {!!t.countLabel && <TextNew variant="meta" color={c.sub}>{t.countLabel}</TextNew>}
                  <View style={{ position: 'absolute', right: -8, top: '50%', marginTop: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: colorsNew.white }} />
                </PressableScaleNew>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Recommended */}
        <Animated.View entering={enter(5)}>
          <SectionTitleNew title={copy.home.recommended} actionLabel={copy.home.seeAll} onAction={p.onSeeAllRecommended} />
          {p.recommendedLoading ? (
            <HomeRecommendedSkeleton />
          ) : (
            <Animated.ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              onScroll={handleRecommendedScroll}
              scrollEventThrottle={16}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            >
              {p.recommended.map((j) => <JobCardTallNew key={j.id} job={j} onPress={() => p.onPressJob(j.id)} onToggleLike={() => p.onToggleLike(j.id)} />)}
            </Animated.ScrollView>
          )}
        </Animated.View>

        {/* Jobs near you - using ScrollView to avoid nested VirtualizedList warning */}
        <Animated.View entering={enter(6)}>
          <SectionTitleNew title={copy.home.nearby} />
          {p.nearbyLoading ? (
            <HomeRowsSkeleton />
          ) : p.nearby.length > 0 ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {p.nearby.map((item) => renderNearbyItem({ item }))}
            </ScrollView>
          ) : null}
        </Animated.View>

        {/* Popular (retained from the pre-redesign Home) */}
        {(p.popularLoading || !!p.popularJobs?.length) && (
          <Animated.View entering={enter(7)}>
            <SectionTitleNew title={copy.home.popular} actionLabel={copy.home.seeAll} onAction={p.onSeePopular} />
            {p.popularLoading ? (
              <HomeRowsSkeleton />
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                {p.popularJobs?.map((item) => <JobRowNew key={item.id} job={item} onPress={() => p.onPressJob(item.id)} divider={false} />)}
              </ScrollView>
            )}
          </Animated.View>
        )}

        {/* Explore grid (retained from the pre-redesign Home) */}
        {(p.exploreLoading || !!p.exploreJobs?.length) && (
          <Animated.View entering={enter(8)}>
            <SectionTitleNew title={copy.home.explore} actionLabel={copy.home.seeAll} onAction={p.onSeeExplore} />
            {p.exploreLoading ? (
              <HomeExploreGridSkeleton />
            ) : (
              <Animated.ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                onScroll={handleExploreScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingHorizontal: 16, columnGap: 12, rowGap: 20 }}
              >
                {p.exploreJobs?.map((j) => (
                  <JobCardTallNew key={j.id} job={j} width={(width - 32 - 12) / 2} onPress={() => p.onPressJob(j.id)} onToggleLike={() => p.onToggleLike(j.id)} />
                ))}
              </Animated.ScrollView>
            )}
          </Animated.View>
        )}

        {/* Employer CTA (retained) */}
        {!!p.onPostJob && (
          <Animated.View entering={enter(8)}>
            <PressableScaleNew onPress={p.onPostJob} scaleTo={0.985}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 24, padding: 16, borderRadius: radiusNew.card, backgroundColor: colorsNew.deep }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <AppIconNew name="users" color={colorsNew.white} />
              </View>
              <View style={{ flex: 1 }}>
                <TextNew variant="title" weight="semibold" color={colorsNew.white}>{copy.home.hiringTitle}</TextNew>
                <TextNew variant="meta" color="rgba(255,255,255,0.85)">{copy.home.hiringBody}</TextNew>
              </View>
              <View style={{ backgroundColor: colorsNew.sun, borderRadius: radiusNew.pill, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' }}>
                <TextNew variant="meta" weight="semibold" color={colorsNew.deep}>{copy.home.hiringCta}</TextNew>
              </View>
            </PressableScaleNew>
          </Animated.View>
        )}
      </Animated.ScrollView>

      <Animated.View style={[{ position: 'absolute', left: 16, right: 16, top: insets.top + 8 + 40 + LOC_ROW + 8, zIndex: 10, borderRadius: 999, shadowColor: colorsNew.deep, shadowOffset: { width: 0, height: 10 }, shadowRadius: 28, elevation: 8 }, pill]}>
        <SearchPillNew floating onPress={p.onPressSearch} onRightPress={p.onPressFilter} right="filter"
          prefix={copy.home.searchPrefix} words={copy.home.searchWords} placeholder={p.searchPlaceholderSlot} />
      </Animated.View>
    </View>
  );
}
