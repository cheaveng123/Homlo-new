// components/onboarding/AllSetArt.tsx
// Illustration for the last onboarding step, drawn for a cyan background in
// the same flat style as WelcomeScene: a job card with a check badge, a map
// pin and a briefcase, on a soft disc. Static SVG; the screen animates it.
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

const NAVY = "#14324A";
const AMBER = "#F5A524";
const AMBER_DEEP = "#D98A12";
const WHITE = "#FFFFFF";
const PALE = "#BFE6F0";
const LINE = "#D6EAF0";

export default function AllSetArt({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityLabel="Your job profile is ready">
      <Circle cx="100" cy="104" r="78" fill={WHITE} opacity={0.14} />
      <Circle cx="100" cy="104" r="58" fill={WHITE} opacity={0.12} />

      {/* job card */}
      <G transform="rotate(-6 100 108)">
        <Rect x="50" y="62" width="100" height="96" rx="14" fill={WHITE} />
        <Rect x="62" y="76" width="26" height="26" rx="7" fill={AMBER} />
        <Path d="M68 86 h14 v10 h-14 Z M71 86 v-2.5 h8 v2.5" stroke={WHITE} strokeWidth="2" fill="none" strokeLinejoin="round" />
        <Rect x="96" y="80" width="42" height="6" rx="3" fill={NAVY} />
        <Rect x="96" y="92" width="30" height="5" rx="2.5" fill={LINE} />
        <Rect x="62" y="114" width="76" height="5" rx="2.5" fill={LINE} />
        <Rect x="62" y="125" width="60" height="5" rx="2.5" fill={LINE} />
        <Rect x="62" y="138" width="34" height="10" rx="5" fill={PALE} />
      </G>

      {/* check badge */}
      <Circle cx="146" cy="70" r="20" fill={AMBER} />
      <Circle cx="146" cy="70" r="20" fill="none" stroke={AMBER_DEEP} strokeWidth="2" opacity={0.35} />
      <Path d="M137 70.5 l6 6 l12 -13" stroke={WHITE} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* map pin */}
      <Path d="M48 70 C46 63 34 58 34 47 A14 14 0 1 1 62 47 C62 58 50 63 48 70 Z" fill={NAVY} />
      <Circle cx="48" cy="47" r="5.5" fill={WHITE} />

      {/* ground */}
      <Path d="M40 176 H160" stroke={WHITE} strokeWidth="2" strokeLinecap="round" opacity={0.6} />
    </Svg>
  );
}
