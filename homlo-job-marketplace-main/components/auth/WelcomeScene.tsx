// components/auth/WelcomeScene.tsx
// Welcome-step illustration for the auth screen, drawn in a flat editorial
// style: slim faceless figures in two or three flat colours, one focal device
// (a phone showing a job map), pale foliage/buildings behind, dashed grey route
// lines with nodes, filled + outline map pins, and a thin navy ground line.
// Palette is Homlo's (cyan / navy / amber). Static by design.
// Needs: react-native-svg
import React from "react";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";

const NAVY = "#14324A";
const NAVY_DEEP = "#0E2233";
const CYAN = "#0891B2";
const CYAN_DEEP = "#0B6F8A";
const AMBER = "#F5A524";
const AMBER_DEEP = "#D98A12";
const SKIN = "#E9B38F";
const SKIN_DEEP = "#C98E6A";
const LEAF = "#D3EBF2";
const LEAF_DEEP = "#BFE0EA";
const ROUTE = "#B8C6CC";
const SCREEN = "#EAF4F7";
const BLOCK = "#D6EAF0";

/** Teardrop pin with its tip at (x, y). */
function pinPath(x: number, y: number, r: number) {
  const cy = y - r * 1.9;
  return `M${x} ${y} C${x - r * 0.25} ${y - r * 0.6} ${x - r} ${cy + r * 0.55} ${x - r} ${cy} A${r} ${r} 0 1 1 ${x + r} ${cy} C${x + r} ${cy + r * 0.55} ${x + r * 0.25} ${y - r * 0.6} ${x} ${y} Z`;
}

