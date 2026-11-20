// NativeWind + Pressable: className can swallow onPress. Disable className mapping globally.
import { Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cssInterop, remapProps } from "nativewind";

remapProps(Pressable, { className: false });

// BUGFIX: third-party components ignore `className` unless registered. The
// safe-area SafeAreaView (used by ScreenContainer and others) never got
// `flex-1`, so it shrank and its centred content was pushed off-screen —
// e.g. the signed-out Profile showed only a "Sign in" button.
cssInterop(SafeAreaView, { className: "style" });
