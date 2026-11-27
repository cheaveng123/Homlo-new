import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppIcon, type IconName } from '@/components/ui/AppIcon';
import { haptic } from '@/lib/haptics';
import { colors, fontFamily } from './theme';

import { smooth } from '@/src/design/motion';
type Tab = { key: string; label: string; icon: IconName };

const TABS: Tab[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'search', label: 'Search', icon: 'search' },
  { key: 'post', label: 'Post', icon: 'plus' },
  { key: 'alerts', label: 'Alerts', icon: 'bell' },
  { key: 'profile', label: 'Profile', icon: 'user' },
];

const BAR_HEIGHT = 58;
const NAV_IDLE = '#69777A';
const NAV_ACTIVE_LABEL = '#0B6F8A';
const PILL_WIDTH = 56;
const PILL_HEIGHT = 32;
const PRESS = { damping: 18, stiffness: 400 } as const;

function TabItem({
  tab,
  active,
  badgeCount,
  reduced,
  onPress,
}: {
  tab: Tab;
  active: boolean;
  badgeCount?: number;
  reduced: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  // A small bounce when this tab becomes the active one.
  useEffect(() => {
    if (active && !reduced) {
      scale.value = smooth(1);
    }
  }, [active, reduced, scale]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Active indicator: a 16x3 cyan bar under the icon (scaleX 0.3 -> 1, 250ms). No pill.
  const bar = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    bar.value = active ? (reduced ? 1 : withSequence(withTiming(0.3, { duration: 0 }), withTiming(1, { duration: 250 }))) : 0;
  }, [active, reduced, bar]);
  const barStyle = useAnimatedStyle(() => ({ opacity: bar.value > 0 ? 1 : 0, transform: [{ scaleX: bar.value }] }));
  const color = active ? colors.mint : NAV_IDLE;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={badgeCount ? `${tab.label}, ${badgeCount} unread` : tab.label}
      accessibilityState={{ selected: active }}
      hitSlop={4}
      onPress={onPress}
      onPressIn={() => { if (!reduced) scale.set(smooth(0.94, 140)); }}
      onPressOut={() => { if (!reduced) scale.set(smooth(1)); }}
      style={styles.item}
    >
      <Animated.View style={[styles.iconWrap, iconStyle]}>
        <AppIcon name={tab.icon} size={22} color={color} />
        {tab.key === 'post' && active ? <View style={styles.postDot} /> : null}
        {badgeCount ? (
          <Animated.View entering={reduced ? undefined : ZoomIn} style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
          </Animated.View>
        ) : null}
      </Animated.View>
      <Animated.View style={[styles.activeBar, barStyle]} />
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
        style={[styles.label, { color: active ? NAV_ACTIVE_LABEL : NAV_IDLE, fontFamily: active ? fontFamily.semibold : fontFamily.medium }]}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

type Props = {
  activeKey: string;
  onSelect: (key: string) => void;
  badgeCount?: number;
};

/**
 * App-wide bottom navigation: cyan active icon with a 16x3 cyan bar under it (no pill).
 */
export function BottomTabBar({ activeKey, onSelect, badgeCount }: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const press = (key: string) => {
    if (key === activeKey) return;
    haptic.selection();
    onSelect(key);
  };

  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.row}>
        {TABS.map((tab) => (
          <TabItem
            key={tab.key}
            tab={tab}
            active={tab.key === activeKey}
            badgeCount={tab.key === 'alerts' ? badgeCount : undefined}
            reduced={reduced}
            onPress={() => press(tab.key)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.bg,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingTop: 6,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 12,
  },
  row: { flexDirection: 'row', height: BAR_HEIGHT },
  activeBar: { backgroundColor: colors.mint, borderRadius: 2, height: 3, marginTop: -2, width: 16 },
  postDot: { backgroundColor: colors.amber, borderRadius: 3, height: 6, position: 'absolute', right: 14, top: 2, width: 6 },
  item: { alignItems: 'center', flex: 1, gap: 4, justifyContent: 'flex-start', paddingTop: 4 },
  iconWrap: { alignItems: 'center', height: PILL_HEIGHT, justifyContent: 'center', width: PILL_WIDTH },
  label: { fontSize: 11, letterSpacing: 0.1, marginTop: -1 },
  badge: {
    alignItems: 'center',
    backgroundColor: '#14324A',
    borderColor: colors.bg,
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 8,
    top: -2,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});
