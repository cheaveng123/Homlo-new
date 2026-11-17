// Static outline icons for the Employer Dashboard (header, tabs, bottom nav, photo placeholder).
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { size?: number; color?: string; strokeWidth?: number };
type TabP = P & { accent?: string };

export function SearchGlyph({ size = 22, color = '#fff', strokeWidth = 1.9 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={strokeWidth} />
      <Path d="m16 16 4.5 4.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function BellGlyph({ size = 22, color = '#fff', strokeWidth = 1.9 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.8h-15Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M10 20.3a2.2 2.2 0 0 0 4 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function HomeGlyph({ size = 24, color = '#69777A', strokeWidth = 1.8 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M9.5 20.5v-5.5h5v5.5" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}

export function PlusGlyph({ size = 24, color = '#69777A', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4.5v15M4.5 12h15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function UserGlyph({ size = 24, color = '#69777A', strokeWidth = 1.8 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M4.5 20.5c.6-3.9 3.6-6 7.5-6s6.9 2.1 7.5 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** Tab: Live. Broadcast arcs around a dot; the dot takes the accent. */
export function LiveTabGlyph({ size = 18, color = '#6A7C84', accent, strokeWidth = 1.8 }: TabP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={2.4} fill={accent ?? color} />
    </Svg>
  );
}

/** Tab: Draft. Document with a pencil; the pencil takes the accent. */
export function DraftTabGlyph({ size = 18, color = '#6A7C84', accent, strokeWidth = 1.8 }: TabP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14 3.5H7A2 2 0 0 0 5 5.5v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M14 3.5v5h5" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="m9 16.5.5-2.2 4.2-4.2 1.7 1.7-4.2 4.2Z" stroke={accent ?? color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}

/** Tab: Review. Magnifier with a check; the check takes the accent. */
export function ReviewTabGlyph({ size = 18, color = '#6A7C84', accent, strokeWidth = 1.8 }: TabP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={10.5} cy={10.5} r={6.5} stroke={color} strokeWidth={strokeWidth} />
      <Path d="m15.5 15.5 4.5 4.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="m7.8 10.6 1.9 1.9 3.3-3.6" stroke={accent ?? color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** 32x26 outline image glyph for the job photo placeholder. */
export function PhotoGlyph({ color = '#7FA3AE' }: { color?: string }) {
  return (
    <Svg width={32} height={26} viewBox="0 0 32 26" fill="none">
      <Rect x={1} y={1} width={30} height={24} rx={5} stroke={color} strokeWidth={2} />
      <Circle cx={22} cy={8.5} r={2.8} stroke={color} strokeWidth={2} />
      <Path d="m2 21 8.5-7.5 6 5 4-3.2L30 22" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
