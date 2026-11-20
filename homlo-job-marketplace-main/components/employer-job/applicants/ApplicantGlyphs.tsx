/**
 * Custom glyphs for the New applicants page. House style: 1.8 line, rounded joins,
 * one solid signature detail per glyph.
 */
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { size?: number; color?: string; accent?: string };

export function BackGlyph({ size = 22, color = '#fff' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14.5 5.5 8 12l6.5 6.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Tray with an arrow dropping in: applications received. */
export function ReceivedGlyph({ size = 20, color = '#fff', accent = '#F5A524' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3.5 13.5h4.2l1.6 2.5h5.4l1.6-2.5h4.2v4a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M12 3.5v7.5M8.8 8l3.2 3.2L15.2 8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={17.6} r={1.2} fill={accent} />
    </Svg>
  );
}

/** Envelope with a solid dot: unread. */
export function UnreadGlyph({ size = 20, color = '#fff', accent = '#F5A524' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={6} width={15} height={12} rx={2.5} stroke={color} strokeWidth={1.8} />
      <Path d="m4.5 7.5 6.5 5 6.5-5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={19} cy={6} r={3} fill={accent} />
    </Svg>
  );
}

/** Briefcase with a spark: jobs with new applicants. */
export function JobsNewGlyph({ size = 20, color = '#fff', accent = '#F5A524' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={8} width={17} height={11.5} rx={2.5} stroke={color} strokeWidth={1.8} />
      <Path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M3.5 13h17" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M19 2.5 19.6 4l1.5.6-1.5.6L19 6.7l-.6-1.5-1.5-.6 1.5-.6Z" fill={accent} />
    </Svg>
  );
}

/** Rising bars with a solid peak: section title for the chart. */
export function ChartGlyph({ size = 20, color = '#14324A', accent = '#0891B2' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20h16" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Rect x={5.5} y={12} width={3} height={6} rx={1.2} stroke={color} strokeWidth={1.6} />
      <Rect x={10.5} y={8.5} width={3} height={9.5} rx={1.2} stroke={color} strokeWidth={1.6} />
      <Rect x={15.5} y={4.5} width={3} height={13.5} rx={1.2} fill={accent} />
    </Svg>
  );
}

/** Stacked folders: the per-job breakdown section. */
export function StackGlyph({ size = 20, color = '#14324A', accent = '#F5A524' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9.5V7a2 2 0 0 1 2-2h3.2l1.6 1.8H18a2 2 0 0 1 2 2v.7" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Rect x={3} y={9.5} width={18} height={10} rx={2.2} stroke={color} strokeWidth={1.8} />
      <Path d="M8 14.5h5" stroke={accent} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/** Person with a clock badge: waiting on you. */
export function WaitingGlyph({ size = 20, color = '#14324A', accent = '#0891B2' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9.5} cy={8} r={3.5} stroke={color} strokeWidth={1.8} />
      <Path d="M3.5 19.5c0-3.4 2.7-5.7 6-5.7 1.2 0 2.3.3 3.2.8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={17} cy={16.5} r={4} fill={accent} />
      <Path d="M17 14.6v2.1l1.3.9" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Job container glyph: a listing card with a person on it. `variant` rotates the
 * signature detail so neighbouring rows read as different jobs at a glance.
 */
export function JobTileGlyph({ size = 24, color = '#fff', variant = 0 }: P & { variant?: number }) {
  const v = variant % 4;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={4} width={17} height={16} rx={3} stroke={color} strokeWidth={1.8} />
      <Circle cx={9} cy={10} r={2.2} stroke={color} strokeWidth={1.7} />
      <Path d="M5.8 16.5c.5-1.8 1.7-2.8 3.2-2.8s2.7 1 3.2 2.8" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      {v === 0 && <Path d="M14.5 9h3M14.5 12h2" stroke={color} strokeWidth={1.7} strokeLinecap="round" />}
      {v === 1 && <Path d="m14.5 11 1.3 1.3 2.7-2.8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
      {v === 2 && <Path d="M16 8.5l.6 1.4 1.5.2-1.1 1 .3 1.5-1.3-.7-1.3.7.3-1.5-1.1-1 1.5-.2Z" fill={color} />}
      {v === 3 && <Path d="M14.5 13.5l1.5-2 1.3 1.2 1.7-2.7" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />}
    </Svg>
  );
}

export function ClockGlyph({ size = 14, color = '#6A7C84' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={2} />
      <Path d="M12 7.5V12l3 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PinGlyph({ size = 14, color = '#6A7C84' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3a6.5 6.5 0 0 1 6.5 6.5c0 4.8-6.5 11-6.5 11s-6.5-6.2-6.5-11A6.5 6.5 0 0 1 12 3Z" stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={9.5} r={2.2} fill={color} />
    </Svg>
  );
}

export function BriefcaseMiniGlyph({ size = 13, color = '#0B6F8A' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={8} width={17} height={11.5} rx={2.5} stroke={color} strokeWidth={2.2} />
      <Path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8" stroke={color} strokeWidth={2.2} />
    </Svg>
  );
}

export function ChatGlyph({ size = 18, color = '#0B6F8A' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-7l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
      <Circle cx={8.5} cy={11.3} r={1.1} fill={color} />
      <Circle cx={12} cy={11.3} r={1.1} fill={color} />
      <Circle cx={15.5} cy={11.3} r={1.1} fill={color} />
    </Svg>
  );
}

export function CheckGlyph({ size = 18, color = '#fff' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CrossGlyph({ size = 18, color = '#C0392B' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 7l10 10M17 7 7 17" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function ChevronGlyph({ size = 16, color = '#9AABB1' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m9.5 6 6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Empty state: an inbox tray with a solid check badge. */
export function AllCaughtUpArt({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Circle cx={48} cy={48} r={44} fill="#DCF1F6" />
      <Path d="M22 52h14l5 8h14l5-8h14v14a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6Z" fill="#fff" stroke="#14324A" strokeWidth={3} strokeLinejoin="round" />
      <Path d="M22 52l8-18a5 5 0 0 1 4.6-3h26.8a5 5 0 0 1 4.6 3l8 18" stroke="#14324A" strokeWidth={3} strokeLinejoin="round" />
      <Circle cx={68} cy={30} r={12} fill="#0891B2" />
      <Path d="M62.5 30.2l3.8 3.8 7.2-7.4" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
