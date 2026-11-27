import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { TextNew } from '../TextNew';
import { BellGlyph, SearchGlyph } from '@/src/components/icons/DashIcons';
import { dash, HEADER_H } from './dashTokens';

type Props = {
  title: string;
  topInset: number;
  scrollY: SharedValue<number>;
  initials: string;
  hasUnread?: boolean;
  onPressSearch?: () => void;
  onPressBell: () => void;
};

/** Sticky header over the hero. Turns solid cyan once the page scrolls past 60pt. */
export function DashHeaderNew({ title, topInset, scrollY, initials, hasUnread, onPressSearch, onPressBell }: Props) {
  const reduced = useReducedMotion();
  const solid = useDerivedValue(() => {
    const target = scrollY.value > 60 ? 1 : 0;
    return reduced ? target : withTiming(target, { duration: 220 });
  });
  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(solid.value, [0, 1], ['rgba(10,135,165,0)', dash.headerSolid]),
    shadowOpacity: interpolate(solid.value, [0, 1], [0, 0.18]),
    elevation: interpolate(solid.value, [0, 1], [0, 8]),
  }));

  return (
    <Animated.View style={[s.wrap, { height: HEADER_H + topInset, paddingTop: topInset + 22 }, bg]}>
      <TextNew variant="hero" color={dash.navy} numberOfLines={1} style={s.title}>{title}</TextNew>
      <View style={s.right}>
        {onPressSearch ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={onPressSearch} style={s.iconBtn} hitSlop={4}>
            <SearchGlyph />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasUnread ? 'Notifications, unread' : 'Notifications'}
          onPress={onPressBell}
          style={s.iconBtn}
          hitSlop={4}
        >
          <BellGlyph />
          {hasUnread ? <View style={s.dot} /> : null}
        </Pressable>
        <View style={s.avatar} accessibilityLabel="Your account">
          <TextNew variant="title" heading weight="extrabold" color={dash.cyanDeep} style={s.initials}>{initials}</TextNew>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#06323F',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
  },
  title: { flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: 7,
    right: 8,
    // 9pt amber dot + 2pt ring
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: dash.amber,
    borderWidth: 2,
    borderColor: '#1A9BB8',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 4,
    backgroundColor: dash.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 15, lineHeight: 19 },
});
