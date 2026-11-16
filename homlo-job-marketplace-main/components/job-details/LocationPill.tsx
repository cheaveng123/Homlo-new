/**
 * LocationPill.tsx
 *
 * Replaces the old job-type ("Full-time") pill on the Job Detail screen,
 * in the exact same position. Full stadium shape, colored outline,
 * colored icon + bold text, white fill — matching the "Group Order"
 * reference style. Instead of the traveling light that used to run along
 * the border, it now has a soft accent glow surrounding the container
 * (shadow halo on iOS, tinted halo layer on Android).
 *
 * Usage on the existing Job Detail screen, in the same spot the old
 * job-type chip occupied:
 *
 *   <LocationPill
 *     locationName="Toul Kork, Phnom Penh"
 *     onPress={() => navigateToJobLocationMap(job.id)}
 *   />
 *
 * IMPORTANT re: "the RN version looks less bold / weirder than the
 * preview" — every size/weight/color below comes from jobDetailTokens.ts,
 * which was sampled from the real screenshot. Do not swap fontWeight
 * '600' for '500' or 'bold', do not round the hex colors, and do not
 * change the padding/gap numbers — those substitutions are exactly what
 * causes the drift.
 */

import React, { useEffect } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, locationPill } from './jobDetailTokens';

interface LocationPillProps {
  locationName: string;
  onPress?: () => void;
}

function PinIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10} r={2.5} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function LocationPill({ locationName, onPress }: LocationPillProps) {
  const glow = useSharedValue(0);

  useEffect(() => {
    // Slow, seamless breathing glow: opacity + a tiny scale pulse.
    glow.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [glow]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.08 + 0.16 * glow.value,
    transform: [{ scale: 1 + 0.04 * glow.value }],
  }));

  return (
    <View style={styles.glowWrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.glowHalo, haloStyle]}
      />
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
      >
        <PinIcon size={locationPill.iconSize} color={colors.accent} />
        <Text style={styles.text} numberOfLines={1}>
          {locationName}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Accent-colored glow behind the pill: a colored shadow on iOS and a
  // tightly hugging tinted halo layer on Android (Android shadows can't
  // be tinted). The halo pulses via the animated style above — it stays
  // vertically compact so the glow reads around the pill, not above/below.
  glowWrap: {
    alignSelf: 'flex-start',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  glowHalo: {
    position: 'absolute',
    top: -2,
    left: -3,
    right: -3,
    bottom: -2,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: locationPill.gap,
    borderWidth: locationPill.borderWidth,
    borderColor: colors.accent,
    borderRadius: locationPill.borderRadius,
    paddingVertical: locationPill.paddingVertical,
    paddingHorizontal: locationPill.paddingHorizontal,
    backgroundColor: colors.surface,
  },
  pillPressed: {
    backgroundColor: colors.accentSoft,
  },
  text: {
    fontSize: locationPill.fontSize,
    fontWeight: locationPill.fontWeight,
    color: colors.accent,
  },
});
