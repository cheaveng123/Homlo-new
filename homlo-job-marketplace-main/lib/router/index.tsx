/**
 * A small router on top of React Navigation that keeps the path-based API the
 * app was written against (it used expo-router before):
 *
 *   router.push("/job/123")            router.replace({ pathname: "/job/[id]", params: { id } })
 *   const { id } = useLocalSearchParams<{ id: string }>()
 *   const pathname = usePathname()
 *
 * Every screen is a file in app/; scripts/gen-routes.mjs lists them in
 * routes.generated.ts. Screens outside app/(tabs) live in one root native
 * stack (named by their file path, e.g. "job/[id]"); the tab screens live in a
 * bottom-tab navigator registered on that stack as "(tabs)".
 */
import {
  CommonActions,
  StackActions,
  createNavigationContainerRef,
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
  type NavigationState,
  type PartialState,
} from "@react-navigation/native";
import { useLayoutEffect, useEffect, useSyncExternalStore } from "react";

import { ROUTES, type RouteDef } from "./routes.generated";

export { useFocusEffect, useIsFocused };
export { ROUTES };

export const TABS_ROUTE = "(tabs)";

type ParamValue = string | string[];
export type SearchParams = Record<string, ParamValue | undefined>;
export type Href = string | { pathname: string; params?: Record<string, unknown> };

export const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();

// ---------------------------------------------------------------------------
// Path matching

type Matcher = { route: RouteDef; segments: string[]; score: number };

const MATCHERS: Matcher[] = ROUTES.map((route) => {
  const segments = route.pattern.split("/").filter(Boolean);
  // Static segments beat dynamic ones ("/employer/jobs" before "/employer/[employerId]").
  const score = segments.reduce((sum, s) => sum + (s.startsWith("[") ? 1 : 2), 0);
  return { route, segments, score };
}).sort((a, b) => b.segments.length - a.segments.length || b.score - a.score);

function toParamValue(value: unknown): ParamValue | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.map((v) => String(v));
  return String(value);
}

function parseQuery(query: string): SearchParams {
  const out: SearchParams = {};
  for (const part of query.split("&")) {
    if (!part) continue;
    const [rawKey, rawValue = ""] = part.split("=");
    const key = decodeURIComponent(rawKey.replace(/\+/g, " "));
    const value = decodeURIComponent(rawValue.replace(/\+/g, " "));
    const prev = out[key];
    out[key] = prev === undefined ? value : Array.isArray(prev) ? [...prev, value] : [prev, value];
  }
  return out;
}

export type Target = { route: RouteDef; params: SearchParams };

/** Turns "/job/12?tab=info" or { pathname, params } into a screen + params. */
export function resolveHref(href: Href): Target | null {
  let pathname: string;
  let params: SearchParams = {};
  if (typeof href === "string") {
    const [beforeHash] = href.split("#");
    const q = beforeHash.indexOf("?");
    pathname = q >= 0 ? beforeHash.slice(0, q) : beforeHash;
    if (q >= 0) params = parseQuery(beforeHash.slice(q + 1));
  } else {
    pathname = href.pathname;
    for (const [k, v] of Object.entries(href.params ?? {})) params[k] = toParamValue(v);
  }
  // "(tabs)" style group segments are not part of the URL.
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .filter((s) => !/^\(.*\)$/.test(s))
    .map((s) => decodeURIComponent(s));

  // A { pathname: "/job/[id]", params: { id } } href fills the brackets from params.
  const filled = segments.map((s) => {
    const m = /^\[(.+)\]$/.exec(s);
    const v = m ? params[m[1]] : undefined;
    return m && typeof v === "string" ? v : s;
  });

  for (const matcher of MATCHERS) {
    if (matcher.segments.length !== filled.length) continue;
    const pathParams: SearchParams = {};
    let ok = true;
    for (let i = 0; i < filled.length; i++) {
      const pattern = matcher.segments[i];
      const dyn = /^\[(.+)\]$/.exec(pattern);
      if (dyn) pathParams[dyn[1]] = filled[i];
      else if (pattern !== filled[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route: matcher.route, params: { ...params, ...pathParams } };
  }
  return null;
}

function stripUndefined(params: SearchParams): SearchParams | undefined {
  const out: SearchParams = {};
  let any = false;
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) {
      out[k] = v;
      any = true;
    }
  }
  return any ? out : undefined;
}

