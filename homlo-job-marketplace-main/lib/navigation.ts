import { useRouter, usePathname } from "expo-router";

type Router = ReturnType<typeof useRouter>;

let lastPushTime = 0;
let lastPushTarget = "";

function resolveHref(target: any): string | null {
  if (typeof target === "string") return target;
  if (target && typeof target === "object" && typeof target.pathname === "string") {
    let resolved = target.pathname;
    if (target.params && typeof target.params === "object") {
      Object.entries(target.params).forEach(([k, v]) => {
        resolved = resolved.replace(`[${k}]`, String(v));
      });
    }
    return resolved;
  }
  return null;
}

/**
 * Goes back when the navigation stack has a previous screen, otherwise returns
 * to the app home. Without the fallback, `router.back()` (or a guard like
 * `router.canGoBack()`) can silently do nothing when a results screen was
 * reached via `replace` or opened without a backing entry in the stack.
 */
export function goBack(router: Router) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/" as never);
  }
}

export function useSafeRouter() {
  const router = useRouter();
  const pathname = usePathname();

  const safePush = (path: any) => {
    const now = Date.now();
    const targetString = resolveHref(path) ?? (typeof path === "string" ? path : JSON.stringify(path));

    // Prevent duplicate push if already on the target path
    if (targetString && targetString === pathname) {
      return;
    }

    // Prevent double-tap rapid pushes (within 500ms for same target, or 300ms for any push)
    if (now - lastPushTime < 300 || (targetString === lastPushTarget && now - lastPushTime < 600)) {
      return;
    }

    lastPushTime = now;
    lastPushTarget = targetString;
    router.push(path);
  };

  return { ...router, push: safePush };
}

/** The bottom bar's five tabs and the tab route each one opens. */
export const TAB_HREFS = {
  home: "/",
  search: "/explore",
  post: "/post",
  alerts: "/inbox",
  profile: "/profile",
} as const;
export type TabKey = keyof typeof TAB_HREFS;

/** Paths rendered by a screen inside app/(tabs) (so the tab navigator is focused). */
const TAB_PATHS = new Set(["/", "/explore", "/jobs", "/post", "/inbox", "/profile", "/saved"]);

/** Which bottom-bar tab a path belongs to (stack pages map to their section). */
export function tabKeyForPath(pathname: string): TabKey {
  if (pathname === "/explore" || pathname === "/jobs") return "search";
  if (pathname === "/post" || pathname.startsWith("/employer")) return "post";
  if (pathname.startsWith("/inbox") || pathname.startsWith("/conversations")) return "alerts";
  if (pathname.startsWith("/profile")) return "profile";
  return "home";
}

/**
 * How to reach a tab from `pathname`.
 * - Inside the tabs: `navigate` switches to the already-mounted tab screen.
 * - From a stack page above the tabs: `dismissTo` pops back to the existing
 *   tabs and selects the tab. `push` here used to stack a brand-new copy of
 *   the whole tab navigator, so every tab remounted (blank screen, refetch,
 *   lost scroll) and the stack grew with each switch.
 */
export function tabNavigationMethod(pathname: string): "navigate" | "dismissTo" {
  return isTabPath(pathname) ? "navigate" : "dismissTo";
}

/** True when `pathname` is one of the tab screens (the tab navigator is focused). */
export function isTabPath(pathname: string): boolean {
  return TAB_PATHS.has(pathname);
}

/** Bottom-bar handler shared by every screen that draws the tab bar. */
export function useTabNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const activeKey = tabKeyForPath(pathname);
  const select = (key: string) => {
    if (!(key in TAB_HREFS) || key === activeKey) return;
    const href = TAB_HREFS[key as TabKey] as never;
    if (tabNavigationMethod(pathname) === "navigate") router.navigate(href);
    else router.dismissTo(href);
  };
  return { activeKey, select };
}
