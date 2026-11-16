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
