import { Tabs } from "expo-router";
import { useTabNavigation } from "@/lib/navigation";

import { Animated, Easing } from "react-native";
import { BottomTabBar } from "@/components/home/BottomTabBar";
import { useMessagingUnread } from "@/hooks/use-messaging-unread";

// Symmetric fade + subtle scale for tab switches. Runs on the navigator's
// core Animated.Value (progress = -1/0/1 relative to the active index), so
// the entering screen grows 0.98→1 while the leaving screen shrinks 1→0.98
// as they crossfade. Keeps animation: "fade" so the progress value actually
// animates (hasAnimation gates at the navigator).
const fadeScaleInterpolator = ({ current: { progress } }: { current: { progress: Animated.Value } }) => ({
  sceneStyle: {
    opacity: progress.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 1, 0],
    }),
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [1.02, 1, 0.98],
        }),
      },
    ],
  },
});

function HomeTabBar() {
  const { activeKey, select } = useTabNavigation();
  const { count } = useMessagingUnread();
  // No tap lock: switching between mounted tabs is instant and idempotent, and
  // the old 400ms lock swallowed quick taps, which read as lag.
  return <BottomTabBar activeKey={activeKey} onSelect={select} badgeCount={count} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        animation: "fade",
        headerShown: false,
        // Tabs stay mounted once visited (no remount, no refetch, scroll kept).
        // Freezing the hidden ones stops them re-rendering on every cache or
        // store update in the background, which made switching feel heavy.
        freezeOnBlur: true,
        sceneStyleInterpolator: fadeScaleInterpolator,
        transitionSpec: {
          animation: "timing",
          config: { duration: 220, easing: Easing.out(Easing.ease) },
        },
      }}
      tabBar={() => <HomeTabBar />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="post" options={{ title: "Post" }} />
      <Tabs.Screen name="inbox" options={{ title: "Alerts" }} />
      <Tabs.Screen name="saved" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}