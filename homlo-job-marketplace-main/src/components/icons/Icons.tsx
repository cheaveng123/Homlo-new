import React from "react";
import Svg, { Path, PathProps } from "react-native-svg";
import type { StyleProp, ViewStyle } from "react-native";

type IconProps = {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

const SUITCASE_PATH = "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 2v12l-3-3H7l-3 3V6c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2m-9 0h4v2h-4z";

export function SuitcaseIcon({ size = 24, color = "#0E7C86", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path d={SUITCASE_PATH} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
