// Shared chrome for the full-screen job maps (/jobs-map and /jobs/near-you), in
// a ride-hailing layout: the map fills the screen, a floating search pill sits
// on top, a round locate button floats above a draggable
// bottom sheet that lists the jobs. Colours, type and shadows come from the
// app's design tokens (src/design/tokens.ts); motion follows the no-bounce rule.
import React, { useEffect, useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ScrollViewProps,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { AppIcon } from "@/components/ui/AppIcon";
import { SMOOTH, PressableScale } from "@/src/design/motion";
import { palette, radii, shadows } from "@/src/design/tokens";
import { TextNew } from "@/src/new/components/TextNew";
import { JobFieldGlyph } from "./JobFieldGlyph";

const SNAP_MS = 260;

/**
 * One fixed search radius for both job maps: far enough to cover a normal
 * commute across Phnom Penh, close enough to stay "near you".
 */
export const NEARBY_RADIUS_KM = 10;

/** "0.4 km", "2.9 km", "12 km". */
export function formatKm(km: number) {
  return km < 10
    ? `${(Math.round(km * 10) / 10).toFixed(1)} km`
    : `${Math.round(km)} km`;
}

/** Rough travel time from straight-line distance (walk under 1.5 km, else motorbike). */
export function travelNote(km: number) {
  return km <= 1.5
    ? `${Math.max(1, Math.round(km * 12))} min walk`
    : `${Math.round(km * 4)} min ride`;
}

/* ───────── Top bar ───────── */

export function MapTopBar({
  top,
  title,
  subtitle,
  onBack,
  onPressSearch,
}: {
  top: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onPressSearch?: () => void;
}) {
  return (
    <View pointerEvents="box-none" style={[s.topBar, { top }]}>
      {onBack ? (
        <PressableScale
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[s.circle, shadows.lift]}
        >
          <AppIcon name="back" size={22} color={palette.ink} />
        </PressableScale>
      ) : null}
      {/* PressableScale styles its inner view, so the flex lives on this wrapper. */}
      <View style={{ flex: 1 }}>
        <PressableScale
          onPress={onPressSearch}
          disabled={!onPressSearch}
          accessibilityRole={onPressSearch ? "button" : "text"}
          accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
          style={[s.search, shadows.lift]}
        >
          <View style={s.searchDot}>
            <View style={s.searchDotCore} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <TextNew
              variant="body"
              heading
              weight="bold"
              color={palette.ink}
              numberOfLines={1}
            >
              {title}
            </TextNew>
            {subtitle ? (
              <TextNew
                variant="caption"
                color={palette.muted}
                numberOfLines={1}
              >
                {subtitle}
              </TextNew>
            ) : null}
          </View>
          <AppIcon name="search" size={20} color={palette.slate} />
        </PressableScale>
      </View>
    </View>
  );
}

/* ───────── Locate button ───────── */

export function MapLocateButton({
  onPress,
  active,
}: {
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Center on my location"
      style={[s.circle, shadows.lift]}
    >
      <AppIcon
        name="locate"
        size={22}
        color={active ? palette.cyan : palette.ink}
      />
    </PressableScale>
  );
}

/* ───────── Bottom sheet ───────── */

export type MapSheetProps = {
  /** Visible heights, ascending (e.g. peek, half, full). */
  snaps: number[];
  index: number;
  onIndexChange: (index: number) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  /** Floats just above the sheet's top edge (e.g. the locate button); hidden when fully open. */
  fab?: React.ReactNode;
  bottomInset?: number;
  scrollProps?: ScrollViewProps;
  scrollRef?: React.RefObject<ScrollView | null>;
};

