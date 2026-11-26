import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname, useRouter } from "@/lib/router";
import { AppNavigationContainer, RootStack } from "@/lib/router/navigators";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import TabLayout from "./(tabs)/_layout";

import BootSplash from "react-native-bootsplash";
import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, StatusBar } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { JobProvider } from "@/components/job-store";
import { ONBOARDING_COMPLETE_KEY } from "@/lib/onboarding";
import { getLocalValue, getLocalValueSync } from "@/lib/local-persistence";
import { useAuth } from "@/hooks/use-auth";
import { initPurchases } from "@/lib/purchases";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient, setQueryClientInstance } from "@/lib/trpc";
import { setupQueryPersistence } from "@/lib/query-persistence";
import { clearFeedClientCache } from "@/lib/feed-client";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { ErrorBoundary } from "@/components/error-boundary";
import { LocationProvider } from "@/src/context/LocationContext";
import { WebLegalChrome } from "@/components/legal/WebLegalChrome";
import { BrandLoadingScreen } from "@/components/BrandLoadingScreen";

/** Native-stack options for every screen, then per screen (keyed by its app/ path). */
const ROOT_SCREEN_OPTIONS: NativeStackNavigationOptions = { animation: "slide_from_right", animationDuration: 220, fullScreenGestureEnabled: false, gestureEnabled: true, gestureDirection: "horizontal", headerShown: false };

const SCREEN_OPTIONS: Record<string, NativeStackNavigationOptions> = {
  "(tabs)": { animation: "fade", animationDuration: 160 },
  "onboarding/index": { animation: "fade", animationDuration: 220, gestureEnabled: false },
  "search-results": { animation: "slide_from_right", animationDuration: 220 },
  "detailed-search": { animation: "slide_from_right", animationDuration: 240 },
  "discover/[kind]": { animation: "slide_from_right", animationDuration: 240 },
  "job/[id]": { animation: "slide_from_right", animationDuration: 220 },
  "job/[id]/apply": { animation: "slide_from_right", animationDuration: 220, presentation: "fullScreenModal" },
  "employer/index": { animation: "slide_from_right", animationDuration: 220 },
  "employer/listings": { animation: "slide_from_right", animationDuration: 220 },
  "employer/post-job": { animation: "slide_from_right", animationDuration: 240 },
  "post-job": { animation: "slide_from_right", animationDuration: 240 },
  "employer/jobs": { animation: "slide_from_right", animationDuration: 220 },
  "employer/boost/[id]": { animation: "slide_from_right", animationDuration: 240 },
  "oauth/callback": { animation: "fade", animationDuration: 160 },
  "login": { animation: "fade", animationDuration: 180 },
  "age": { animation: "slide_from_right", animationDuration: 220, gestureEnabled: false },
  "complete-profile": { animation: "slide_from_right", animationDuration: 220, gestureEnabled: false },
  "account-plans": { animation: "slide_from_right", animationDuration: 220 },
  "checkout": { animation: "slide_from_right", animationDuration: 220 },
  "employer/enterprise-campaign": { animation: "slide_from_right", animationDuration: 220 },
  "applications/[id]": { animation: "slide_from_right", animationDuration: 220 },
  "applications/index": { animation: "slide_from_right", animationDuration: 220 },
  "terms": { animation: "slide_from_right", animationDuration: 220 },
  "privacy": { animation: "slide_from_right", animationDuration: 220 },
  "appeal": { animation: "slide_from_right", animationDuration: 220 },
  "account/verify": { animation: "slide_from_right", animationDuration: 220 },
  "account/settings": { animation: "slide_from_right", animationDuration: 220 },
  "admin/index": { animation: "slide_from_right", animationDuration: 220 },
};

/** Pages anyone can open at any time (legal text, appeals), even mid-sign-up. */
const ALWAYS_OPEN_PATHS = new Set(["/terms", "/privacy", "/appeal"]);

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };


/**
 * Resolves the initial route once the persisted onboarding flag is known.
 * The decision is cached and never re-derived from pathname changes, so a
 * signed-out user inside an already-onboarded device will land on /login
 * (not /onboarding).
 */
type GateStatus = "loading" | "needs-onboarding" | "ready";

