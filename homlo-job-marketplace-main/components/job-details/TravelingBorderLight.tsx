/**
 * TravelingBorderLight.tsx
 *
 * React Native has no equivalent of CSS `offset-path: border-box`, so this
 * reimplements the same idea by hand: a small white streak with fade at
 * both ends, traveling at constant speed around the exact rounded-rect
 * perimeter of whatever it wraps (corners included), oriented tangent to
 * the path the whole way — matching the HTML preview's traveling-light
 * effect on the location pill.
 *
 * Usage (wrap the pill's content; the wrapper measures itself via onLayout,
 * so no fixed width/height needs to be passed in):
 *
 *   <TravelingBorderLight borderRadius={999}>
 *     <View style={styles.pillInner}>
 *       <MapPinIcon size={14} color={colors.accent} />
 *       <Text style={styles.pillText}>Toul Kork, Phnom Penh</Text>
 *     </View>
 *   </TravelingBorderLight>
 *
 * Requires react-native-reanimated (already in the project's stack).
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import LinearGradient from '@/lib/native/linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { travelingLight } from './jobDetailTokens';

interface TravelingBorderLightProps {
  children: React.ReactNode;
  /** Must match the wrapped element's actual border radius (e.g. 999 for a full pill). */
  borderRadius: number;
  streakLength?: number;
  streakThickness?: number;
  durationMs?: number;
  color?: string;
}

/**
 * Point + heading (in degrees, 0 = pointing along +x) at distance `d`
 * along the clockwise perimeter of a W x H rounded rect with corner
 * radius `r`, starting at the end of the top-left corner.
 */
function pointOnRoundedRect(d: number, w: number, h: number, r: number) {
  'worklet';
  const straightX = Math.max(w - 2 * r, 0);
  const straightY = Math.max(h - 2 * r, 0);
  const arcLen = (Math.PI * r) / 2;
  const total = 2 * straightX + 2 * straightY + 4 * arcLen;
  let dist = ((d % total) + total) % total;

  // 1. top edge
  if (dist <= straightX) {
    return { x: r + dist, y: 0, heading: 0 };
  }
  dist -= straightX;

  // 2. top-right arc: center (w-r, r), theta -90 -> 0
  if (dist <= arcLen) {
    const theta = -90 + (dist / arcLen) * 90;
    const rad = (theta * Math.PI) / 180;
    return {
      x: w - r + r * Math.cos(rad),
      y: r + r * Math.sin(rad),
      heading: theta + 90,
    };
  }
  dist -= arcLen;

  // 3. right edge
  if (dist <= straightY) {
    return { x: w, y: r + dist, heading: 90 };
  }
  dist -= straightY;

  // 4. bottom-right arc: center (w-r, h-r), theta 0 -> 90
  if (dist <= arcLen) {
    const theta = (dist / arcLen) * 90;
    const rad = (theta * Math.PI) / 180;
    return {
      x: w - r + r * Math.cos(rad),
      y: h - r + r * Math.sin(rad),
      heading: theta + 90,
    };
  }
  dist -= arcLen;

  // 5. bottom edge (moving -x)
  if (dist <= straightX) {
    return { x: w - r - dist, y: h, heading: 180 };
  }
  dist -= straightX;

  // 6. bottom-left arc: center (r, h-r), theta 90 -> 180
  if (dist <= arcLen) {
    const theta = 90 + (dist / arcLen) * 90;
    const rad = (theta * Math.PI) / 180;
    return {
      x: r + r * Math.cos(rad),
      y: h - r + r * Math.sin(rad),
      heading: theta + 90,
    };
  }
  dist -= arcLen;

  // 7. left edge (moving -y)
  if (dist <= straightY) {
    return { x: 0, y: h - r - dist, heading: 270 };
  }
  dist -= straightY;

  // 8. top-left arc: center (r, r), theta 180 -> 270
  const theta = 180 + (dist / arcLen) * 90;
  const rad = (theta * Math.PI) / 180;
  return {
    x: r + r * Math.cos(rad),
    y: r + r * Math.sin(rad),
    heading: theta + 90,
  };
}

export function TravelingBorderLight({
  children,
  borderRadius,
  streakLength = travelingLight.streakLength,
  streakThickness = travelingLight.streakThickness,
  durationMs = travelingLight.durationMs,
  color = '#FFFFFF',
}: TravelingBorderLightProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const progress = useSharedValue(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  React.useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: durationMs, easing: Easing.linear }),
      -1,
      false
    );
  }, [durationMs, progress]);

  const w = size.width;
  const h = size.height;
  const r = Math.min(borderRadius, w / 2, h / 2);

  const straightX = Math.max(w - 2 * r, 0);
  const straightY = Math.max(h - 2 * r, 0);
  const arcLen = (Math.PI * r) / 2;
  const perimeter = 2 * straightX + 2 * straightY + 4 * arcLen;

  const animatedStyle = useAnimatedStyle(() => {
    if (w === 0 || h === 0 || perimeter === 0) {
      return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
    }
    const d = progress.value * perimeter;
    const { x, y, heading } = pointOnRoundedRect(d, w, h, r);
    return {
      opacity: 1,
      transform: [
        { translateX: x - streakLength / 2 },
        { translateY: y - streakThickness / 2 },
        { rotate: `${heading}deg` },
      ],
    };
  });

  return (
    <View onLayout={onLayout} style={styles.wrapper}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.streak,
          {
            width: streakLength,
            height: streakThickness,
            shadowColor: color,
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={['transparent', color, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // no extra sizing here — this view should hug whatever it wraps
    // (the caller's pill already sets its own padding/border/radius)
  },
  streak: {
    position: 'absolute',
    top: 0,
    left: 0,
    shadowOpacity: 0.55,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
});