export function MapSheet({
  snaps,
  index,
  onIndexChange,
  header,
  children,
  fab,
  bottomInset = 0,
  scrollProps,
  scrollRef,
}: MapSheetProps) {
  const reduce = useReducedMotion();
  const max = snaps[snaps.length - 1];
  const visible = useSharedValue(snaps[index] ?? snaps[0]);
  const start = useSharedValue(0);

  useEffect(() => {
    const to = snaps[index] ?? snaps[0];
    visible.set(
      reduce ? to : withTiming(to, { duration: SNAP_MS, easing: SMOOTH }),
    );
  }, [index, reduce, snaps, visible]);

  const snapList = useMemo(() => snaps, [snaps]);
  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onStart(() => {
      start.set(visible.get());
    })
    .onChange((e) => {
      const next = start.get() - e.translationY;
      visible.set(Math.min(Math.max(next, snapList[0] - 24), max + 12));
    })
    .onEnd((e) => {
      // Project a little along the fling so a flick moves one snap.
      const projected = visible.get() - e.velocityY * 0.12;
      let best = 0;
      for (let i = 1; i < snapList.length; i += 1) {
        if (
          Math.abs(snapList[i] - projected) <
          Math.abs(snapList[best] - projected)
        )
          best = i;
      }
      visible.set(
        withTiming(snapList[best], { duration: SNAP_MS, easing: SMOOTH }),
      );
      runOnJS(onIndexChange)(best);
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: max - visible.value }],
  }));
  const fabStyle = useAnimatedStyle(() => {
    const fade = interpolate(
      visible.value,
      [snapList[snapList.length - 2] ?? 0, max],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity: fade,
      transform: [{ translateY: interpolate(fade, [0, 1], [8, 0]) }],
    };
  });

  const hidden = max - (snaps[index] ?? snaps[0]);

  return (
    <Animated.View style={[s.sheet, { height: max }, sheetStyle]}>
      {fab ? (
        <Animated.View
          pointerEvents={index === snaps.length - 1 ? "none" : "box-none"}
          style={[s.fab, fabStyle]}
        >
          {fab}
        </Animated.View>
      ) : null}
      <View style={[s.sheetBody, shadows.nav]}>
        <GestureDetector gesture={pan}>
          <View>
            <Pressable
              accessibilityRole="adjustable"
              accessibilityLabel="Job list"
              accessibilityHint="Drag up to see more jobs"
              onPress={() =>
                onIndexChange(index === snaps.length - 1 ? 0 : index + 1)
              }
              style={s.handleHit}
            >
              <View style={s.handle} />
            </Pressable>
            {header}
          </View>
        </GestureDetector>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: hidden + bottomInset + 16,
            gap: 10,
          }}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

/**
 * Snap heights for a full-screen map sheet: a peek, half the screen, and fully
 * open up to `topReserve` from the top (just under the floating search bar).
 */
export function useSheetSnaps(peek = 210, topReserve = 120) {
  const { height } = useWindowDimensions();
  return useMemo(
    () => [peek, Math.round(height * 0.5), Math.round(height - topReserve)],
    [height, peek, topReserve],
  );
}

/* ───────── Sheet header & job rows ───────── */

