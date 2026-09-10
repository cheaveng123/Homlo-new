// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "magnifyingglass": "search",
  "heart": "favorite-border",
  "heart.fill": "favorite",
  "person": "person-outline",
  "person.fill": "person",
  "bell": "notifications-none",
  "location": "my-location",
  "mappin.and.ellipse": "location-on",
  "chevron.down": "keyboard-arrow-down",
  "chevron.left": "chevron-left",
  "paperplane.fill": "send",
  "slider.horizontal.3": "tune",
  "briefcase.fill": "business-center",
  "clock": "schedule",
  "calendar": "calendar-today",
  "graduationcap.fill": "school",
  "fork.knife": "restaurant",
  "bag": "shopping-bag",
  "ticket": "confirmation-number",
  "arrow.right": "arrow-forward",
  "paperclip": "attach-file",
  "star.fill": "star",
  "bookmark": "bookmark-border",
  "bookmark.fill": "bookmark",
  "checkmark.circle.fill": "check-circle",
  "gearshape": "settings",
  "questionmark.circle": "help-outline",
  "ellipsis": "more-horiz",
  "pencil": "edit",
  "plus": "add",
  "rocket.fill": "rocket-launch",
  "chart.line.uptrend.xyaxis": "trending-up",
  "creditcard.fill": "credit-card",
  "lock.fill": "lock",
  "rectangle.portrait.and.arrow.right": "logout",
  "building.2.fill": "business",
  "gift.fill": "card-giftcard",
  "circle": "radio-button-unchecked",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "map": "map",
  "map.fill": "map",
  "sun.max": "wb-sunny",
  "list.bullet": "view-list",
  "bookmarkcheck": "bookmark",
  "bookmarkcheck.fill": "bookmark",
  "filter": "filter-alt",
  "filter.fill": "filter-alt",
  "mappin": "location-on",
  "mappin.fill": "location-on",
  "xmark": "close",
  "xmark.circle.fill": "close",
  "briefcase": "work",
  "building.2": "business",
  "calendar.days": "event",
  "clock3": "schedule",
  "navigation": "navigation",
  "badge.check": "verified-user",
  "banknote": "attach-money",
  "send": "send",
  "share2": "share",
  "arrow.up.right": "open-in-new",
} as unknown as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const fallbackName: ComponentProps<typeof MaterialIcons>["name"] = "help-outline";
  return <MaterialIcons color={color} size={size} name={MAPPING[name] ?? fallbackName} style={style} />;
}
