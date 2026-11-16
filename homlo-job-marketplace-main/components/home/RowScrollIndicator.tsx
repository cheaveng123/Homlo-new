/**
 * RowScrollIndicator.tsx
 *
 * A "track and thumb" progress bar for a horizontally scrolling row: the thumb
 * is as wide as the fraction of the row currently on screen, and slides as the
 * row moves. Fades out entirely when the row doesn't overflow, so short rows
 * don't carry a dead control.
 *
 * Everything here runs on the UI thread via Reanimated. The scroll handler
 * writes to shared values rather than React state, so a drag never re-renders
 * the row it belongs to — the thumb tracks the finger with no lag and no frame
 * drop from list reconciliation.
 *
 * Pair one `useRowIndicator()` with one `RowScrollIndicator`, and wire the
 * returned props onto a horizontal `Animated.FlatList`.
 */

import React, { useRef } from "react";
import type { LayoutChangeEvent } from "react-native";
import { StyleSheet } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

// Short and low-contrast on purpose: this is ambient wayfinding, not a control.
const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 4;
// Floor on the thumb so a very long row still leaves something to grab —
// below this the thumb stops reading as a thumb at all.
const MIN_THUMB_RATIO = 0.2;
// Tolerance in points before a row counts as overflowing, so a sub-pixel
// rounding difference doesn't flip the indicator on and off.
const OVERFLOW_EPSILON = 1;

export type RowIndicator = {
  x: SharedValue<number>;
  visibleWidth: SharedValue<number>;
  contentWidth: SharedValue<number>;
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
  onLayout: (event: LayoutChangeEvent) => void;
  onContentSizeChange: (width: number, height: number) => void;
};

/**
 * Creates the shared values and handlers one scrolling row needs. One instance
 * per row — they are per-row by nature, since each tracks different content.
 */
export function useRowIndicator(): RowIndicator {
  const x = useSharedValue(0);
  const visibleWidth = useSharedValue(0);
  const contentWidth = useSharedValue(0);

  // The two layout handlers write from the JS thread, where the React Compiler
  // treats a `useSharedValue` binding as immutable. Routing the writes through a
  // ref is the same indirection AutoScrollRow uses for its own JS-thread
  // writes, and keeps the values mutable.
  const layout = useRef({ visibleWidth, contentWidth });

  const onScroll = useAnimatedScrollHandler((event) => {
    x.value = event.contentOffset.x;
    visibleWidth.value = event.layoutMeasurement.width;
    contentWidth.value = event.contentSize.width;
  });

  const onLayout = (event: LayoutChangeEvent) => {
    layout.current.visibleWidth.value = event.nativeEvent.layout.width;
  };

  const onContentSizeChange = (width: number) => {
    layout.current.contentWidth.value = width;
  };

  return { x, visibleWidth, contentWidth, onScroll, onLayout, onContentSizeChange };
}

export function RowScrollIndicator({
  x,
  visibleWidth,
  contentWidth,
}: Pick<RowIndicator, "x" | "visibleWidth" | "contentWidth">) {
  // Only ever fades between 0 and 1, so no timing is needed — the bar is either
  // there or it isn't, and the track keeps its space either way.
  const trackStyle = useAnimatedStyle(() => ({
    opacity: contentWidth.value > visibleWidth.value + OVERFLOW_EPSILON ? 1 : 0,
  }));

  const thumbStyle = useAnimatedStyle(() => {
    const visible = visibleWidth.value;
    const content = contentWidth.value;
    // Before the first layout pass both are 0; treat that as "don't overflow"
    // so nothing renders at a nonsense width.
    const thumbWidth =
      content > 0
        ? Math.max(MIN_THUMB_RATIO, Math.min(1, visible / content)) * TRACK_WIDTH
        : TRACK_WIDTH;
    const scrollable = Math.max(content - visible, 1);
    const progress = Math.min(1, Math.max(0, x.value / scrollable));
    return {
      width: thumbWidth,
      transform: [{ translateX: progress * (TRACK_WIDTH - thumbWidth) }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.track, trackStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.thumb, thumbStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: "rgba(14,59,46,0.12)",
    alignSelf: "center",
    marginTop: 14,
    overflow: "hidden",
  },
  thumb: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: "#0F9D62",
  },
});