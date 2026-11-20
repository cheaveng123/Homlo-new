/**
 * components/common/SegmentedTabs.tsx
 *
 * The pill-shaped tab switcher (Applications / Messages / Updates).
 * No counters/badges next to labels — plain text only, per design decision.
 *
 * Switching is animated rather than snapped: one mint pill slides between tabs
 * and each label interpolates between the inactive and active colours as the
 * pill passes it, so the two states are one continuous movement. Driven by
 * reanimated shared values, which run on the UI thread and stay smooth even
 * while the list below is doing its own work.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { colors, radius, type } from '../../theme/tokens';

import { smooth } from '@/src/design/motion';
type Props = {
  tabs: string[];
  activeTab: string;
  onChange: (tab: string) => void;
};

/** Container padding on each side; the pill is inset by the same amount. */
const PILL_INSET = 4;
/** Gap between tabs; the pill has to hop this far per step. */
const TAB_GAP = 2;

const AnimatedText = Animated.Text;

export default function SegmentedTabs({ tabs, activeTab, onChange }: Props) {
  // Measured rather than assumed, because the container is width-constrained and
  // the pill must land exactly under the active tab on any screen.
  const [trackWidth, setTrackWidth] = useState(0);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab === activeTab),
  );

  const progress = useSharedValue(activeIndex);

  useEffect(() => {
    // A spring rather than a timing curve: the pill should arrive with a little
    // weight, and it must never overshoot past the track edges at index 0 or n-1.
    progress.value = smooth(activeIndex);
  }, [activeIndex, progress]);

  const inner = trackWidth - PILL_INSET * 2;
  const tabWidth = tabs.length > 0 ? (inner - TAB_GAP * (tabs.length - 1)) / tabs.length : 0;

  const pillStyle = useAnimatedStyle(() => ({
    width: tabWidth,
    transform: [{ translateX: progress.value * (tabWidth + TAB_GAP) }],
  }));

  return (
    <View
      style={styles.container}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {/* Rendered only once the track is measured, so the pill never flashes at
          x=0 on the first frame with a guessed width. */}
      {tabWidth > 0 ? <Animated.View style={[styles.pill, pillStyle]} /> : null}

      {tabs.map((tab, index) => (
        <SegmentTab
          key={tab}
          label={tab}
          index={index}
          activeIndex={activeIndex}
          progress={progress}
          onPress={() => onChange(tab)}
        />
      ))}
    </View>
  );
}

/**
 * Split out so each tab owns its own animated style — a hook inside the `.map`
 * above would be a hook in a loop, and the count is caller-supplied.
 */
function SegmentTab({
  label,
  index,
  activeIndex,
  progress,
  onPress,
}: {
  label: string;
  index: number;
  activeIndex: number;
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  const active = index === activeIndex;

  // Brightens as the pill arrives and dims as it leaves, rather than flipping at
  // the halfway point.
  const labelStyle = useAnimatedStyle(() => {
    const distance = Math.abs(index - progress.value);
    const closeness = Math.max(0, 1 - distance);
    return { color: interpolateColor(closeness, [0, 1], [colors.gray, colors.white]) };
  });

  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <AnimatedText style={[type.tabLabel, labelStyle]}>{label}</AnimatedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20, // matches .tabs { margin: 0 20px 6px }
    marginBottom: 6,
    backgroundColor: colors.sand100,
    borderRadius: radius.pill,
    padding: PILL_INSET,
    flexDirection: 'row',
    gap: TAB_GAP,
  },
  // Absolutely positioned behind the labels; the tabs themselves stay transparent.
  pill: {
    position: 'absolute',
    top: PILL_INSET,
    bottom: PILL_INSET,
    left: PILL_INSET,
    borderRadius: radius.pill,
    backgroundColor: colors.mint500,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});