import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { Home, Search, Plus, Bell, User, LucideIcon } from 'lucide-react-native';
import { colors, fontFamily } from './theme';

type Tab = { key: string; label: string; Icon: LucideIcon };

const TABS: Tab[] = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'search', label: 'Search', Icon: Search },
  { key: 'post', label: 'Post', Icon: Plus },
  { key: 'alerts', label: 'Alerts', Icon: Bell },
  { key: 'profile', label: 'Profile', Icon: User },
];

function TabItem({ tab, active, badgeCount, onPress }: { tab: Tab; active: boolean; badgeCount?: number; onPress: () => void }) {
  const progress = useSharedValue(active ? 1 : 0);
  progress.value = withTiming(active ? 1 : 0, { duration: 200 });

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['transparent', colors.mintTint]),
    transform: [
      { translateY: withSpring(active ? -2 : 0, { damping: 12, stiffness: 180 }) },
      { scale: withSpring(active ? 1.05 : 1, { damping: 12, stiffness: 180 }) },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 1,
  }));

  const iconColor = active ? colors.mint : colors.textPrimary;
  const { Icon, label } = tab;

  return (
    <Pressable onPress={onPress} className="flex-1 items-center gap-0.5">
      <Animated.View style={[pillStyle, { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 }]}>
        <Icon size={19} color={iconColor} />
        {tab.key === 'alerts' && badgeCount ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
          </View>
        ) : null}
      </Animated.View>
      <Animated.Text
        style={[labelStyle, { fontFamily: fontFamily.medium, color: iconColor }]}
        className="text-[10px]"
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

type Props = {
  activeKey: string;
  onSelect: (key: string) => void;
  badgeCount?: number;
};

export function BottomTabBar({ activeKey, onSelect, badgeCount }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ borderTopColor: colors.divider, paddingBottom: Math.max(insets.bottom, 6) }}
      className="flex-row justify-between border-t pt-2.5 px-2"
    >
      {TABS.map((tab) => (
        <TabItem
          key={tab.key}
          tab={tab}
          active={tab.key === activeKey}
          badgeCount={tab.key === 'alerts' ? badgeCount : undefined}
          onPress={() => onSelect(tab.key)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: '#16803C',
    borderColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 1.5,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -4,
    top: -4,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});