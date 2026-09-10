import { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

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