/** Builds "/job/12?tab=info" back from a screen and its params. */
export function pathFor(route: RouteDef, params: SearchParams | undefined): string {
  const path = route.pattern.replace(/\[([^\]]+)\]/g, (_, key: string) => {
    const v = params?.[key];
    return encodeURIComponent(Array.isArray(v) ? v[0] : (v ?? ""));
  });
  return path || "/";
}

function routeByName(name: string, inTabs: boolean): RouteDef | undefined {
  return ROUTES.find((r) => r.name === name && r.inTabs === inTabs);
}

// ---------------------------------------------------------------------------
// Current location (for usePathname / useGlobalSearchParams)

type Location = { pathname: string; params: SearchParams };
let current: Location = { pathname: "/", params: {} };
const listeners = new Set<() => void>();

function focusedLocation(state: NavigationState | PartialState<NavigationState> | undefined): Location | null {
  if (!state || !state.routes?.length) return null;
  const top = state.routes[state.index ?? state.routes.length - 1];
  if (top.name === TABS_ROUTE) {
    const tabState = top.state as NavigationState | undefined;
    const tab = tabState?.routes?.[tabState.index ?? 0];
    const def = routeByName(tab?.name ?? "index", true);
    const params = (tab?.params ?? {}) as SearchParams;
    return def ? { pathname: pathFor(def, params), params } : null;
  }
  const def = routeByName(top.name, false);
  const params = (top.params ?? {}) as SearchParams;
  return def ? { pathname: pathFor(def, params), params } : null;
}

/** Called by the NavigationContainer on every state change. */
export function updateLocationFromState(state: NavigationState | undefined) {
  const next = focusedLocation(state);
  if (!next || (next.pathname === current.pathname && next.params === current.params)) return;
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Navigation actions

const pending: (() => void)[] = [];

/** Runs `action` now, or once the navigator has mounted (e.g. a redirect during launch). */
function whenReady(action: () => void) {
  if (navigationRef.isReady()) action();
  else pending.push(action);
}

/** Called by the NavigationContainer's onReady. */
export function flushPendingNavigation() {
  while (pending.length && navigationRef.isReady()) pending.shift()!();
}

function warnUnknown(href: Href) {
  if (__DEV__) console.warn(`[router] No screen matches ${JSON.stringify(href)}`);
}

/** The root-stack route (name + params) for a target. Tab screens go through "(tabs)". */
function stackRouteFor(target: Target): { name: string; params: object | undefined } {
  const params = stripUndefined(target.params);
  if (target.route.inTabs) return { name: TABS_ROUTE, params: { screen: target.route.name, params } };
  return { name: target.route.name, params };
}

function rootState() {
  return navigationRef.getRootState() as NavigationState | undefined;
}

function push(href: Href) {
  const target = resolveHref(href);
  if (!target) return warnUnknown(href);
  whenReady(() => {
    // Tabs are mounted once; opening one again just switches back to it.
    if (target.route.inTabs) return dismissToTarget(target);
    const { name, params } = stackRouteFor(target);
    navigationRef.dispatch(StackActions.push(name, params));
  });
}

function replace(href: Href) {
  const target = resolveHref(href);
  if (!target) return warnUnknown(href);
  whenReady(() => {
    const { name, params } = stackRouteFor(target);
    const state = rootState();
    // Replacing with the tabs when they are already lower in the stack would
    // stack a second tab navigator; go back to the existing one instead.
    if (target.route.inTabs && state?.routes.some((r) => r.name === TABS_ROUTE)) {
      return dismissToTarget(target);
    }
    if (!state || state.routes.length === 0) {
      navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name, params }] }));
    } else {
      navigationRef.dispatch(StackActions.replace(name, params));
    }
  });
}