export function MapSheetHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={s.sheetHeader}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <TextNew
          variant="section"
          heading
          weight="bold"
          color={palette.ink}
          numberOfLines={1}
        >
          {title}
        </TextNew>
        {subtitle ? (
          <TextNew variant="meta" color={palette.muted} numberOfLines={1}>
            {subtitle}
          </TextNew>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function FieldDisc({
  category,
  size = 44,
  inverse,
}: {
  category?: string | null;
  size?: number;
  /** Selected look: white disc with a cyan ring (the icon keeps its own colours). */
  inverse?: boolean;
}) {
  return (
    <View
      style={[
        s.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: inverse ? palette.surface : palette.field,
          borderWidth: inverse ? 2 : 0,
          borderColor: palette.cyan,
        },
      ]}
    >
      <JobFieldGlyph category={category} size={Math.round(size * 0.54)} />
    </View>
  );
}

export function MapJobRow({
  category,
  title,
  subtitle,
  pay,
  distance,
  selected,
  onPress,
}: {
  category?: string | null;
  title: string;
  subtitle?: string;
  pay?: string | null;
  distance?: string | null;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      scale={0.985}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={[title, subtitle, pay, distance]
        .filter(Boolean)
        .join(", ")}
      style={[s.row, selected && s.rowOn]}
    >
      <FieldDisc category={category} inverse={selected} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TextNew
          variant="body"
          heading
          weight="bold"
          color={palette.ink}
          numberOfLines={1}
        >
          {title}
        </TextNew>
        {subtitle ? (
          <TextNew variant="meta" color={palette.muted} numberOfLines={1}>
            {subtitle}
          </TextNew>
        ) : null}
        {pay ? (
          <View style={s.payPill}>
            <TextNew
              variant="caption"
              weight="semibold"
              color={palette.cyanDeep}
            >
              {pay}
            </TextNew>
          </View>
        ) : null}
      </View>
      {distance ? (
        <View style={s.rowRight}>
          <TextNew variant="meta" weight="semibold" color={palette.ink}>
            {distance}
          </TextNew>
          <AppIcon name="chevron" size={18} color={palette.slate} />
        </View>
      ) : null}
    </PressableScale>
  );
}

/** The highlighted job at the top of the sheet after a pin tap. */
export function MapSelectedJob({
  category,
  title,
  subtitle,
  pay,
  distance,
  note,
  onView,
  onClose,
  saved,
  onToggleSave,
}: {
  category?: string | null;
  title: string;
  subtitle?: string;
  pay?: string | null;
  distance?: string | null;
  note?: string | null;
  onView: () => void;
  onClose: () => void;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  return (
    <View style={[s.selected, shadows.card]}>
      <View style={s.selectedTop}>
        <FieldDisc category={category} size={52} inverse />
        <View style={{ flex: 1, minWidth: 0 }}>
          <TextNew
            variant="title"
            heading
            weight="bold"
            color={palette.ink}
            numberOfLines={2}
          >
            {title}
          </TextNew>
          {subtitle ? (
            <TextNew variant="meta" color={palette.muted} numberOfLines={1}>
              {subtitle}
            </TextNew>
          ) : null}
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close job"
          style={s.close}
        >
          <AppIcon name="close" size={16} color={palette.slate} />
        </Pressable>
      </View>
      <View style={s.facts}>
        {pay ? <Fact label="Pay" value={pay} /> : null}
        {distance ? <Fact label="Distance" value={distance} /> : null}
        {note ? <Fact label="Travel" value={note} /> : null}
      </View>
      <View style={s.ctaRow}>
        {onToggleSave ? (
          <PressableScale
            onPress={onToggleSave}
            accessibilityRole="button"
            accessibilityLabel={saved ? "Remove from saved" : "Save job"}
            accessibilityState={{ selected: saved }}
            style={[s.saveBtn, saved && s.saveOn]}
          >
            <AppIcon
              name={saved ? "check" : "plus"}
              size={20}
              color={saved ? "#fff" : palette.cyanDeep}
              strokeWidth={2.2}
            />
          </PressableScale>
        ) : null}
        <View style={{ flex: 1 }}>
          <PressableScale
            onPress={onView}
            accessibilityRole="button"
            accessibilityLabel={`View ${title}`}
            style={[s.cta, shadows.lift]}
          >
            <TextNew variant="title" heading weight="bold" color="#fff">
              View job
            </TextNew>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.fact}>
      <TextNew variant="caption" color={palette.muted}>
        {label}
      </TextNew>
      <TextNew
        variant="body"
        heading
        weight="bold"
        color={palette.ink}
        numberOfLines={1}
      >
        {value}
      </TextNew>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  circle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    minHeight: 52,
    borderRadius: radii.pill,
    backgroundColor: palette.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 14,
    paddingRight: 16,
    paddingVertical: 7,
  },
  searchDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.cyanTint,
    alignItems: "center",
    justifyContent: "center",
  },
  searchDotCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.cyan,
  },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sheetBody: {
    flex: 1,
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    overflow: "hidden",
  },
  fab: { position: "absolute", right: 16, top: -60, zIndex: 2 },
  handleHit: { alignItems: "center", paddingTop: 10, paddingBottom: 6 },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.line,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  disc: { alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  rowOn: { borderColor: palette.cyanSoft, backgroundColor: "#F3FAFC" },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 2 },
  payPill: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: palette.cyanTint,
  },
  selected: {
    borderRadius: radii.card,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    gap: 14,
  },
  selectedTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.pillIdle,
    alignItems: "center",
    justifyContent: "center",
  },
  facts: { flexDirection: "row", gap: 8 },
  fact: {
    flex: 1,
    borderRadius: radii.input,
    backgroundColor: palette.field,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ctaRow: { flexDirection: "row", gap: 10 },
  saveBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.cyanTint,
    alignItems: "center",
    justifyContent: "center",
  },
  saveOn: { backgroundColor: palette.navy },
  cta: {
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: palette.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
});
