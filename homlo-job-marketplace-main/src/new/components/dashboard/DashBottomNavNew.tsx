import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextNew } from '../TextNew';
import { BellGlyph, HomeGlyph, PlusGlyph, SearchGlyph, UserGlyph } from '@/src/components/icons/DashIcons';
import { haptic } from '@/lib/haptics';
import { dash, easeOut, NAV_BASE_H } from './dashTokens';

type Glyph = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const TABS: { key: string; label: string; Icon: Glyph }[] = [
  { key: 'home', label: 'Home', Icon: HomeGlyph },
  { key: 'search', label: 'Search', Icon: SearchGlyph },
  { key: 'post', label: 'Post', Icon: PlusGlyph },
  { key: 'alerts', label: 'Alerts', Icon: BellGlyph },
  { key: 'profile', label: 'Profile', Icon: UserGlyph },
];

/** Total height of the nav for a given bottom inset (84 on devices without a home indicator). */
export const dashNavHeight = (bottomInset: number) => NAV_BASE_H + Math.max(bottomInset, 20);

function NavItem({ tab, active, badgeCount, onPress }: { tab: (typeof TABS)[number]; active: boolean; badgeCount?: number; onPress: () => void }) {
  const reduced = useReducedMotion();
  const bar = useSharedValue(active ? (reduced ? 1 : 0.3) : 0);
  const spin = useSharedValue(0);
  useEffect(() => {
    bar.value = active ? (reduced ? 1 : withTiming(1, { duration: 250, easing: easeOut })) : 0;
  }, [active, reduced, bar]);
  const barStyle = useAnimatedStyle(() => ({ opacity: bar.value > 0 ? 1 : 0, transform: [{ scaleX: bar.value }] }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const isPost = tab.key === 'post';
  const color = active ? dash.cyan : dash.navIcon;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={badgeCount ? `${tab.label}, ${badgeCount} unread` : tab.label}
      onPress={onPress}
      onPressIn={() => { if (isPost && !reduced) spin.set(withSpring(90, { damping: 14, stiffness: 180 })); }}
      onPressOut={() => { if (isPost && !reduced) spin.set(withSpring(0, { damping: 14, stiffness: 180 })); }}
      style={s.item}
      hitSlop={4}
    >
      <View style={s.iconBox}>
        <Animated.View style={isPost ? spinStyle : undefined}>
          <tab.Icon size={24} color={color} strokeWidth={isPost ? 2.2 : 1.8} />
        </Animated.View>
        {isPost && active ? <View style={s.postDot} /> : null}
        {badgeCount ? (
          <View style={s.badge}>
            <TextNew variant="caption" heading weight="bold" color="#fff" style={s.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</TextNew>
          </View>
        ) : null}
      </View>
      <Animated.View style={[s.bar, barStyle]} />
      <TextNew
        variant="caption"
        weight={active ? 'semibold' : 'medium'}
        color={active ? dash.cyanDeep : dash.navIcon}
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
        style={s.label}
      >
        {tab.label}
      </TextNew>
    </Pressable>
  );
}

export function DashBottomNavNew({ activeKey, onSelect, badgeCount }: { activeKey: string; onSelect: (key: string) => void; badgeCount?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[s.nav, { height: dashNavHeight(insets.bottom), paddingBottom: Math.max(insets.bottom, 20) }]}>
      {TABS.map((t) => (
        <NavItem
          key={t.key}
          tab={t}
          active={t.key === activeKey}
          badgeCount={t.key === 'alerts' ? badgeCount : undefined}
          onPress={() => {
            if (t.key === activeKey) return;
            haptic.selection();
            onSelect(t.key);
          }}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  nav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    elevation: 12,
    backgroundColor: dash.surface,
    flexDirection: 'row',
    paddingTop: 10,
    shadowColor: '#0B3A48',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
  },
  item: { flex: 1, alignItems: 'center' },
  iconBox: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  postDot: { position: 'absolute', top: 0, right: -1, width: 6, height: 6, borderRadius: 3, backgroundColor: dash.amber },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: dash.navy,
    borderWidth: 2,
    borderColor: dash.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, lineHeight: 12 },
  bar: { width: 16, height: 3, borderRadius: 2, marginTop: 2, backgroundColor: dash.cyan },
  label: { marginTop: 3, fontSize: 12, lineHeight: 15 },
});