function dismissToTarget(target: Target) {
  const state = rootState();
  const { name, params } = stackRouteFor(target);
  const existing = state ? [...state.routes].reverse().find((r) => r.name === name) : undefined;
  if (!existing) {
    if (state && state.routes.length > 0) navigationRef.dispatch(StackActions.replace(name, params));
    else navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name, params }] }));
    return;
  }
  const top = state!.routes[state!.index];
  if (top.key !== existing.key) navigationRef.dispatch(StackActions.popTo(name, target.route.inTabs ? undefined : params));
  if (target.route.inTabs) {
    const tabKey = (existing.state as NavigationState | undefined)?.key;
    const tabParams = stripUndefined(target.params);
    if (tabKey) {
      navigationRef.dispatch({ ...CommonActions.navigate({ name: target.route.name, params: tabParams }), target: tabKey });
    } else {
      navigationRef.dispatch(CommonActions.navigate({ name: TABS_ROUTE, params: { screen: target.route.name, params: tabParams } }));
    }
  }
}

function dismissTo(href: Href) {
  const target = resolveHref(href);
  if (!target) return warnUnknown(href);
  whenReady(() => dismissToTarget(target));
}

function navigate(href: Href) {
  const target = resolveHref(href);
  if (!target) return warnUnknown(href);
  whenReady(() => {
    if (target.route.inTabs) return dismissToTarget(target);
    navigationRef.dispatch(CommonActions.navigate({ name: target.route.name, params: stripUndefined(target.params) }));
  });
}

/** True when there is a screen above the first one in the root stack. */
function canDismiss() {
  const state = navigationRef.isReady() ? rootState() : undefined;
  return !!state && state.index > 0;
}

function canGoBack() {
  return navigationRef.isReady() && navigationRef.canGoBack();
}

function back() {
  if (canGoBack()) navigationRef.goBack();
}

function dismissAll() {
  whenReady(() => {
    const state = rootState();
    if (state && state.index > 0) navigationRef.dispatch(StackActions.popToTop());
  });
}

function setParams(params: Record<string, unknown>) {
  const out: SearchParams = {};
  for (const [k, v] of Object.entries(params)) out[k] = toParamValue(v);
  whenReady(() => navigationRef.dispatch(CommonActions.setParams(out)));
}

export const router = {
  push,
  replace,
  navigate,
  back,
  canGoBack,
  canDismiss,
  dismissTo,
  dismissAll,
  setParams,
};
export type Router = typeof router;
export type ImperativeRouter = Router;

// ---------------------------------------------------------------------------
// Hooks and components

export function useRouter(): Router {
  return router;
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => current.pathname, () => current.pathname);
}

// Typed like expo-router's: callers pass the param shape they expect.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useGlobalSearchParams<T extends Record<string, any> = Record<string, string | string[]>>(): T {
  return useSyncExternalStore(subscribe, () => current.params, () => current.params) as T;
}

/** The params of the screen this component is rendered in (all values are strings). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useLocalSearchParams<T extends Record<string, any> = Record<string, string | string[]>>(): T {
  const route = useRoute();
  return (route.params ?? EMPTY_PARAMS) as T;
}
const EMPTY_PARAMS = {};

/** Sends the user to `href` as soon as it renders. */
export function Redirect({ href }: { href: Href }) {
  useEffect(() => {
    replace(href);
  }, [href]);
  return null;
}

/** Sets options on the screen it is rendered in (e.g. disable the back swipe). */
function StackScreen({ options }: { options?: Record<string, unknown> }) {
  const navigation = useNavigation();
  // Callers pass inline objects; only re-apply when the values change, so a
  // re-render never triggers another setOptions round trip.
  const key = options ? JSON.stringify(options) : "";
  useLayoutEffect(() => {
    if (key) navigation.setOptions(JSON.parse(key));
  }, [navigation, key]);
  return null;
}

export const Stack = { Screen: StackScreen };
