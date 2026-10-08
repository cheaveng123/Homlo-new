/**
 * ShimmerIcon.tsx
 *
 * A diagonal light sweep that passes over whatever it wraps — the job-type
 * illustrations on the home screen, mostly, but nothing here is home-specific.
 *
 * Three nested layers, outside in:
 *   1. `clip`   — the box that masks the sweep (`overflow: hidden` + radius)
 *   2. `track`  — an oversize canvas rotated by `angle`, so translating a child
 *                 along its local X reads as a top-left → bottom-right sweep
 *   3. `beam`   — the narrow gradient band that does the travelling
 *
 * The animation runs on the UI thread via Reanimated, so it never writes React
 * state and never re-renders a parent mid-flight. The gradient is
 * `expo-linear-gradient` rather than `react-native-linear-gradient`, and the
 * mask is a plain clipped box rather than `@react-native-masked-view`: the
 * illustrations are transparent PNGs on a near-white page, so a beam that runs
 * a little past the artwork is invisible, and this way the component needs no
 * native module that the app doesn't already ship.
 *
 * Usage:
 *
 *   <ShimmerIcon width={64} height={64} delay={index * 250}>
 *     <Image source={icon} style={{ width: 46, height: 46 }} resizeMode="contain" />
 *   </ShimmerIcon>
 *
 * `width`/`height` may be omitted for boxes whose size comes from their content
 * (skeleton cards, full-width rows): the component then measures itself on
 * layout and runs the same sweep. `pause` shortens the rest between sweeps for
 * loading states, where a 5s gap would read as a stalled animation.
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// 800ms of light, then 5s of nothing. The long gap is the whole point: a sweep
// repeating any faster stops reading as a highlight and starts reading as a
// loading state, and these tiles aren't loading.
const SWEEP_DURATION = 800;
const PAUSE_DURATION = 5000;

// Top-left to bottom-right. Same lean as the travelling border on the job
// details screen, so the two read as one motion language.
const DEFAULT_ANGLE = 30;

// A band, not a full-width wash: wide enough to register as light, narrow
// enough that the artwork underneath stays legible while it passes.
const BEAM_RATIO = 0.55;

// Symmetric ramp with a hot core. A three-stop gradient reads as a rectangle
// sliding past; the extra stops soften the edges into something beam-shaped.
const BEAM_COLORS = [
  "rgba(255,255,255,0)",
  "rgba(255,255,255,0.35)",
  "rgba(255,255,255,0.9)",
  "rgba(255,255,255,0.35)",
  "rgba(255,255,255,0)",
] as const;

export type ShimmerIconProps = {
  children: ReactNode;
  /** Size of the clipping box, which is also the size the sweep is cut to. Omit either to let the content size that axis and the sweep follow the measured layout. */
  width?: number;
  height?: number;
  /** Corner radius of the clipping box. */
  radius?: number;
  /** Sweep direction in degrees. 0 is a left-to-right sweep, 30 is the default diagonal. */
  angle?: number;
  /** Milliseconds to wait before the first sweep. Use `index * 250` to send a wave down a row. */
  delay?: number;
  /** Milliseconds of rest between sweeps. Defaults to the slow art cadence; pass a smaller value for loading skeletons. */
  pause?: number;
  style?: StyleProp<ViewStyle>;
};

export function ShimmerIcon({
  children,
  width,
  height,
  radius = 0,
  angle = DEFAULT_ANGLE,
  delay = 0,
  pause = PAUSE_DURATION,
  style,
}: ShimmerIconProps) {
  const progress = useSharedValue(0);

  // Assumed reduced until the query resolves, so the loop never starts and
  // then gets cancelled a frame later for users who have the setting on.
  const [reduceMotion, setReduceMotion] = useState(true);

  // Fluid boxes (skeletons, full-width rows) report their layout once mounted;
  // the geometry below needs real numbers before the beam can travel.
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    if (width != null && height != null) return;
    const { width: w, height: h } = e.nativeEvent.layout;
    setMeasured((prev) => (prev && prev.width === w && prev.height === h ? prev : { width: w, height: h }));
  };

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    if ((width == null || height == null) && measured == null) return;

    progress.value = 0;
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          // `Easing.out` starts fast and decelerates, which reads as light
          // running off the far side of a curve rather than sliding linearly.
          withTiming(1, { duration: SWEEP_DURATION, easing: Easing.out(Easing.quad) }),
          // The zero-duration step back to 0 is what makes the loop repeat
          // rather than re-run from 1 (which wouldn't move at all). It lands
          // while the beam is off the box, so the jump is never on screen.
          withDelay(pause, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );

    return () => cancelAnimation(progress);
  }, [delay, measured, pause, progress, reduceMotion, width, height]);

  // A w×h box rotated by `angle` occupies this bounding box. The beam has to
  // travel a full box-width plus its own width past each end to enter and exit
  // cleanly — any less and it visibly clips mid-sweep.
  const boxW = width ?? measured?.width ?? 0;
  const boxH = height ?? measured?.height ?? 0;
  const sized = boxW > 0 && boxH > 0;
  const radians = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const rotatedWidth = boxW * cos + boxH * sin;
  const rotatedHeight = boxW * sin + boxH * cos;
  const beamSize = Math.round(Math.max(boxW, boxH) * BEAM_RATIO);
  const trackWidth = Math.ceil(rotatedWidth + beamSize * 2);
  const trackHeight = Math.ceil(Math.max(rotatedHeight, beamSize * 2));

  const beamStyle = useAnimatedStyle(() => ({
    // Local X on the rotated track, so this comes out diagonal on screen. The
    // full track width is the travel: at 0 the beam is entirely left of the
    // rotated box, at the far end it is entirely right of it.
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, trackWidth]) }],
  }));

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.clip,
        width != null ? { width } : null,
        height != null ? { height } : null,
        { borderRadius: radius },
        style,
      ]}
    >
      {children}

      {sized ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View
            style={[
              styles.track,
              {
                width: trackWidth,
                height: trackHeight,
                left: (boxW - trackWidth) / 2,
                top: (boxH - trackHeight) / 2,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          >
            <Animated.View style={[styles.beam, { width: beamSize }, beamStyle]}>
              <LinearGradient
                colors={BEAM_COLORS}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  track: {
    position: "absolute",
  },
  beam: {
    height: "100%",
    left: 0,
    position: "absolute",
    top: 0,
  },
});
