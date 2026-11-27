import { useRouter, useIsFocused } from "@/lib/router";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AppIcon } from "@/components/ui/AppIcon";

import type { Job } from "@/components/job-store";
import { useJobStore } from "@/components/job-store";
import { JobCard } from "@/components/jobs/JobCard";
import { JobGrid } from "@/components/jobs/JobGrid";
import type { JobCardData, JobCardVariant } from "@/components/jobs/jobCardTypes";
import { toJobCardData } from "@/components/jobs/toJobCardData";
import { ScreenContainer } from "@/components/screen-container";
import { JOB_TYPE_IMAGES } from "@/components/shared/jobTypeImage";
import { ShimmerIcon } from "@/components/shared/ShimmerIcon";
import { SectionHeader } from "@/components/home/SectionHeader";
import AnimatedPlaceholder from "@/components/search/AnimatedPlaceholder";
import { vistaKeyForField } from "@/components/vista/vistaCategoryData";
import { SchemeColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { RowScrollIndicator, useRowIndicator } from "@/components/home/RowScrollIndicator";
import { colors, fontFamily, radii, spacing } from "@/components/home/theme";
import { useAuth } from "@/hooks/use-auth";
import { useHomeFeed } from "@/hooks/use-home-feed";
import { usePopularJobs } from "@/hooks/use-popular-jobs";
import { useSearchLocation } from "@/hooks/use-search-location";
import { opportunityCategories } from "@/lib/category-data";
import { logJobEvent } from "@/lib/event-logging";
import { haptic } from "@/lib/haptics";
import { JOB_FIELDS, resolveJobField } from "@/lib/job-fields";
import { JobFieldArtwork } from "@/components/shared/JobFieldArtwork";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Cutout illustrations rather than glyphs, so they carry their own colour —
// `color`/`strokeWidth` no longer apply. Kept as a single source per category
// so the tile below and the router target can't drift apart. `aspectRatio` is
// the artwork's intrinsic width / height, so each box can be fitted to the
// illustration instead of forced square.
type Category = { key: string; label: string; image: number; aspectRatio: number };

// The tile the illustration sits in, and so also the box the shimmer sweep is
// masked to. This is a ceiling, not a fixed size: the row can only ever be as
// wide as the device, so the real tile is the smaller of this and an even
// quarter-share of the width between the gutters. Shared with
// `styles.categoryIcon` so the two can't drift.
const CATEGORY_ICON_MAX = 86;
// The artwork's bounding box sits inside the tile with a consistent inset.
// Kept under 1 so the illustration is always inside the tile — and therefore
// always inside the column, and never past the gutter — however wide the screen
// is. The box is then fitted to each illustration's own ratio (see the render
// below), so a wide icon isn't letterboxed inside a square.
const CATEGORY_ARTWORK_RATIO = 0.86;
// Gap between categories. The tiles are centred in their own flex column, so
// this is what sets how tightly the four sit together.
const CATEGORY_GAP = 4;
// Offset per category so the sweep travels left-to-right down the row rather
// than flashing all four at once. Well under the 5s loop period, so the wave
// holds its shape on every pass.
const CATEGORY_SHIMMER_STAGGER = 250;

// The rail of all 19 industry fields. Their aspect ratios run 0.93 (`Marketing
// & Media`, the only portrait illustration) to 1.88 (`IT & Technology`), so a
// shared width can't work: at 68px wide the near-square ones stand 73px tall
// and spill onto the label below. Each is instead fitted *inside* this box,
// preserving its ratio, so nothing can exceed the reserved slot.
const FIELD_RAIL_ARTWORK_HEIGHT = 56;
const FIELD_ARTWORK_MAX = 68;
// Every tile is at least wide enough for the longest field names, which wrap to
// two lines.
const FIELD_RAIL_LABEL_WIDTH = 84;
// The tallest slot the rail reserves, so every label shares one baseline no
// matter how tall the artwork above it draws.
const FIELD_RAIL_TILE_HEIGHT = 62;
const FIELD_RAIL_GAP = 4;

/**
 * Fits artwork with the given intrinsic ratio inside the rail's artwork box
 * without cropping or distorting it. Wider icons cap on width and come out
 * shorter; squarer ones cap on height and come out narrower; neither exceeds
 * the reserved slot.
 */
function fitFieldArtwork(aspectRatio: number): { width: number; height: number } {
  const heightAtFullWidth = FIELD_ARTWORK_MAX / aspectRatio;
  if (heightAtFullWidth <= FIELD_RAIL_ARTWORK_HEIGHT) {
    return { width: FIELD_ARTWORK_MAX, height: Math.round(heightAtFullWidth) };
  }
  return {
    width: Math.round(FIELD_RAIL_ARTWORK_HEIGHT * aspectRatio),
    height: FIELD_RAIL_ARTWORK_HEIGHT,
  };
}

// The legacy `categories.name` a field filters by. Search is an exact SQL match
// on that column, so the official title can't be sent — it has to be the legacy
// title the field resolves to. Six fields have no legacy counterpart and fall
// back to `''`, which the listing page treats as "no category" and loads the
// full feed; that matches how `app/quick-search.tsx` already behaves.
// Derived once here so the icon and the query can't drift apart.
const FIELD_FILTER_BY_ID: ReadonlyMap<string, string> = (() => {
  const byId = new Map<string, string>();
  for (const category of opportunityCategories) {
    const fieldId = resolveJobField(category.title)?.id;
    if (fieldId && !byId.has(fieldId)) byId.set(fieldId, category.title);
  }
  return byId;
})();

// Maps each of the 19 job-field tiles onto one of the redesign's five category
// pages (`/jobs/category/<slug>`). The taxonomy is many-to-one: most fields have
// no exact category, so they are grouped by the page whose jobs are the closest
// fit — service fields to café/hotel, retail + sales to retail, onsite/manual
// fields to delivery, and desk/remote fields to office. Keep every `JOB_FIELDS`
// id here so no tile falls through to the legacy listing.
const FIELD_CATEGORY_SLUG: ReadonlyMap<string, string> = new Map([
  // Hospitality & food
  ["hospitality-food", "cafe"],
  // Hotel & in-person services
  ["beauty-personal-care", "hotel"],
  ["cleaning-housekeeping", "hotel"],
  ["healthcare", "hotel"],
  // Retail
  ["retail-ecommerce", "retail"],
  ["sales-business", "retail"],
  // Delivery & onsite
  ["logistics-delivery", "delivery"],
  ["manufacturing", "delivery"],
  ["security", "delivery"],
  ["agriculture", "delivery"],
  // Office / remote
  ["administration", "office"],
  ["customer-service", "office"],
  ["it-technology", "office"],
  ["marketing-media", "office"],
  ["finance-accounting", "office"],
  ["human-resources", "office"],
  ["education-training", "office"],
  ["engineering-construction", "office"],
  ["design-creative", "office"],
]);

// The four job types, below the field rail. Their artwork is read from the
// shared list so the job-detail page's "Job type" stat shows these exact images
// too — see components/shared/jobTypeImage.ts.
const CATEGORIES: Category[] = JOB_TYPE_IMAGES.map((entry) => ({
  key: entry.key,
  label: entry.label,
  image: entry.image,
  aspectRatio: entry.aspectRatio,
}));

// Event-handler debouncing only; kept behind a module boundary so the purity
// lint rule doesn't flag the (intended) render-independent usage.
const nowMs = () => Date.now();

const SEARCH_BAR_HEIGHT = 54;
// Where the collapsed pill rests, measured from the top of the safe area. The
// list is flush with the top of the screen, so without a gap here the pill butts
// straight against the notch/status bar.
const PILL_TOP_OFFSET = 8;
// The bar lives in the content flow between the location row and the CTA, so its
// top edge starts at content-y 72 (content paddingTop 8 + headerRow 4+44, plus the
// searchRow's 16 margin). Scrolling to 72 - PILL_TOP_OFFSET lands that top edge
// exactly on the pill's, so the collapse reads as a morph into it. The two have
// to move together: lifting the pill off the top of the device means scrolling
// less far for the bar to reach it.
const BAR_CONTENT_TOP = 72;
const SNAP_TARGET = BAR_CONTENT_TOP - PILL_TOP_OFFSET;
const DOWN_ACTIVATE = 12;
const UP_ACTIVATE = 24;
const COMMIT_DURATION = 420;
const COMMIT_EASING = Easing.bezier(0.22, 0.61, 0.36, 1);
const FADE_START = 0.15;
const FILTER_NUDGE_AT = 0.2;
const FILTER_NUDGE = 5;
const FILTER_EXIT = 90;
// Idle float: only ever runs while the bar is settled, never mid-commit, so it
// can't fight the collapse/expand transform underneath it.
const FLOAT_AMPLITUDE = 3;
const FLOAT_DURATION = 2000; // ms per half-cycle (4s full loop)

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isSaved, toggleSaved } = useJobStore();
  const navigationLock = useRef<{ target: string; until: number } | null>(null);

  const { coordinates, locationLabel } = useSearchLocation();
  const [searchBarCollapsed, setSearchBarCollapsed] = useState(false);
  const isScreenFocused = useIsFocused();
  const scheme = useColorScheme();
  const softBlue = SchemeColors[scheme === "dark" ? "dark" : "light"].softBlue;

  // Four tiles sharing the width between the gutters, so the row fits the device
  // exactly at any screen size instead of overrunning it. Capped so the icons
  // don't sprawl on a tablet or a landscape phone.
  const { width: screenWidth } = useWindowDimensions();
  const categoryIconSize = Math.min(
    CATEGORY_ICON_MAX,
    Math.floor((screenWidth - spacing.screenX * 2 - CATEGORY_GAP * (CATEGORIES.length - 1)) / CATEGORIES.length),
  );
  const categoryImageSize = Math.round(categoryIconSize * CATEGORY_ARTWORK_RATIO);

  // The field rail scrolls, so its tiles are a fixed width rather than a share
  // of the device: the wider of the artwork box and the label, so the longest
  // field names still wrap inside their tile.
  const fieldTileWidth = Math.max(FIELD_ARTWORK_MAX, FIELD_RAIL_LABEL_WIDTH);

  const listRef = useAnimatedRef<Animated.FlatList<Job>>();
  // One indicator per scrolling row. These are shared values, so a drag updates
  // the thumb on the UI thread without re-rendering the feed list.
  const recommendedIndicator = useRowIndicator();
  const fieldRailIndicator = useRowIndicator();
  const searchProgress = useSharedValue(0);
  const searchCollapsed = useSharedValue(0);
  const searchCommitting = useSharedValue(false);
  const floatY = useSharedValue(0);

  // Drives the collapsed pill only — the expanded bar stays still in the flow.
  // Starts immediately, but the pill's style gates it on `searchCommitting`, so it
  // is inert for the whole length of a commit and picks back up on its own once
  // the commit's callback clears the flag.
  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-FLOAT_AMPLITUDE, { duration: FLOAT_DURATION, easing: Easing.inOut(Easing.sin) }),
        withTiming(FLOAT_AMPLITUDE, { duration: FLOAT_DURATION, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [floatY]);

  /**
   * Commit the collapse/expand. Deliberately does NOT write the list's scroll
   * offset: the finger is still on the glass when this fires, and a programmatic
   * scroll there fights the in-flight native gesture and loses. That fight was
   * the source of the perceived lag, and the lost race was how the list came to
   * rest short of the target. The bar now morphs in place and
   * `settleSearchScroll` below does the repositioning once the gesture has ended.
   *
   * Further scroll-triggered commits are ignored while one is in flight
   * (`searchCommitting`), so the transition always runs to completion and is
   * never seen half-done.
   */
  const commitSearchCollapse = (to: 0 | 1) => {
    "worklet";
    if (searchCommitting.value) return;
    searchCommitting.value = true;
    searchCollapsed.value = to;
    runOnJS(setSearchBarCollapsed)(to === 1);
    searchProgress.value = withTiming(
      to,
      { duration: COMMIT_DURATION, easing: COMMIT_EASING },
      (finished) => {
        if (finished) searchCommitting.value = false;
      },
    );
  };

  /**
   * Re-assert the snap position once the list has actually come to rest. This is
   * the only place the scroll offset is written.
   *
   * Deliberately not gated on `searchCommitting` — releasing the finger inside
   * the 420ms window is precisely the case that needs correcting.
   *
   * The whole range short of the target is covered rather than a small tolerance,
   * because `DOWN_ACTIVATE` (12) and `SNAP_TARGET - UP_ACTIVATE` (48) leave a
   * band of offsets that `onScroll` reads as ambiguous. Coming to rest inside
   * that band would flip the bar back and forth; this resolves it to whichever
   * target the current state implies. Offsets *past* the target are left alone,
   * so scrolling on after a commit still feels free.
   */
  const settleSearchScroll = (offsetY: number) => {
    "worklet";
    const target = searchCollapsed.value ? SNAP_TARGET : 0;
    const shortOfTarget = searchCollapsed.value ? offsetY < SNAP_TARGET : offsetY > 0;
    if (shortOfTarget) scrollTo(listRef, 0, target, true);
  };

  // `onEndDrag`/`onMomentumEnd` are Reanimated's names for the ScrollView's
  // onScrollEndDrag/onMomentumScrollEnd props. It auto-subscribes to both, and
  // attaches the handler to each — the keys are NOT the prop names.
  const onSearchListScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (searchCommitting.value) return;
      const y = event.contentOffset.y;
      if (searchCollapsed.value === 0 && y > DOWN_ACTIVATE) {
        commitSearchCollapse(1);
      } else if (searchCollapsed.value === 1 && y < SNAP_TARGET - UP_ACTIVATE) {
        commitSearchCollapse(0);
      }
    },
    onEndDrag: (event) => settleSearchScroll(event.contentOffset.y),
    onMomentumEnd: (event) => settleSearchScroll(event.contentOffset.y),
  });

  const searchFieldStyle = useAnimatedStyle(() => {
    const p = searchProgress.value;
    return {
      opacity: p < FADE_START ? 1 : interpolate(p, [FADE_START, 1], [1, 0], Extrapolation.CLAMP),
      transform: [{ scaleX: 1 - p }],
    };
  });

  const filterButtonStyle = useAnimatedStyle(() => {
    const p = searchProgress.value;
    if (p <= FILTER_NUDGE_AT) {
      return { transform: [{ translateX: (-FILTER_NUDGE * p) / FILTER_NUDGE_AT }] };
    }
    const exit = interpolate(p, [FILTER_NUDGE_AT, 1], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ translateX: -FILTER_NUDGE * (1 - exit) + FILTER_EXIT * exit }] };
  });

  const compactPillStyle = useAnimatedStyle(() => {
    const p = searchProgress.value;
    return {
      opacity: p,
      transform: [
        // Slide-down and float share one axis, so they're summed: the float
        // contributes 0 while committing, leaving the slide-in unobstructed.
        { translateY: -SEARCH_BAR_HEIGHT * (1 - p) + (searchCommitting.value ? 0 : floatY.value) },
      ],
    };
  });

  const {
    nearby,
    recommended,
    more,
    loading: feedLoading,
  } = useHomeFeed({
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    radiusKm: 50,
  });
  const { jobs: popular } = usePopularJobs();

  // "Explore" draws from the feed's long tail, minus anything already shown
  // above, so a job never appears twice on the page.
  const explore = useMemo(() => {
    const shown = new Set([...recommended, ...nearby, ...popular].map((job) => job.id));
    return more.filter((job) => !shown.has(job.id));
  }, [more, recommended, nearby, popular]);

  // The section's first job is rendered as the featured card in the header, so
  // the virtualized list starts at the second one.
  const nearbyRows = useMemo(() => nearby.slice(1), [nearby]);

  const navigate = (target: string, params?: Record<string, string>) => {
    haptic.light();
    const now = nowMs();
    if (navigationLock.current && navigationLock.current.target === target && navigationLock.current.until > now) return;
    navigationLock.current = { target, until: now + 700 };
    if (params) {
      router.push({ pathname: target, params } as never);
    } else {
      router.push(target as never);
    }
  };

  const openSearchDetail = () => navigate("/search-detail");
  // Job-type tiles open the dedicated "Ways to work" page on the matching tab.
  // The tile keys are the same slugs `ROUTES`/`TAB_SLUGS` use, so they can't drift.
  const openJobType = (key: string) => navigate("/jobs/ways-to-work", { tab: key });
  const openCategoryListing = (title: string, category?: string) =>
    navigate("/category-listing", category ? { category, title } : { title });
  const openField = (fieldId: string, title: string) => {
    // The redesigned Vista page handles every known field tile. The five legacy
    // category pages below stay wired as the safety net for an unknown id.
    const vistaKey = vistaKeyForField(fieldId);
    if (vistaKey) {
      navigate(`/vista/${vistaKey}`);
      return;
    }
    // Every field maps to one of the five category pages. The legacy listing is
    // kept only as a safety net for an id the map doesn't know yet.
    const slug = FIELD_CATEGORY_SLUG.get(fieldId);
    if (slug) {
      navigate(`/jobs/category/${slug}`);
      return;
    }
    openCategoryListing(`${title} jobs`, FIELD_FILTER_BY_ID.get(fieldId));
  };

  const openJob = (id: string) => {
    const target = `/job/${id}`;
    const now = nowMs();
    if (navigationLock.current && navigationLock.current.target === target && navigationLock.current.until > now) return;
    navigationLock.current = { target, until: now + 700 };
    haptic.light();
    logJobEvent({ jobId: id, eventType: "click", feedContext: "feed" });
    router.push({ pathname: "/job/[id]", params: { id } } as never);
  };

  const toggleSave = (id: string) => {
    haptic.selection();
    if (!user) {
      router.push("/login" as never);
      return;
    }
    logJobEvent({ jobId: id, eventType: isSaved(id) ? "unsave" : "save" });
    toggleSaved(id);
  };

  const openCard = (card: JobCardData) => openJob(card.id);

  const renderCard = (job: Job, variant: JobCardVariant) => (
    <JobCard
      key={job.id}
      job={toJobCardData(job)}
      variant={variant}
      saved={isSaved(job.id)}
      onPress={openCard}
      onToggleSave={(card) => toggleSave(card.id)}
    />
  );

  const renderSectionJobs = (jobs: Job[]) => (
    <View style={styles.rows}>{jobs.map((job) => renderCard(job, "row"))}</View>
  );

  // Horizontal rails are cross-orientation, so they stay scrollable. The Explore
  // section below is vertical content inside this list's header, so it uses the
  // non-virtualized JobGrid instead.
  const renderColSectionJobs = (jobs: Job[]) => (
    <View>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.colScrollContent}
        onScroll={recommendedIndicator.onScroll}
        onLayout={recommendedIndicator.onLayout}
        onContentSizeChange={recommendedIndicator.onContentSizeChange}
        scrollEventThrottle={16}
      >
        {jobs.map((job) => renderCard(job, "carousel"))}
      </Animated.ScrollView>
      <RowScrollIndicator
        x={recommendedIndicator.x}
        visibleWidth={recommendedIndicator.visibleWidth}
        contentWidth={recommendedIndicator.contentWidth}
      />
    </View>
  );

  const header = (
    <>
      <View style={styles.headerRow}>
        <Pressable style={styles.locationPress} onPress={openSearchDetail}>
          <Text style={styles.locationLabel}>Location</Text>
          <View style={styles.locationValueRow}>
            <AppIcon name="pin" size={16} color={colors.mint} />
            <Text style={styles.locationValue} numberOfLines={1}>
              {locationLabel}
            </Text>
            <AppIcon name="chevron" size={18} color={colors.textPrimary} style={{ transform: [{ rotate: "90deg" }] }} />
          </View>
        </Pressable>

        <Pressable
          style={styles.bellButton}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => navigate("/saved")}
        >
          <AppIcon name="bell" size={20} color={colors.textPrimary} />
          <View style={styles.bellDot} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <AnimatedPressable
          style={[styles.searchBar, searchFieldStyle]}
          pointerEvents={searchBarCollapsed ? "none" : "auto"}
          accessibilityRole="search"
          accessibilityLabel="Search jobs"
          onPress={openSearchDetail}
        >
          <View style={styles.searchIcon}>
            <AppIcon name="search" size={20} color={colors.textSecondary} />
          </View>
          <AnimatedPlaceholder
            color={softBlue}
            prefixColor={colors.textSecondary}
            fontFamily={fontFamily.interRegular}
            fontSize={16}
            lineHeight={22}
            visible={!searchBarCollapsed}
            paused={!isScreenFocused}
            inline
          />
        </AnimatedPressable>
        <AnimatedPressable
          style={[styles.filterButton, filterButtonStyle]}
          accessibilityRole="button"
          accessibilityLabel="Filters"
          onPress={openSearchDetail}
        >
          <AppIcon name="sliders" size={20} color={colors.white} />
        </AnimatedPressable>
      </View>

      <SectionHeader title="Job field" />

      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={fieldRailIndicator.onScroll}
        onLayout={fieldRailIndicator.onLayout}
        onContentSizeChange={fieldRailIndicator.onContentSizeChange}
        scrollEventThrottle={16}
        contentContainerStyle={styles.fieldRailContent}
      >
        {JOB_FIELDS.map((field, index) => {
          const art = fitFieldArtwork(1);
          return (
            <Pressable
              key={field.id}
              style={[styles.fieldItem, { width: fieldTileWidth }]}
              accessibilityRole="button"
              accessibilityLabel={field.title}
              onPress={() => openField(field.id, field.title)}
            >
              <View style={styles.fieldArtwork}>
                <ShimmerIcon width={art.width} height={art.height} delay={index * CATEGORY_SHIMMER_STAGGER}>
                  <JobFieldArtwork xml={field.svg} width={art.width} height={art.height} />
                </ShimmerIcon>
              </View>
              <Text style={styles.fieldLabel} numberOfLines={2}>
                {field.title}
              </Text>
            </Pressable>
          );
        })}
      </Animated.ScrollView>

      <RowScrollIndicator
        x={fieldRailIndicator.x}
        visibleWidth={fieldRailIndicator.visibleWidth}
        contentWidth={fieldRailIndicator.contentWidth}
      />

      <SectionHeader title="Job type" />

      <View style={styles.categoryScrollContent}>
        {CATEGORIES.map(({ key, label, image, aspectRatio }, index) => {
          // The box matches the illustration's own ratio rather than a square,
          // so the sweep lines up with the artwork instead of sweeping a
          // letterboxed square around it.
          const artHeight = Math.round(categoryImageSize / aspectRatio);
          return (
            <Pressable
              key={key}
              style={styles.categoryItem}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => openJobType(key)}
            >
              <View style={[styles.categoryIcon, { width: categoryIconSize, height: categoryIconSize }]}>
                <ShimmerIcon width={categoryImageSize} height={artHeight} delay={index * CATEGORY_SHIMMER_STAGGER}>
                  <Image
                    source={image}
                    style={{ width: categoryImageSize, height: artHeight }}
                    resizeMode="contain"
                  />
                </ShimmerIcon>
              </View>
              <Text style={styles.categoryLabel} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {recommended.length > 0 ? (
        <>
          <SectionHeader
            title="Recommended"
            subtitle="Picked for you today"
            onSeeAll={() => navigate("/jobs/recommended")}
          />
          {renderColSectionJobs(recommended)}
        </>
      ) : null}

      <SectionHeader
        title="Jobs near you"
        subtitle={feedLoading ? "…" : `${nearby.length} open`}
        onSeeAll={() => navigate("/jobs/near-you")}
      />
      {nearby.length > 0 ? (
        <View style={styles.featuredWrap}>{renderCard(nearby[0], "featured")}</View>
      ) : feedLoading ? (
        <JobRowSkeleton count={3} />
      ) : (
        <View style={styles.emptyWrap}>
          <EmptyCard title="No jobs near you yet" message="Try another area or check back soon." />
        </View>
      )}
    </>
  );

  const footer = (
    <>
      {popular.length > 0 ? (
        <JobSection
          action="See all"
          jobs={popular}
          onAction={() => openCategoryListing("Popular jobs")}
          title="Popular"
        >
          {renderSectionJobs}
        </JobSection>
      ) : null}

      {explore.length > 0 ? (
        <JobSection
          action="See all"
          jobs={explore}
          onAction={() => openCategoryListing("Explore jobs")}
          title="Explore"
        >
          {(jobs) => (
            <JobGrid
              jobs={jobs.map(toJobCardData)}
              savedIds={new Set(jobs.filter((job) => isSaved(job.id)).map((job) => job.id))}
              onPress={openCard}
              onToggleSave={(card) => toggleSave(card.id)}
            />
          )}
        </JobSection>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.postCard, pressed && styles.pressed]}
        onPress={() => navigate("/employer")}
      >
        <View style={styles.postIcon}>
          <AppIcon name="target" size={18} color={colors.mint} />
        </View>
        <View style={styles.postCopy}>
          <Text style={styles.postTitle}>Hiring for your team?</Text>
          <Text style={styles.postText}>Create a job that reaches the right candidates.</Text>
        </View>
        <View style={styles.postButton}>
          <Text style={styles.postButtonText}>Post a job</Text>
        </View>
      </Pressable>
    </>
  );

  return (
    // No `containerClassName` override: this inherits `ScreenContainer`'s
    // `bg-background` (#F3F6F5), the same surface the search tab and the app
    // root already use. The search bar's own fill is transparent, so a
    // non-white page is what lets its black outline read as a floating field
    // instead of a white slab. The job cards keep their white fill + hairline
    // border, so they still separate cleanly from the page.
    <ScreenContainer className="flex-1">
      <Animated.FlatList
        ref={listRef}
        style={styles.feed}
        // Only the remaining "Jobs near you" rows are virtualized; the other three
        // sections live in the header/footer. `nearbyRows` is the same list minus
        // the job already shown as the section's featured card, so nothing
        // repeats.
        data={nearbyRows}
        keyExtractor={(job) => job.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        renderItem={({ item }) => (
          <View style={styles.flatRow}>{renderCard(item, "row")}</View>
        )}
        onScroll={onSearchListScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        contentContainerStyle={styles.content}
      />

      <AnimatedPressable
        style={[styles.compactPill, compactPillStyle]}
        pointerEvents={searchBarCollapsed ? "auto" : "none"}
        accessibilityRole="search"
        accessibilityLabel="Search jobs"
        onPress={openSearchDetail}
      >
        <AppIcon name="search" size={20} color="#111111" />
        {/* Same style as the expanded bar's placeholder, so the two states
            carry identical typography through the crossfade. */}
        <Text style={styles.searchPlaceholder}>Search jobs</Text>
      </AnimatedPressable>
    </ScreenContainer>
  );
}



function JobSection({
  action,
  children,
  jobs,
  onAction,
  title,
}: {
  action: string;
  children: (jobs: Job[]) => ReactNode;
  jobs: Job[];
  onAction: () => void;
  title: string;
}) {
  return (
    <View>
      <SectionHeader title={title} onSeeAll={onAction} />
      {jobs.length > 0 ? children(jobs) : null}
    </View>
  );
}

function EmptyCard({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

function JobRowSkeleton({ count = 4 }: { count?: number }) {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.8, { duration: 820, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.skeletonGroup}>
      {Array.from({ length: count }, (_, index) => (
        <Animated.View key={index} style={[styles.flatRow, styles.skeletonRow, pulseStyle]}>
          <View style={styles.skeletonMedia} />
          <View style={styles.skeletonRowBody}>
            <View style={[styles.skeletonLine, styles.skeletonTag]} />
            <View style={[styles.skeletonLine, styles.skeletonTitle]} />
            <View style={styles.skeletonMetaRow}>
              <View style={[styles.skeletonLine, styles.skeletonMeta]} />
              <View style={[styles.skeletonLine, styles.skeletonMetaShort]} />
            </View>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 28 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingTop: 4,
  },
  locationPress: { flexShrink: 1, paddingRight: 12 },
  locationLabel: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
  locationValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationValue: { fontFamily: fontFamily.bold, fontSize: 19, color: colors.textPrimary, flexShrink: 1 },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.chipBg,
    alignItems: "center",
    justifyContent: "center",
  },
  bellDot: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    borderWidth: 1,
    borderColor: colors.white,
  },

  // Sits in the content flow between the location row and the CTA, so it
  // scrolls away with the rest of the header instead of being pinned.
  // overflow:hidden so the filter button visibly clips at the screen edge as it
  // slides out, rather than floating over the rest of the header on its way off.
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    paddingHorizontal: spacing.screenX,
    overflow: "hidden",
  },
  // Floating search affordance, pinned over the list and faded in once the
  // in-content bar has scrolled past. Kept out of the flow so it survives the
  // header leaving, and given no touch-blocking while invisible.
  compactPill: {
    position: "absolute",
    // Gap from the top of the safe area. Paired with SNAP_TARGET, which scrolls
    // correspondingly less far so the collapsing bar still lands on this line.
    top: PILL_TOP_OFFSET,
    // A further 20px in from the expanded bar on each side, so the collapsed
    // pill reads as a narrower floating bar rather than a full-width slab.
    left: spacing.screenX * 2,
    right: spacing.screenX * 2,
    height: SEARCH_BAR_HEIGHT,
    // 999 is `radius.pill` from the theme; React Native clamps a radius to half
    // the height, so this lands as a 27px stadium — fully rounded ends rather
    // than the expanded bar's 19px. Inlined rather than imported so `radius`
    // doesn't sit one letter away from the `radii` used throughout this file.
    borderRadius: 999,
    backgroundColor: colors.chipBg,
    borderWidth: 1.5,
    borderColor: "#111111",
    // Row direction, so justifyContent is now the horizontal axis and is what
    // pins the icon and label to the left; alignItems keeps them centred
    // vertically.
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    paddingHorizontal: 16,
  },
  feed: { flex: 1 },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: SEARCH_BAR_HEIGHT,
    // 999 is `radius.pill`; React Native clamps to half the height, so this
    // lands as a fully rounded stadium matching the collapsed compactPill.
    borderRadius: 999,
    backgroundColor: colors.chipBg,
    paddingHorizontal: 16,
    gap: 8,
  },
  searchPlaceholder: { fontFamily: fontFamily.interRegular, fontSize: 16, color: colors.textSecondary },
  // The gap to the placeholder comes from the bar's own `gap`, so this only
  // nudges the icon off the gutter — its trailing margin would double up.
  searchIcon: { marginLeft: 2 },
  filterButton: {
    width: SEARCH_BAR_HEIGHT,
    height: SEARCH_BAR_HEIGHT,
    borderRadius: radii.searchBar,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },

  // The 19 field tiles scroll horizontally, so this rail is as wide as its
  // content by design. The gutter lives on the content container alone (never
  // on the ScrollView's own style, which would stack a second inset and push
  // the first tile right of the search bar and job-type row below). No mint
  // fill: these are full-colour illustrations, same as the job-type row.
  fieldRailContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.screenX,
    gap: FIELD_RAIL_GAP,
  },
  fieldItem: { alignItems: "center" },
  // Same reserved height as the tile, centred, so a short illustration is
  // optically centred rather than sitting on the baseline.
  fieldArtwork: {
    height: FIELD_RAIL_TILE_HEIGHT,
    justifyContent: "center",
  },
  // Official field names run long ("Engineering & Construction"), so unlike the
  // one-line job-type labels these wrap to two and reserve the height either
  // way, keeping the row's baseline steady.
  fieldLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 11.5,
    lineHeight: 14,
    color: colors.textPrimary,
    textAlign: "center",
    marginTop: 4,
  },

// All four categories share the width evenly, so the row can never extend past
  // the right gutter on any device width — no horizontal scroll needed.
  categoryScrollContent: {
    flexDirection: "row",
    paddingHorizontal: spacing.screenX,
    marginTop: 8,
    gap: CATEGORY_GAP,
  },
  // `flex: 1` divides the leftover width across the four columns; `minWidth: 0`
  // lets a long label truncate instead of pushing the column past its share.
  categoryItem: { flex: 1, minWidth: 0, alignItems: "center" },
  // Width and height are set inline from the measured device width — see
  // `categoryIconSize` — so the tile shrinks rather than overrun on a narrow
  // screen. No fill: the artwork sits straight on the page background.
  categoryIcon: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  // The illustrations are wider than tall and already carry their own colour, so
  // they letterbox inside the tile rather than being cropped or tinted. The tile
  // The artwork itself is sized inline too, from `categoryImageSize`.
  categoryLabel: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.textPrimary, textAlign: "center" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sectionTop,
    paddingBottom: 12,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "baseline", gap: 8, flexShrink: 1 },
  sectionTitle: { fontFamily: fontFamily.extraBold, fontSize: 19, color: colors.textPrimary },
  sectionMeta: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textSecondary },
  sectionAction: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.mint },

  colScrollContent: { gap: 12, paddingHorizontal: spacing.screenX },
  featuredWrap: { paddingHorizontal: spacing.screenX, marginBottom: 12 },
  emptyWrap: { paddingHorizontal: spacing.screenX },

  // The FlatList's contentContainer carries no horizontal padding (the header
  // and footer manage their own `screenX` insets), so the nearby items need the
  // same 20px gutter every other section gets — otherwise they sit flush to the
  // screen edges. The trailing gap mirrors the `rows` container's 12px rhythm.
  flatRow: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.rowGap },
  skeletonGroup: { paddingTop: 4 },
  // Mirrors the row variant's own geometry (72pt media, 12pt gap) so the
  // placeholder lines up with the card it stands in for.
  skeletonRow: {
    flexDirection: "row",
    borderRadius: radii.standard,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 12,
    marginBottom: 12,
  },
  skeletonRowBody: { flex: 1, marginLeft: 12, justifyContent: "center" },
  rows: { paddingHorizontal: spacing.screenX, gap: 12 },

  emptyCard: {
    borderRadius: radii.standard,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emptyTitle: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.textPrimary },
  emptyMessage: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 },

  skeletonMedia: { backgroundColor: "#E6EDEF" },
  skeletonLine: { backgroundColor: "#DCE6EA", borderRadius: 6 },
  skeletonTag: { width: 74, height: 20, borderRadius: 999 },
  skeletonTitle: { width: "72%", height: 15, marginTop: 10 },
  skeletonMetaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  skeletonMeta: { width: 92, height: 11 },
  skeletonMetaShort: { width: 54, height: 11 },

  postCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.screenX,
    marginTop: 22,
    borderRadius: radii.standard,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 14,
  },
  pressed: { opacity: 0.85 },
  postIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.mintTint,
    alignItems: "center",
    justifyContent: "center",
  },
  postCopy: { flex: 1, marginLeft: 11 },
  postTitle: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 17, color: colors.textPrimary },
  postText: { fontFamily: fontFamily.regular, fontSize: 11.5, lineHeight: 15, color: colors.textSecondary, marginTop: 4 },
  postButton: { backgroundColor: colors.mint, borderRadius: 10, marginLeft: 8, paddingHorizontal: 11, paddingVertical: 11 },
  postButtonText: { fontFamily: fontFamily.semibold, fontSize: 11.5, color: colors.white },
});