function LaunchGate({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<GateStatus>(() => {
    if (Platform.OS === "web") {
      return getLocalValueSync(ONBOARDING_COMPLETE_KEY) === "true" ? "ready" : "needs-onboarding";
    }
    return "loading";
  });

  useEffect(() => {
    if (status !== "loading") return;

    let cancelled = false;

    getLocalValue(ONBOARDING_COMPLETE_KEY)
      .then((value) => {
        if (cancelled) return;
        if (value === "true") {
          setStatus("ready");
        } else {
          setStatus("needs-onboarding");
          router.replace("/onboarding" as never);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("needs-onboarding");
        router.replace("/onboarding" as never);
      });
    return () => { cancelled = true; };
  }, [router, status]);

  useEffect(() => {
    if (status !== "ready") return;
    if (authLoading) return;
    if (!user) {
      if (pathname === "/login" || pathname === "/complete-profile") return;
      return;
    }
    if (ALWAYS_OPEN_PATHS.has(pathname)) return;
    if (!user.profileComplete) {
      // New accounts go age → complete-profile; complete-profile itself sends
      // anyone without a recorded age back to /age.
      if (pathname !== "/complete-profile" && pathname !== "/age") router.replace("/complete-profile" as never);
      return;
    }
    if (pathname === "/login" || pathname === "/complete-profile" || pathname === "/age") {
      router.replace("/" as never);
    }
  }, [authLoading, pathname, router, status, user]);

  // Blank the tree only while the onboarding gate itself is unresolved. A
  // mid-session auth refetch (60s TTL) sets `loading` inside useAuth too; if we
  // blanked on it here, any navigation overlapping that window would flash a
  // white/blank screen and the navigator remounts, dumping the user back toward
  // the initial route. Screens handle their own `loading` states instead.
  if (status === "loading") {
    return <BrandLoadingScreen />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);
  const [brandDelayElapsed, setBrandDelayElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBrandDelayElapsed(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  // Configure RevenueCat once at startup. Missing keys are logged and leave the
  // paywall in its empty state rather than crashing app launch.
  useEffect(() => {
    void initPurchases();
  }, []);

  // Fonts ship inside the app binary now, so the native splash can hand over
  // to the branded loading screen as soon as React has mounted.
  useEffect(() => {
    void BootSplash.hide({ fade: true });
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(() => {
    const client = new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Don't refetch just because the network reconnects; keep showing
            // cached data until the query goes stale.
            refetchOnReconnect: false,
            // PERF: retry network/5xx failures once, but never 4xx (401, 404,
            // 429 rate-limited). Retrying a 429 only digs the hole deeper and
            // kept spinners on screen for the whole backoff.
            retry: (failureCount, error) => {
              const status = (error as { data?: { httpStatus?: number } } | null)?.data?.httpStatus;
              if (typeof status === "number" && status >= 400 && status < 500) return false;
              return failureCount < 1;
            },
            // Serve cached data on remount and re-validate in the background.
            // 30s keeps tabs "live-ish" while stopping a network call every
            // time a screen mounts (the pre-fix behavior).
            staleTime: 30_000,
            // Hold data for 30 minutes after a query leaves the screen so a
            // revisit renders instantly from cache (stale-while-revalidate:
            // stale data paints first, a background refetch replaces it).
            // Was 5 minutes, after which screens fell back to a skeleton.
            gcTime: 30 * 60_000,
          },
        },
      });
    // PERF: the full public job list is read by ~10 screens (Home, Explore,
    // Near you, Popular, Recommended, Vista, Search…). One shared 60s cache
    // stops each screen mount from refetching it; writes (post/edit/apply/
    // boost) already call publicJobs.invalidate() so changes still show at once.
    client.setQueryDefaults([["homlo", "publicJobs"]], { staleTime: 60_000, gcTime: 60 * 60_000 });
    // The ranked feeds (Home, Popular) share the publicJobs freshness window.
    client.setQueryDefaults([["homlo", "homeFeed"]], { staleTime: 60_000, gcTime: 60 * 60_000 });
    // Categories barely ever change.
    client.setQueryDefaults([["homlo", "categories"]], { staleTime: 30 * 60_000, gcTime: 60 * 60_000 });
    // Post/edit/apply/boost screens call publicJobs.invalidate(); drop the
    // feed client's reused pages at the same moment so Home shows the change.
    client.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "invalidate") return;
      const key = event.query.queryKey[0];
      if (Array.isArray(key) && key[0] === "homlo" && (key[1] === "publicJobs" || key[1] === "homeFeed")) {
        clearFeedClientCache();
        // Job detail reads one job (homlo.publicJob); keep it as fresh as the list.
        if (key[1] === "publicJobs") void client.invalidateQueries({ queryKey: [["homlo", "publicJob"]] });
      }
    });
    // PERF: cold starts paint public data from the last session, then refresh.
    setupQueryPersistence(client);
    return client;
  });
  const [trpcClient] = useState(() => createTRPCClient());

  useEffect(() => {
    setQueryClientInstance(queryClient);
  }, [queryClient]);

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  if (Platform.OS !== "web" && !brandDelayElapsed) return <BrandLoadingScreen />;

  const content = (
    <ErrorBoundary>
    <LocationProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <JobProvider>
          <AppNavigationContainer>
          <LaunchGate>
          {/* Native headers are hidden by default (ROOT_SCREEN_OPTIONS); a screen that needs one enables it via <Stack.Screen options>. */}
          <RootStack screenOptions={ROOT_SCREEN_OPTIONS} options={SCREEN_OPTIONS} tabs={TabLayout} />
          <WebLegalChrome />
          </LaunchGate>
          </AppNavigationContainer>
          </JobProvider>
          <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
    </LocationProvider>
    </ErrorBoundary>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
