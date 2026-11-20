// components/auth/AuthWash.tsx
// The soft header wash shared by the auth screens: Homlo cyan fading into
// white, with a faint amber glow in the top-right corner.
import { StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

const WASH = "#DCF1F6";
const AMBER_WASH = "#FDF0D9";

export default function AuthWash({ width, height }: { width: number; height: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
      <Defs>
        <LinearGradient id="authWash" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={WASH} stopOpacity="1" />
          <Stop offset="0.55" stopColor={WASH} stopOpacity="0.45" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
        <RadialGradient
          id="authGlow"
          cx={width}
          cy={0}
          rx={width * 0.85}
          ry={height * 0.75}
          fx={width}
          fy={0}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={AMBER_WASH} stopOpacity="1" />
          <Stop offset="1" stopColor={AMBER_WASH} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#authWash)" />
      <Rect x="0" y="0" width={width} height={height} fill="url(#authGlow)" />
    </Svg>
  );
}
