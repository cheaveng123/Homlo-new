// Custom icons for the post-a-job flow, drawn in the house style
// (DESIGN_ROLLOUT.md): 24x24 grid, 1.8 rounded line for controls, and for
// illustrations one solid silhouette + one darker/amber inner shape + white
// cut-outs. No icon-font glyphs.
import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { palette } from '@/src/design/tokens';

type P = { size?: number; color?: string };

const line = (color: string, w = 1.8) =>
  ({ fill: 'none', stroke: color, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' }) as const;

/* ───────── controls (line, 1.8) ───────── */

/** Back: a short chevron with a tail. */
export function BackGlyph({ size = 22, color = palette.ink }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M14.5 5.5 8 12l6.5 6.5" {...line(color, 2)} />
    </Svg>
  );
}

/** Close: two crossed strokes. */
export function CloseGlyph({ size = 20, color = palette.ink }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...line(color, 2)} />
    </Svg>
  );
}

/** Search a place: a lens with a tiny pin inside. */
export function SearchPlaceGlyph({ size = 20, color = palette.slate }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={10.5} cy={10.5} r={6.8} {...line(color)} />
      <Path d="m15.6 15.6 4.4 4.4" {...line(color, 2.2)} />
      <Path d="M10.5 7.2a2.4 2.4 0 0 0-2.4 2.4c0 1.8 2.4 3.9 2.4 3.9s2.4-2.1 2.4-3.9a2.4 2.4 0 0 0-2.4-2.4Z" fill={palette.amber} />
      <Circle cx={10.5} cy={9.6} r={0.8} fill="#fff" />
    </Svg>
  );
}

/** Use my location: a crosshair ring with ticks and a solid centre. */
export function LocateGlyph({ size = 22, color = palette.ink, active }: P & { active?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={6.6} {...line(color)} />
      <Path d="M12 2.6v3M12 18.4v3M2.6 12h3M18.4 12h3" {...line(color)} />
      <Circle cx={12} cy={12} r={2.7} fill={active ? palette.cyan : color} />
      {active ? <Circle cx={12} cy={12} r={1} fill="#fff" /> : null}
    </Svg>
  );
}

/** Clear text: a soft disc with a white cross. */
export function ClearGlyph({ size = 18, color = palette.placeholderInk }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} fill={color} opacity={0.35} />
      <Path d="M9 9l6 6M15 9l-6 6" {...line('#fff', 2)} />
    </Svg>
  );
}

export function CheckGlyph({ size = 14, color = '#fff' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12.5l4.5 4.5L19 7.5" {...line(color, 3)} />
    </Svg>
  );
}

export function PlusGlyph({ size = 18, color = palette.ink }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 5v14M5 12h14" {...line(color, 2.2)} />
    </Svg>
  );
}

export function MinusGlyph({ size = 18, color = palette.ink }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12h14" {...line(color, 2.2)} />
    </Svg>
  );
}

export function ChevronGlyph({ size = 16, color = palette.slate }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="m9.5 6 6 6-6 6" {...line(color, 2)} />
    </Svg>
  );
}

/** Edit: a pencil with an amber tip. */
export function EditGlyph({ size = 16, color = palette.cyanDeep }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M14.5 5.5l4 4L9 19H5v-4Z" {...line(color)} />
      <Path d="M5 15v4h4Z" fill={palette.amber} />
    </Svg>
  );
}

/** Draft: a folded page with a bookmark notch. */
export function DraftGlyph({ size = 18, color = palette.cyanDeep }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6.5 3.5h7.5l4 4v12a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19.5v-14.5a1.5 1.5 0 0 1 1.5-1.5Z" {...line(color)} />
      <Path d="M9 11h6M9 14.5h4" {...line(color)} />
      <Path d="M14 3.5v4h4" {...line(color)} />
    </Svg>
  );
}

/** Warning: a rounded triangle with a white bar and dot (validation errors). */
export function WarnGlyph({ size = 16, color = palette.danger }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M10.3 4.2a2 2 0 0 1 3.4 0l7.4 12.9a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3Z" fill={color} />
      <Path d="M12 9v4.5" {...line('#fff', 2.2)} />
      <Circle cx={12} cy={16.8} r={1.2} fill="#fff" />
    </Svg>
  );
}

/** Tip: a light bulb with an amber filament. */
export function TipGlyph({ size = 16, color = palette.cyanDeep }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 18h6M10 21h4" {...line(color)} />
      <Path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z" {...line(color)} />
      <Path d="M10.5 11.5 12 13l1.5-1.5" {...line(palette.amber, 1.6)} />
    </Svg>
  );
}

/* ───────── location illustrations (solid + accent + cut-outs) ───────── */

/** Search-result row: a solid pin on a ground oval. */
export function PlaceGlyph({ size = 22, color = palette.slate }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx={12} cy={20.6} rx={5} ry={1.6} fill={palette.line} />
      <Path d="M12 2.4a6.6 6.6 0 0 0-6.6 6.6c0 4.6 6.6 10.4 6.6 10.4s6.6-5.8 6.6-10.4A6.6 6.6 0 0 0 12 2.4Z" fill={color} />
      <Circle cx={12} cy={9} r={2.5} fill="#fff" />
    </Svg>
  );
}

