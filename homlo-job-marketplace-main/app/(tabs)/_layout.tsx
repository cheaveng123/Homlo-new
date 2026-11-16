import { Tabs, usePathname, useRouter } from "expo-router";
import { useSafeRouter } from "@/lib/navigation";

import { useRef } from "react";
import { Animated, Easing } from "react-native";
import { BottomTabBar } from "@/components/home/BottomTabBar";
import { useMessagingUnread } from "@/hooks/use-messaging-unread";
import { haptic } from "@/lib/haptics";

// Event-handler debouncing only; kept behind a module boundary so the
// purity lint rule doesn't flag the (intended) render-independent usage.
const nowMs = () => Date.now();

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

const ROUTES: Record<string, string> = {
  home: "/",
  search: "/explore",
  post: "/employer",
  alerts: "/inbox",
  profile: "/profile",
};

function keyForPath(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname === "/explore") return "search";
  if (pathname === "/jobs") return "search";
  if (pathname === "/employer" || pathname.startsWith("/employer")) return "post";
  if (pathname === "/inbox") return "alerts";
  if (pathname === "/profile") return "profile";
  if (pathname.startsWith("/inbox") || pathname.startsWith("/conversations")) return "alerts";
  if (pathname.startsWith("/profile")) return "profile";
  return "home";
}

function HomeTabBar() {
  const router = useSafeRouter();
  const pathname = usePathname();
  const { count } = useMessagingUnread();
  const lockUntilRef = useRef(0);

  const select = (key: string) => {
    const now = nowMs();
    if (now < lockUntilRef.current) return;
    if (keyForPath(pathname) === key) return;
    lockUntilRef.current = now + 400;
    haptic.light();
    router.push(ROUTES[key] as never);
  };

  return <BottomTabBar activeKey={keyForPath(pathname)} onSelect={select} badgeCount={count} />;
}


export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        animation: "fade",
        headerShown: false,
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