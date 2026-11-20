import { ReactNode, useState } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import Animated, { Extrapolation, interpolate, runOnJS, type SharedValue, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextNew } from '../components/TextNew';
import { PressableScaleNew } from '../components/PrimitivesNew';
import { HERO_SHEET_OVERLAP, HomeHeroNew, SearchBarHome } from '../components/home/HomeHeaderNew';
import { RevealOnScroll, ScrollRevealProvider } from '../components/home/ScrollRevealNew';
import { HomeExploreGridSkeleton, HomeRecommendedSkeleton, HomeRowsSkeleton } from '@/src/new/components/NewSkeletons';
import {
  HiringCardHome,
  JobCardHome,
  JobRowHome,
  JobTypeCardHome,
  SectionHeaderHome,
  homeInk,
} from '../components/home/HomePartsNew';
import { useCopyNew } from '../theme/copyNew';
import { useEnterNew } from '../theme/motionNew';
import { JobSummaryNew } from '../types/jobNew';
import type { SectionLoadState } from '@/lib/useFirstLoadSkeletonFlag';

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
  /**
   * Per-section load state (see sectionLoadState): 'loading' keeps the title
   * and shows a skeleton, 'ready' shows the cards, 'empty' hides the section.
   * Omitted means 'ready' when there are jobs and 'empty' otherwise.
   */
  recommended: JobSummaryNew[]; onSeeAllRecommended: () => void;
  recommendedState?: SectionLoadState;
  nearby: JobSummaryNew[];
  nearbyState?: SectionLoadState;
  onPressJob: (id: string) => void; onToggleLike: (id: string) => void;
  // Optional impression tracking for FlatList sections
  onViewableItemsChanged?: (info: { viewableItems: { item?: any; isViewable?: boolean }[] }) => void;
  viewabilityConfig?: any;
  // Sections retained from the pre-redesign Home (approved extension).
  popularJobs?: JobSummaryNew[]; popularState?: SectionLoadState; onSeePopular?: () => void;
  exploreJobs?: JobSummaryNew[]; exploreState?: SectionLoadState; onSeeExplore?: () => void;
  onPostJob?: () => void;
};

/** Floating search bar block: 12 gap + 52 pill + 16 fade. */
const SBAR_H = 80;
const PILL_H = 52;
const FIELD_COL_W = 84;
const FIELD_ITEM_H = 98;
const FIELD_ROW_GAP = 16;

/**
 * One of the two search pills. Shown on one side of the pin point and hidden on the other,
 * and takes touches only while shown. The pinned/unpinned flag lives here rather than in
 * the screen so crossing the pin point re-renders just this wrapper, not the whole feed
 * (that full re-render landed mid-scroll and was a visible hitch).
 * Both copies hide/show on the same test, so the frame of lag between the native scroll
 * and these opacities can never put both on screen at once.
 */
function PinSide({ y, pinAt, showWhenPinned, style, children }: {
  y: SharedValue<number>; pinAt: number; showWhenPinned: boolean; style: StyleProp<ViewStyle>; children: ReactNode;
}) {
  const [pinned, setPinned] = useState(false);
  useAnimatedReaction(() => y.value >= pinAt - 0.5, (now, prev) => { if (now !== prev) runOnJS(setPinned)(now); }, [pinAt]);
  const fade = useAnimatedStyle(() => {
    const isPinned = y.value >= pinAt - 0.5;
    return { opacity: isPinned === showWhenPinned ? 1 : 0 };
  });
  const shown = pinned === showWhenPinned;
  return (
    <Animated.View pointerEvents={shown ? 'box-none' : 'none'} style={[style, fade]}>
      {children}
    </Animated.View>
  );
}

function stateOf(state: SectionLoadState | undefined, jobs: readonly unknown[] | undefined): SectionLoadState {
  return state ?? (jobs?.length ? 'ready' : 'empty');
}

function pairs<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
  return out;
}

