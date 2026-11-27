// The one job pin used by every job map in the app (MapLibre MarkerView and
// react-native-maps Marker alike). A white capsule with the job's field icon
// (the app's secondary field icon set) on a light disc, an optional short pay
// label, and a tail pointing at the spot. Selected: the capsule turns navy.
//
// Motion follows the app rule (src/design/motion.tsx): decelerating ease, no
// springs, no overshoot, and short. Entrance = fade + 8pt rise + 0.86 -> 1 over
// 220ms with a small stagger; selection = colour swap + 1.06 scale over 180ms.
// Reduce Motion renders the final state immediately.
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { SMOOTH } from "@/src/design/motion";
import { JobFieldGlyph } from "./JobFieldGlyph";

const DISC = "#EEF5F8";
const NAVY = "#14324A";
const WHITE = "#FFFFFF";

export const PIN_ENTER_MS = 220;
export const PIN_SELECT_MS = 180;
const STAGGER_MS = 24;
const MAX_STAGGER_STEPS = 10;

/** How long a snapshot-based marker (react-native-maps on Android) must keep tracking view changes. */
export function pinAnimationWindow(index = 0) {
  return Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS + PIN_ENTER_MS + 120;
}

export type JobMapPinProps = {
  category?: string | null;
  /** Short pay text, e.g. "$180". Omitted -> round icon-only pin. */
  label?: string | null;
  selected?: boolean;
  /** Position in the list, used for the entrance stagger. */
  index?: number;
};

export const JobMapPin = React.memo(function JobMapPin({ category, label, selected = false, index = 0 }: JobMapPinProps) {
  const reduce = useReducedMotion();
  const enter = useSharedValue(reduce ? 1 : 0);
  const sel = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    if (reduce) { enter.value = 1; return; }
    enter.value = withDelay(
      Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS,
      withTiming(1, { duration: PIN_ENTER_MS, easing: SMOOTH }),
    );
    // Entrance plays once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const to = selected ? 1 : 0;
    sel.value = reduce ? to : withTiming(to, { duration: PIN_SELECT_MS, easing: SMOOTH });
  }, [reduce, sel, selected]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: interpolate(enter.value, [0, 1], [8, 0]) },
      { scale: interpolate(enter.value, [0, 1], [0.86, 1]) * interpolate(sel.value, [0, 1], [1, 1.06]) },
    ],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(sel.value, [0, 1], [WHITE, NAVY]),
  }));
  const tailStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(sel.value, [0, 1], [WHITE, NAVY]),
  }));
  // The field icons carry their own navy/cyan/amber colours, so the disc stays
  // light in both states: soft blue-grey on the white pin, white on the navy one.
  const discStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(sel.value, [0, 1], [DISC, WHITE]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(sel.value, [0, 1], [NAVY, WHITE]),
  }));

  const hasLabel = Boolean(label);

  return (
    <Animated.View style={[styles.wrap, wrapStyle]} collapsable={false}>
      <Animated.View style={[styles.body, hasLabel ? styles.bodyLabel : styles.bodyRound, bodyStyle]}>
        <Animated.View style={[styles.disc, discStyle]}>
          <JobFieldGlyph category={category} size={20} />
        </Animated.View>
        {hasLabel ? (
          <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>
            {label}
          </Animated.Text>
        ) : null}
      </Animated.View>
      <Animated.View style={[styles.tail, tailStyle]} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingHorizontal: 4, paddingTop: 2 },
  center: { alignItems: "center", justifyContent: "center" },
  body: {
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0A2A3A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
  },
  bodyRound: { padding: 3, borderRadius: 999 },
  bodyLabel: { paddingLeft: 3, paddingRight: 10, paddingVertical: 3, borderRadius: 999, gap: 6 },
  disc: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13, fontWeight: "700", maxWidth: 90, fontVariant: ["tabular-nums"] },
  tail: {
    width: 10,
    height: 10,
    marginTop: -6,
    zIndex: -1,
    transform: [{ rotate: "45deg" }],
    borderBottomRightRadius: 2,
  },
});
