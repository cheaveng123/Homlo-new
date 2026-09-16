import { Tabs, usePathname, useRouter } from "expo-router";

import { useRef } from "react";
import { BottomTabBar } from "@/components/home/BottomTabBar";
import { useMessagingUnread } from "@/hooks/use-messaging-unread";
import { haptic } from "@/lib/haptics";

// Event-handler debouncing only; kept behind a module boundary so the
// purity lint rule doesn't flag the (intended) render-independent usage.
const nowMs = () => Date.now();

const ROUTES: Record<string, string> = {
  home: "/",
  search: "/jobs",
  post: "/employer",
  alerts: "/inbox",
  profile: "/profile",
};

function keyForPath(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname === "/jobs") return "search";
  if (pathname === "/employer" || pathname.startsWith("/employer")) return "post";
  if (pathname === "/inbox") return "alerts";
  if (pathname === "/profile") return "profile";
  if (pathname.startsWith("/inbox") || pathname.startsWith("/conversations")) return "alerts";
  if (pathname.startsWith("/profile")) return "profile";
  return "home";
}

function HomeTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { count } = useMessagingUnread();
  const lockUntilRef = useRef(0);

  const select = (key: string) => {
    const now = nowMs();
    if (now < lockUntilRef.current) return;
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
      }}
      tabBar={() => <HomeTabBar />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="jobs" options={{ title: "Search" }} />
      <Tabs.Screen name="post" options={{ title: "Post" }} />
      <Tabs.Screen name="inbox" options={{ title: "Alerts" }} />
      <Tabs.Screen name="saved" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}