/** Address card: a storefront with a scalloped amber awning. */
export function StorefrontGlyph({ size = 26 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={4} y={9} width={16} height={12} rx={1.8} fill={palette.cyan} />
      <Rect x={6.6} y={12.4} width={4.6} height={4} rx={0.9} fill="#fff" />
      <Rect x={13.2} y={13.4} width={4.2} height={7.6} rx={0.9} fill="#fff" />
      <Path d="M3 9h18l-1.6-5H4.6Z" fill={palette.navy} />
      <Path d="M3 9a2.25 2.25 0 0 0 4.5 0 2.25 2.25 0 0 0 4.5 0 2.25 2.25 0 0 0 4.5 0 2.25 2.25 0 0 0 4.5 0" fill={palette.amber} />
    </Svg>
  );
}

/** Reach: three ripples spreading from a solid dot (who sees the job). */
export function ReachGlyph({ size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9.2} {...line(palette.cyanSoft, 1.6)} strokeDasharray="2.4 2.6" />
      <Circle cx={12} cy={12} r={5.6} {...line(palette.cyan, 1.8)} />
      <Circle cx={12} cy={12} r={2.4} fill={palette.amber} />
    </Svg>
  );
}

/** Remote: a laptop with a white screen and an amber signal arc. */
export function RemoteGlyph({ size = 26 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={4} y={5} width={16} height={11} rx={2} fill={palette.cyan} />
      <Rect x={6} y={7} width={12} height={7} rx={1} fill="#fff" />
      <Path d="M2.5 18h19l-1 2.2h-17Z" fill={palette.navy} />
      <Path d="M9.8 11.6a3.2 3.2 0 0 1 4.4 0" {...line(palette.amber, 1.6)} />
      <Circle cx={12} cy={12.6} r={0.9} fill={palette.amber} />
    </Svg>
  );
}

/**
 * The centre pin for the location map, 46x58: a navy teardrop with a white
 * disc and a cyan storefront inside, an amber door. Matches the job pins'
 * navy "selected" colour so the employer's spot reads as theirs.
 */
export function CenterPinArt({ width = 46 }: { width?: number }) {
  const h = (width / 46) * 58;
  return (
    <Svg width={width} height={h} viewBox="0 0 46 58">
      <Path d="M23 2C11.4 2 2 11.2 2 22.6 2 37.4 23 56 23 56s21-18.6 21-33.4C44 11.2 34.6 2 23 2Z" fill={palette.navy} stroke="#fff" strokeWidth={2.5} />
      <Circle cx={23} cy={22.5} r={13} fill="#fff" />
      <G>
        <Rect x={15.5} y={21} width={15} height={9.5} rx={1.4} fill={palette.cyan} />
        <Path d="M14.6 21h16.8l-1.4-4.6H16Z" fill={palette.navy} />
        <Rect x={20.6} y={24.2} width={4.8} height={6.3} rx={0.8} fill={palette.amber} />
      </G>
    </Svg>
  );
}

/* ───────── step illustrations (header tiles, 24 grid) ───────── */

/** Job photo: a solid camera with a white lens ring and an amber flash. */
export function PhotoStepGlyph({ size = 24, color = palette.cyan }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4.5 7h3l1.6-2.3h5.8L16.5 7h3A2 2 0 0 1 21.5 9v9.5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" fill={color} />
      <Circle cx={12} cy={13.6} r={4.2} fill="#fff" />
      <Circle cx={12} cy={13.6} r={2.1} fill={palette.navy} />
      <Rect x={16.8} y={9} width={2.6} height={1.8} rx={0.9} fill={palette.amber} />
    </Svg>
  );
}

/** Review: a solid clipboard with white lines and an amber check seal. */
export function ReviewStepGlyph({ size = 24, color = palette.cyan }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={4} y={4} width={14} height={18} rx={2.4} fill={color} />
      <Rect x={7.5} y={2.5} width={7} height={3.6} rx={1.4} fill={palette.navy} />
      <Path d="M7.5 10.5h7M7.5 14h5M7.5 17.5h3.5" {...line('#fff', 1.7)} />
      <Circle cx={18} cy={17.5} r={4.4} fill={palette.amber} stroke="#fff" strokeWidth={1.4} />
      <Path d="m16.2 17.6 1.3 1.3 2.4-2.6" {...line('#fff', 1.5)} />
    </Svg>
  );
}

/** Empty photo slot: a framed landscape with a sun, sized for the upload area. */
export function UploadArt({ size = 64 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x={6} y={12} width={46} height={38} rx={8} fill={palette.cyanTint} />
      <Rect x={6} y={12} width={46} height={38} rx={8} {...line(palette.cyan, 2.4)} />
      <Path d="M8 44 22 30l9 9 6-6 13 13" fill={palette.cyanSoft} />
      <Path d="M8 44 22 30l9 9 6-6 13 13" {...line(palette.cyan, 2.4)} />
      <Circle cx={38} cy={23} r={4.5} fill={palette.amber} />
      <Circle cx={50} cy={48} r={10} fill={palette.navy} stroke="#fff" strokeWidth={3} />
      <Path d="M50 43.5v9M45.5 48h9" {...line('#fff', 2.6)} />
    </Svg>
  );
}
