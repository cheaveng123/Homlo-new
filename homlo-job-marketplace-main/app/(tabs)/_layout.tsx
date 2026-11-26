import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ROUTES } from "@/lib/router";
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

const TabsNav = createBottomTabNavigator();

// Same order the tabs were declared in before; any other tab file follows.
const TAB_ORDER = ["index", "explore", "post", "inbox", "saved", "profile"];
const TAB_TITLES: Record<string, string> = {
  index: "Home",
  explore: "Explore",
  post: "Post",
  inbox: "Alerts",
  profile: "Profile",
};
const TAB_ROUTES = ROUTES.filter((r) => r.inTabs).sort((a, b) => {
  const ia = TAB_ORDER.indexOf(a.name);
  const ib = TAB_ORDER.indexOf(b.name);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});

export default function TabLayout() {
  return (
    <TabsNav.Navigator
      initialRouteName="index"
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
      {TAB_ROUTES.map((r) => (
        <TabsNav.Screen key={r.name} name={r.name} getComponent={r.getComponent} options={{ title: TAB_TITLES[r.name] }} />
      ))}
    </TabsNav.Navigator>
  );
}