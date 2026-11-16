import React, { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { useIsFocused } from "expo-router";
import { SchemeColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import AnimatedPlaceholder from "./AnimatedPlaceholder";
import { employerWords, jobSeekerWords } from "./searchPlaceholderWords";

type Props = {
  /** Controlled text. Omit for an uncontrolled input (onChangeText is then tracked internally). */
  value?: string;
  onChangeText?: (text: string) => void;
  /** 'seeker' searches jobs, 'employer' searches applicants. */
  role?: "seeker" | "employer";
  /** Fixed text before the rotating word. */
  prefix?: string;
  /** Overrides the theme placeholder color. */
  prefixColor?: string;
  /** Overrides the theme soft blue. */
  keywordColor?: string;
  /** Legacy keyword list. Ignored when `role` is set (defaults to seeker). */
  keywords?: string[];
  /** Overrides the screen-focus pause. */
  paused?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<TextStyle>;
  onFocus?: (e: unknown) => void;
  onBlur?: (e: unknown) => void;
  [key: string]: unknown;
};

export function AnimatedSearchBar(props: Props) {
  const {
    value,
    onChangeText,
    role = "seeker",
    prefix = "Search for",
    prefixColor,
    keywordColor,
    keywords,
    paused,
    containerStyle,
    style,
    onFocus,
    onBlur,
    ...rest
  } = props;

  const scheme = useColorScheme();
  const theme = SchemeColors[scheme === "dark" ? "dark" : "light"];
  const isScreenFocused = useIsFocused();

  const [focused, setFocused] = useState(false);
  const [innerText, setInnerText] = useState("");
  const text = value ?? innerText;

  const words = role === "employer" ? employerWords : jobSeekerWords;
  const label = role === "employer" ? "Search applicants" : "Search jobs";

  const handleChangeText = (next: string) => {
    setInnerText(next);
    onChangeText?.(next);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        {...rest}
        value={value}
        onChangeText={handleChangeText}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        accessibilityLabel={label}
        style={[styles.input, style]}
      />
      <AnimatedPlaceholder
        words={words}
        prefix={prefix}
        color={keywordColor ?? theme.softBlue}
        prefixColor={prefixColor ?? "#717171"}
        fontSize={16}
        visible={!focused && text.length === 0}
        paused={paused ?? !isScreenFocused}
      />
    </View>
  );
}

export default AnimatedSearchBar;

const styles = StyleSheet.create({
  container: { position: "relative", flexDirection: "row", alignItems: "center", flex: 1 },
  input: { flex: 1, padding: 0 },
});