export default function WelcomeScene({ width }: { width: number }) {
  const height = (width * 240) / 360;
  return (
    <Svg width={width} height={height} viewBox="0 0 360 240" accessibilityLabel="People finding jobs on a map">
      {/* ---------- background foliage & buildings ---------- */}
      <G>
        <Rect x="236" y="128" width="26" height="92" rx="3" fill={BLOCK} />
        <Rect x="262" y="150" width="20" height="70" rx="3" fill={LEAF} />
        <Rect x="92" y="140" width="22" height="80" rx="3" fill={LEAF} />
        {[0, 1, 2, 3].map((i) => (
          <Rect key={i} x="242" y={138 + i * 18} width="5" height="7" rx="1" fill="#fff" opacity={0.8} />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <Rect key={`b${i}`} x="251" y={138 + i * 18} width="5" height="7" rx="1" fill="#fff" opacity={0.8} />
        ))}

        <Ellipse cx="168" cy="58" rx="24" ry="44" fill={LEAF_DEEP} transform="rotate(-24 168 58)" />
        <Path d="M168 100 L168 22" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" transform="rotate(-24 168 58)" />
        <Ellipse cx="206" cy="48" rx="22" ry="40" fill={LEAF} transform="rotate(22 206 48)" />
        <Path d="M206 86 L206 14" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" transform="rotate(22 206 48)" />
        <Ellipse cx="130" cy="112" rx="18" ry="34" fill={LEAF} transform="rotate(-48 130 112)" />
        <Path d="M130 144 L130 84" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" transform="rotate(-48 130 112)" />
        <Ellipse cx="236" cy="104" rx="18" ry="34" fill={LEAF_DEEP} transform="rotate(42 236 104)" />
        <Path d="M236 136 L236 76" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" transform="rotate(42 236 104)" />
      </G>

      {/* ---------- dashed route lines ---------- */}
      <G stroke={ROUTE} strokeWidth="1.4" strokeDasharray="3 3" fill="none" strokeLinecap="round">
        <Path d="M40 132 L40 88 L96 88 L96 60" />
        <Path d="M96 88 L140 88" />
        <Path d="M224 116 L262 116 L262 72" />
        <Path d="M262 116 L326 116 L326 168" />
      </G>
      {[
        [40, 132],
        [96, 88],
        [262, 116],
        [326, 168],
      ].map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill="#fff" stroke={ROUTE} strokeWidth="1.4" />
      ))}

      {/* ---------- pins ---------- */}
      <Path d={pinPath(96, 56, 11)} fill={AMBER} />
      <Circle cx="96" cy={56 - 11 * 1.9} r="4.4" fill="#fff" />
      <Path d={pinPath(262, 68, 8)} fill="#fff" stroke={CYAN} strokeWidth="2" />
      <Circle cx="262" cy={68 - 8 * 1.9} r="2.6" fill={CYAN} />

      {/* ---------- phone (focal object) ---------- */}
      <G>
        <Rect x="140" y="50" width="84" height="164" rx="13" fill="#fff" stroke={NAVY} strokeWidth="3" />
        <Rect x="147" y="58" width="70" height="148" rx="8" fill={SCREEN} />
        {/* city blocks */}
        <Rect x="151" y="64" width="22" height="20" rx="2" fill={BLOCK} />
        <Rect x="179" y="64" width="34" height="20" rx="2" fill={BLOCK} />
        <Rect x="151" y="92" width="22" height="34" rx="2" fill={BLOCK} />
        <Rect x="179" y="92" width="14" height="34" rx="2" fill={BLOCK} />
        <Rect x="199" y="92" width="14" height="34" rx="2" fill={BLOCK} />
        <Rect x="151" y="134" width="40" height="22" rx="2" fill={BLOCK} />
        <Rect x="197" y="134" width="16" height="22" rx="2" fill={BLOCK} />
        {/* route on map */}
        <Path d="M162 160 L162 130 L196 130 L196 88 L206 88" stroke={AMBER} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="162" cy="160" r="3.6" fill="#fff" stroke={AMBER} strokeWidth="2" />
        <Circle cx="196" cy="130" r="5.5" fill="none" stroke={NAVY} strokeWidth="1.6" />
        <Path d={pinPath(206, 90, 5.5)} fill={CYAN} />
        <Circle cx="206" cy={90 - 5.5 * 1.9} r="2" fill="#fff" />
        {/* job card */}
        <Rect x="151" y="168" width="62" height="30" rx="5" fill="#fff" />
        <Rect x="156" y="174" width="18" height="18" rx="4" fill={AMBER} />
        <Path d="M161 180 h8 v8 h-8 Z M163 180 v-1.5 h4 v1.5" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
        <Rect x="178" y="176" width="28" height="4" rx="2" fill={NAVY} />
        <Rect x="178" y="185" width="20" height="3.5" rx="1.75" fill={ROUTE} />
        {/* notch */}
        <Rect x="170" y="53" width="24" height="4" rx="2" fill={NAVY} />
      </G>

      {/* ---------- delivery rider (left) ---------- */}
      <G>
        {/* wheels */}
        <Circle cx="44" cy="202" r="16" fill="none" stroke={NAVY} strokeWidth="2.6" />
        <Circle cx="44" cy="202" r="2" fill={NAVY} />
        <Circle cx="100" cy="202" r="16" fill="none" stroke={NAVY} strokeWidth="2.6" />
        <Circle cx="100" cy="202" r="2" fill={NAVY} />
        {/* frame */}
        <Path d="M44 202 L64 176 L92 176 L100 202 M64 176 L72 202 L44 202 M92 176 L90 160 L97 158" stroke={CYAN} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="64" y1="176" x2="62" y2="168" stroke={NAVY} strokeWidth="2.4" strokeLinecap="round" />
        <Line x1="56" y1="167" x2="68" y2="167" stroke={NAVY} strokeWidth="3" strokeLinecap="round" />
        {/* delivery box on rack */}
        <Line x1="32" y1="176" x2="60" y2="176" stroke={NAVY} strokeWidth="2" strokeLinecap="round" />
        <Rect x="30" y="152" width="26" height="22" rx="2.5" fill={AMBER} />
        <Rect x="30" y="160" width="26" height="4" fill={AMBER_DEEP} />
        {/* back leg */}
        <Path d="M64 165 L80 180 L74 198" stroke={NAVY_DEEP} strokeWidth="5.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* torso */}
        <Path d="M58 166 L70 166 L84 136 L75 130 Z" fill={CYAN} />
        <Path d="M75 130 L84 136 L80 144 Z" fill={CYAN_DEEP} />
        {/* front leg */}
        <Path d="M66 165 L86 176 L78 196" stroke={NAVY} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Rect x="74" y="195" width="11" height="4.5" rx="2" fill={NAVY_DEEP} />
        {/* arm */}
        <Path d="M80 136 L92 148 L96 158" stroke={CYAN} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="96.5" cy="158.5" r="2.6" fill={SKIN} />
        {/* head */}
        <Rect x="78" y="124" width="5" height="7" rx="2" fill={SKIN_DEEP} transform="rotate(20 80 127)" />
        <Circle cx="84" cy="117" r="8" fill={SKIN} />
        <Path d="M76 116 A8.5 8.5 0 0 1 92.5 114 L92 116 L77 118 Z" fill={NAVY} />
        <Circle cx="75" cy="119" r="3.6" fill={NAVY} />
      </G>

      {/* ---------- job-seeker with briefcase (right) ---------- */}
      <G>
        {/* legs */}
        <Path d="M284 148 L296 148 L291 214 L283 214 Z" fill={NAVY} />
        <Path d="M292 148 L304 148 L310 214 L302 214 Z" fill={NAVY_DEEP} />
        <Rect x="278" y="212" width="14" height="5" rx="2" fill={NAVY_DEEP} />
        <Rect x="300" y="212" width="14" height="5" rx="2" fill={NAVY_DEEP} />
        {/* torso */}
        <Path d="M282 100 Q293 94 304 100 L308 152 L280 152 Z" fill={AMBER} />
        <Path d="M289 99 L293 110 L297 99 Z" fill="#fff" />
        {/* back arm with briefcase */}
        <Path d="M303 104 L310 132" stroke={AMBER_DEEP} strokeWidth="6" strokeLinecap="round" />
        <Circle cx="310.5" cy="134" r="2.8" fill={SKIN} />
        <Path d="M305 138 v-3.5 h11 v3.5" stroke={NAVY} strokeWidth="1.8" fill="none" strokeLinejoin="round" />
        <Rect x="301" y="138" width="19" height="14" rx="2.5" fill={NAVY} />
        <Rect x="301" y="143" width="19" height="2" fill={CYAN} />
        {/* front arm raised with phone */}
        <Path d="M284 104 L276 122 L284 116" stroke={AMBER} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="285" cy="115" r="2.8" fill={SKIN} />
        <Rect x="284" y="104" width="7" height="12" rx="1.5" fill={NAVY} transform="rotate(12 287 110)" />
        {/* head */}
        <Rect x="290" y="88" width="6" height="9" rx="2" fill={SKIN_DEEP} />
        <Circle cx="293" cy="82" r="9" fill={SKIN} />
        <Path d="M284 82 Q283 70 294 70 Q304 70 302.5 80 Q298 75.5 291 76.5 Q286 77.5 284 82 Z" fill={NAVY} />
      </G>

      {/* ---------- ground ---------- */}
      <Line x1="14" y1="219" x2="346" y2="219" stroke={NAVY} strokeWidth="1.6" strokeLinecap="round" />
      <Circle cx="20" cy="226" r="1.2" fill={ROUTE} />
      <Line x1="28" y1="226" x2="58" y2="226" stroke={ROUTE} strokeWidth="1.2" strokeLinecap="round" />
      <Line x1="300" y1="226" x2="338" y2="226" stroke={ROUTE} strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  );
}
