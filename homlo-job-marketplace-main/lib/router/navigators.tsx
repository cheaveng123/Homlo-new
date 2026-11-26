/**
 * The navigators behind lib/router: one root native stack holding every
 * screen in app/ (except the tab screens), plus "(tabs)", a bottom-tab
 * navigator built by app/(tabs)/_layout.tsx.
 */
import {
  NavigationContainer,
  type LinkingOptions,
  type NavigationState,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from "@react-navigation/native-stack";
import type { ComponentType, ReactNode } from "react";

import { DEEP_LINK_SCHEME } from "@/constants/deep-link";
import {
  ROUTES,
  TABS_ROUTE,
  flushPendingNavigation,
  navigationRef,
  pathFor,
  resolveHref,
  updateLocationFromState,
  type SearchParams,
} from "./index";

const RootStackNav = createNativeStackNavigator();

const linking: LinkingOptions<Record<string, object | undefined>> = {
  prefixes: [`${DEEP_LINK_SCHEME}://`],
  // Deep links use the same paths as router.push, e.g.
  // manushomlojobmarketplace://oauth/callback?code=...
  getStateFromPath(path) {
    const target = resolveHref(path.startsWith("/") ? path : `/${path}`);
    if (!target) return undefined;
    const params = target.params as object;
    if (target.route.inTabs) {
      return { routes: [{ name: TABS_ROUTE, state: { routes: [{ name: target.route.name, params }] } }] };
    }
    return { routes: [{ name: TABS_ROUTE }, { name: target.route.name, params }], index: 1 };
  },
  getPathFromState(state) {
    let route = state.routes[state.index ?? state.routes.length - 1];
    let inTabs = false;
    if (route.name === TABS_ROUTE && route.state) {
      route = route.state.routes[route.state.index ?? 0] as typeof route;
      inTabs = true;
    }
    const def = ROUTES.find((r) => r.name === route.name && r.inTabs === inTabs);
    return def ? pathFor(def, route.params as SearchParams) : "/";
  },
};

export function AppNavigationContainer({ children }: { children: ReactNode }) {
  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={() => {
        updateLocationFromState(navigationRef.getRootState() as NavigationState);
        flushPendingNavigation();
      }}
      onStateChange={(state) => updateLocationFromState(state as NavigationState | undefined)}
    >
      {children}
    </NavigationContainer>
  );
}

type RootStackProps = {
  screenOptions: NativeStackNavigationOptions;
  /** Per-screen options, keyed by screen name ("job/[id]", "(tabs)", ...). */
  options: Record<string, NativeStackNavigationOptions>;
  tabs: ComponentType;
};

const STACK_ROUTES = ROUTES.filter((r) => !r.inTabs);

export function RootStack({ screenOptions, options, tabs }: RootStackProps) {
  return (
    <RootStackNav.Navigator initialRouteName={TABS_ROUTE} screenOptions={screenOptions}>
      <RootStackNav.Screen name={TABS_ROUTE} component={tabs} options={options[TABS_ROUTE]} />
      {STACK_ROUTES.map((r) => (
        <RootStackNav.Screen key={r.name} name={r.name} getComponent={r.getComponent} options={options[r.name]} />
      ))}
    </RootStackNav.Navigator>
  );
}
