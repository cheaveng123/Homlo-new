/** Status bar with expo-status-bar's `style` prop ("dark" | "light" | "auto"). */
import { StatusBar as RNStatusBar, type StatusBarProps as RNStatusBarProps } from "react-native";

export type StatusBarStyle = "auto" | "dark" | "light" | "inverted";

// The app UI is light-only, so "auto" means dark icons and "inverted" light ones.
function barStyle(style: StatusBarStyle | undefined): RNStatusBarProps["barStyle"] {
  return style === "light" || style === "inverted" ? "light-content" : "dark-content";
}

type Props = Omit<RNStatusBarProps, "barStyle"> & { style?: StatusBarStyle };

export function StatusBar({ style, translucent = true, backgroundColor = "transparent", ...rest }: Props) {
  return <RNStatusBar barStyle={barStyle(style)} translucent={translucent} backgroundColor={backgroundColor} {...rest} />;
}

export function setStatusBarStyle(style: StatusBarStyle, animated = true) {
  RNStatusBar.setBarStyle(barStyle(style)!, animated);
}