export function HomeScreenNew(p: Props) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const enter = useEnterNew();
  const [heroH, setHeroH] = useState(0);
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
  const top = insets.top;
  // The pill's centre sits on the sheet's top edge; once scrolled it pins under the status bar.
  const restY = heroH - HERO_SHEET_OVERLAP - PILL_H / 2 - 12;
  const pinY = top - 4;
  const pinAt = restY - pinY;
  // The real search pill scrolls with the page; a fixed copy takes over under the status bar
  // (see PinSide for the handoff).
  const backing = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [pinAt - 12, pinAt], [0, 1], Extrapolation.CLAMP) }));
  // Sheet corners flatten as the search bar reaches its pinned spot, so the header hands over seamlessly.
  const cap = useAnimatedStyle(() => {
    const r = interpolate(y.value, [pinAt - 90, pinAt], [HERO_SHEET_OVERLAP, 0], Extrapolation.CLAMP);
    return { borderTopLeftRadius: r, borderTopRightRadius: r };
  });
  const { height: viewportH } = useWindowDimensions();
  const recommendedState = stateOf(p.recommendedState, p.recommended);
  const nearbyState = stateOf(p.nearbyState, p.nearby);
  const popularState = stateOf(p.popularState, p.popularJobs);
  const exploreState = stateOf(p.exploreState, p.exploreJobs);

  return (
    <View style={s.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <ScrollRevealProvider scrollY={y} viewportH={viewportH}>
        {/* cyan hero, same family as the Post page */}
        <View onLayout={(e) => setHeroH(e.nativeEvent.layout.height)}>
          <HomeHeroNew topInset={top} scrollY={y} title="Find Your Next Job" locationCaption={copy.home.location}
            locationLabel={p.locationLabel} onPressLocation={p.onPressLocation}
            savedCount={p.savedCount} onPressSaved={p.onPressBell} />
        </View>

        {/* white sheet with rounded corners; the search pill sits on its edge and the hero slides under it */}
        <Animated.View style={[s.sheet, cap]}>
        <View style={{ height: PILL_H / 2 }} />

        {/* Job field: two rows, scrolls sideways */}
        <Animated.View entering={enter(1)} style={s.sec}>
          <SectionHeaderHome title={copy.home.jobField} glyph="jobField" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 6 }}>
            <View style={{ flexDirection: 'column', flexWrap: 'wrap', height: FIELD_ITEM_H * 2 + FIELD_ROW_GAP, columnGap: 8, rowGap: FIELD_ROW_GAP }}>
              {p.jobFields.map((f) => (
                <PressableScaleNew key={f.id} onPress={() => p.onSelectField(f.id)} scaleTo={0.93}
                  accessibilityState={{ selected: f.id === p.selectedFieldId }} accessibilityLabel={f.label}
                  style={{ width: FIELD_COL_W, height: FIELD_ITEM_H, alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 58, height: 58, alignItems: 'center', justifyContent: 'center' }}>{f.icon}</View>
                  <TextNew variant="meta" weight="medium" color={homeInk.navy} align="center" numberOfLines={2} style={{ fontSize: 13, lineHeight: 16 }}>{f.label}</TextNew>
                </PressableScaleNew>
              ))}
            </View>
          </ScrollView>
        </Animated.View>

        {/* Job type: 2x2 illustrated cards */}
        {p.jobTypes.length > 0 && (
          <Animated.View entering={enter(2)} style={s.sec}>
            <SectionHeaderHome title={copy.home.jobType} glyph="jobType" />
            <View style={{ gap: 12, paddingTop: 2, paddingBottom: 4 }}>
              {pairs(p.jobTypes).map((row, r) => (
                <View key={r} style={{ flexDirection: 'row', gap: 12 }}>
                  {row.map((t, c) => (
                    <RevealOnScroll key={t.id} index={c} style={{ flex: 1 }}>
                      <JobTypeCardHome id={t.id} label={t.label} index={r * 2 + c} onPress={() => p.onSelectJobType(t.id)} />
                    </RevealOnScroll>
                  ))}
                  {row.length === 1 && <View style={{ flex: 1 }} />}
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Recommended */}
        {recommendedState !== 'empty' && (
        <View style={s.sec}>
          <RevealOnScroll>
            <SectionHeaderHome title={copy.home.recommended} glyph="recommended" actionLabel={copy.home.seeAll} onAction={p.onSeeAllRecommended} />
          </RevealOnScroll>
          {recommendedState === 'loading' ? (
            <HomeRecommendedSkeleton />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={s.hs}>
              {p.recommended.map((j, i) => (
                <RevealOnScroll key={j.id} index={i}>
                  <JobCardHome job={j} onPress={() => p.onPressJob(j.id)} onToggleLike={() => p.onToggleLike(j.id)} />
                </RevealOnScroll>
              ))}
            </ScrollView>
          )}
        </View>
        )}

        {/* Jobs near you */}
        {nearbyState !== 'empty' && (
          <View style={s.sec}>
            <RevealOnScroll>
              <SectionHeaderHome title={copy.home.nearby} glyph="nearby" />
            </RevealOnScroll>
            {nearbyState === 'loading' ? (
              <HomeRowsSkeleton />
            ) : (
              <View style={s.list}>
                {p.nearby.map((j) => (
                  <RevealOnScroll key={j.id}><JobRowHome job={j} onPress={() => p.onPressJob(j.id)} /></RevealOnScroll>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Popular */}
        {popularState !== 'empty' && (
          <View style={s.sec}>
            <RevealOnScroll>
              <SectionHeaderHome title={copy.home.popular} glyph="popular" actionLabel={copy.home.seeAll} onAction={p.onSeePopular} />
            </RevealOnScroll>
            {popularState === 'loading' ? (
              <HomeRowsSkeleton />
            ) : (
              <View style={s.list}>
                {p.popularJobs?.map((j) => (
                  <RevealOnScroll key={j.id}><JobRowHome job={j} onPress={() => p.onPressJob(j.id)} /></RevealOnScroll>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Explore */}
        {exploreState !== 'empty' && (
          <View style={s.sec}>
            <RevealOnScroll>
              <SectionHeaderHome title={copy.home.explore} glyph="explore" actionLabel={copy.home.seeAll} onAction={p.onSeeExplore} />
            </RevealOnScroll>
            {exploreState === 'loading' ? (
              <HomeExploreGridSkeleton />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={s.hs}>
                {p.exploreJobs?.map((j, i) => (
                  <RevealOnScroll key={j.id} index={i}>
                    <JobCardHome big job={j} onPress={() => p.onPressJob(j.id)} onToggleLike={() => p.onToggleLike(j.id)} />
                  </RevealOnScroll>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Employer CTA */}
        {!!p.onPostJob && (
          <RevealOnScroll>
            <HiringCardHome title={copy.home.hiringTitle} body={copy.home.hiringBody} onPress={p.onPostJob} />
          </RevealOnScroll>
        )}
        </Animated.View>

        {/* search pill in its resting place, on the edge where the hero meets the sheet */}
        {heroH > 0 && (
          <PinSide y={y} pinAt={pinAt} showWhenPinned={false} style={[s.inlineSearch, { top: restY + 12 }]}>
            <SearchBarHome prefix={copy.home.searchPrefix} words={copy.home.searchWords} placeholder={p.searchPlaceholderSlot}
              onPress={p.onPressSearch} onFilter={p.onPressFilter} />
          </PinSide>
        )}
        </ScrollRevealProvider>
      </Animated.ScrollView>

      {/* search bar: rides with the header, then pins under the status bar */}
      {/* status-bar strip: content fades out underneath it */}
      <Animated.View pointerEvents="none" style={[s.statusStrip, { height: top + 8 }, backing]}>
        <LinearGradient colors={['#FFFFFF', '#FFFFFF', 'rgba(255,255,255,0)']} locations={[0, top / (top + 8), 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {heroH > 0 && (
        <PinSide y={y} pinAt={pinAt} showWhenPinned style={[s.sbar, { top: pinY }]}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={s.sbarSolid} />
            <LinearGradient colors={['#FFFFFF', 'rgba(255,255,255,0)']} style={s.sbarFade} />
          </View>
          <SearchBarHome prefix={copy.home.searchPrefix} words={copy.home.searchWords} placeholder={p.searchPlaceholderSlot}
            onPress={p.onPressSearch} onFilter={p.onPressFilter} />
        </PinSide>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  statusStrip: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  sheet: {
    flexGrow: 1, marginTop: -HERO_SHEET_OVERLAP, paddingTop: HERO_SHEET_OVERLAP, paddingBottom: 40, backgroundColor: '#FFFFFF',
    borderTopLeftRadius: HERO_SHEET_OVERLAP, borderTopRightRadius: HERO_SHEET_OVERLAP,
  },
  inlineSearch: { position: 'absolute', left: 16, right: 16, zIndex: 5 },
  sbar: { position: 'absolute', left: 0, right: 0, height: SBAR_H, paddingTop: 12, paddingHorizontal: 16, zIndex: 10, elevation: 10 },
  sbarSolid: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 28, backgroundColor: '#FFFFFF' },
  sbarFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 28 },
  sec: { paddingHorizontal: 16, marginTop: 10 },
  hs: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8, gap: 14 },
  list: { gap: 18, paddingBottom: 6 },
});
