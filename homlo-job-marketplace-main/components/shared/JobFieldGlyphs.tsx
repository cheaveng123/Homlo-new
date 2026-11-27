// Secondary icon style for the 19 job fields (the Home "Job field" row uses
// the colourful illustrations; this is the compact companion set).
// Duotone line glyphs: navy 1.8 stroke on a 24 grid, one soft cyan-tint fill
// on the main shape, and a single amber accent. Round caps and joins.
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { palette } from '@/src/design/tokens';
import type { JobFieldId } from '@/lib/job-fields';

const INK = palette.navy;
const FILL = palette.cyanTint;
const ACCENT = palette.amber;

type P = { size?: number };
const base = { fill: 'none', stroke: INK, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const tint = { ...base, fill: FILL } as const;
const amber = { fill: 'none', stroke: ACCENT, strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function G({ size = 24, children }: P & { children: React.ReactNode }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24">{children}</Svg>;
}

const GLYPHS: Record<JobFieldId, (p: P) => React.ReactElement> = {
  'sales-business': (p) => (
    <G {...p}>
      <Rect x={4} y={13.5} width={3.6} height={6.5} rx={1} {...tint} />
      <Rect x={10.2} y={10.5} width={3.6} height={9.5} rx={1} {...tint} />
      <Rect x={16.4} y={8} width={3.6} height={12} rx={1} {...tint} />
      <Path d="M4 9.5 9 5.5l3 2.4 6-4.4M15 3.5h3v3" {...amber} />
    </G>
  ),
  'marketing-media': (p) => (
    <G {...p}>
      <Path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1Z" {...tint} />
      <Path d="M7.5 15.3 8.6 19h2.2" {...base} />
      <Path d="M16.5 9.2a3.8 3.8 0 0 1 0 5.6M19 6.8a7.2 7.2 0 0 1 0 10.4" {...amber} />
    </G>
  ),
  'finance-accounting': (p) => (
    <G {...p}>
      <Circle cx={11.5} cy={12.5} r={8} {...tint} />
      <Path d="M14 9.7c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.4.7-2.4 1.8 0 2.6 5.1 1.4 5.1 4.2 0 1.1-1.1 1.9-2.6 1.9-1.1 0-2.1-.5-2.7-1.3M11.5 7v1.5M11.5 16.5V18" {...base} />
      <Path d="M19.5 3.5v3M18 5h3" {...amber} />
    </G>
  ),
  'it-technology': (p) => (
    <G {...p}>
      <Rect x={3} y={4.5} width={18} height={12} rx={2} {...tint} />
      <Path d="M9 20h6M12 16.5V20M9.5 8.5l-2 2 2 2M14.5 8.5l2 2-2 2" {...base} />
      <Path d="M12.8 8l-1.6 5" {...amber} />
    </G>
  ),
  'customer-service': (p) => (
    <G {...p}>
      <Path d="M5 13v-1a7 7 0 0 1 14 0v1" {...base} />
      <Rect x={3.5} y={12.5} width={4} height={6} rx={1.6} {...tint} />
      <Rect x={16.5} y={12.5} width={4} height={6} rx={1.6} {...tint} />
      <Path d="M18.5 18.5c0 1.6-1.5 2.5-4 2.5h-1.2" {...base} />
      <Circle cx={12.3} cy={21} r={1.2} fill={ACCENT} />
    </G>
  ),
  'hospitality-food': (p) => (
    <G {...p}>
      <Path d="M4.5 16a7.5 7.5 0 0 1 15 0Z" {...tint} />
      <Path d="M3 16h18M6 19h12" {...base} />
      <Path d="M12 6.8v1.7" {...base} />
      <Circle cx={12} cy={5.6} r={1.4} fill={ACCENT} />
      <Path d="M8 12.2a4.2 4.2 0 0 1 2.4-2.1" {...amber} strokeWidth={1.4} />
    </G>
  ),
  'retail-ecommerce': (p) => (
    <G {...p}>
      <Path d="M5.5 8h13l-1 12.5h-11Z" {...tint} />
      <Path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" {...base} />
      <Path d="M12 13.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3Z" fill={ACCENT} />
    </G>
  ),
  'logistics-delivery': (p) => (
    <G {...p}>
      <Rect x={2.5} y={6.5} width={11} height={10} rx={1.2} {...tint} />
      <Path d="M13.5 10h4l3 3.2v3.3h-7Z" {...base} />
      <Circle cx={7} cy={17.5} r={1.9} fill="#FFFFFF" stroke={INK} strokeWidth={1.8} />
      <Circle cx={17} cy={17.5} r={1.9} fill="#FFFFFF" stroke={INK} strokeWidth={1.8} />
      <Path d="M5.5 10h5" {...amber} />
    </G>
  ),
  administration: (p) => (
    <G {...p}>
      <Rect x={5} y={4.5} width={14} height={16.5} rx={2} {...tint} />
      <Rect x={9} y={3} width={6} height={3.2} rx={1} fill="#FFFFFF" stroke={INK} strokeWidth={1.8} />
      <Path d="M9 11h6M9 14.5h6M9 18h3" {...base} />
      <Path d="M14.2 17.6l1 1 2-2.2" {...amber} />
    </G>
  ),
  'human-resources': (p) => (
    <G {...p}>
      <Circle cx={16.3} cy={8} r={2.5} {...base} />
      <Path d="M13 19c.3-2.8 1.6-4.3 3.3-4.3s3.4 1.5 3.7 4.3" {...base} />
      <Circle cx={9} cy={9} r={3} {...tint} />
      <Path d="M3.5 20c.4-3.4 2.6-5.5 5.5-5.5s5.1 2.1 5.5 5.5Z" {...tint} />
      <Circle cx={16.3} cy={8} r={1} fill={ACCENT} />
    </G>
  ),
  'education-training': (p) => (
    <G {...p}>
      <Path d="M2.5 9.5 12 5l9.5 4.5L12 14Z" {...tint} />
      <Path d="M6.5 11.6v4c0 1.5 2.5 2.8 5.5 2.8s5.5-1.3 5.5-2.8v-4" {...base} />
      <Path d="M21.5 9.5v5" {...amber} />
      <Circle cx={21.5} cy={15.6} r={1.1} fill={ACCENT} />
    </G>
  ),
  'engineering-construction': (p) => (
    <G {...p}>
      <Path d="M4 16a8 8 0 0 1 16 0Z" {...tint} />
      <Path d="M2.5 16h19v2.6h-19Z" {...base} />
      <Path d="M9 9v4.5M15 9v4.5" {...base} />
      <Path d="M12 7.8v5.7" {...amber} />
    </G>
  ),
  'design-creative': (p) => (
    <G {...p}>
      <Path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.8-1 1.3-2-.6-1.2.2-2.5 1.6-2.5H17a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9-8.5-9Z" {...tint} />
      <Circle cx={7.5} cy={11.5} r={1.3} fill={INK} />
      <Circle cx={10} cy={7.6} r={1.3} fill={INK} />
      <Circle cx={14.6} cy={7.6} r={1.3} fill={ACCENT} />
      <Circle cx={17} cy={11} r={1.3} fill={INK} />
    </G>
  ),
  healthcare: (p) => (
    <G {...p}>
      <Rect x={3.5} y={7} width={17} height={13} rx={2.5} {...tint} />
      <Path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" {...base} />
      <Path d="M12 10.5v6.5M8.8 13.7h6.4" {...amber} strokeWidth={2.2} />
    </G>
  ),
  manufacturing: (p) => (
    <G {...p}>
      <Path d="M3 20v-9l5 3v-3l5 3V6h4.5v14Z" {...tint} />
      <Path d="M2 20h20M6 17h2M10.5 17h2" {...base} />
      <Path d="M15.5 4c.9-.8 1.9-.8 2.8 0s1.9.8 2.8 0" {...amber} />
    </G>
  ),
  'beauty-personal-care': (p) => (
    <G {...p}>
      <Circle cx={6.5} cy={7} r={2.6} {...tint} />
      <Circle cx={6.5} cy={17} r={2.6} {...tint} />
      <Path d="M8.7 8.4 20 17.5M8.7 15.6 20 6.5" {...base} />
      <Circle cx={13.4} cy={12} r={1.2} fill={ACCENT} />
    </G>
  ),
  'cleaning-housekeeping': (p) => (
    <G {...p}>
      <Path d="M8 10.5h6l1.2 3v7a1 1 0 0 1-1 1H7.8a1 1 0 0 1-1-1v-7Z" {...tint} />
      <Path d="M9.5 10.5V8h3v2.5M8.5 8V5.2h5.8L16.5 7h-8" {...base} />
      <Circle cx={19.3} cy={4.8} r={1} fill={ACCENT} />
      <Circle cx={20.6} cy={8} r={1} fill={ACCENT} />
      <Circle cx={19} cy={10.8} r={1} fill={ACCENT} />
    </G>
  ),
  security: (p) => (
    <G {...p}>
      <Path d="M12 3l7.5 2.8v5.4c0 4.6-3.2 8-7.5 9.8-4.3-1.8-7.5-5.2-7.5-9.8V5.8Z" {...tint} />
      <Path d="m8.8 12.2 2.2 2.2 4.4-4.6" {...amber} strokeWidth={2.1} />
    </G>
  ),
  agriculture: (p) => (
    <G {...p}>
      <Path d="M12 13c0-4 2.6-6.5 7-6.5 0 4.2-2.8 6.5-7 6.5Z" {...tint} />
      <Path d="M12 12c0-3.4-2.2-5.5-6-5.5 0 3.6 2.3 5.5 6 5.5Z" {...tint} />
      <Path d="M12 21v-9" {...base} />
      <Path d="M7 21h10" {...amber} />
    </G>
  ),
};

/** Secondary (duotone line) icon for a job field id; falls back to a search glyph. */
export function JobFieldGlyph({ id, size = 24 }: { id: string; size?: number }) {
  const Glyph = GLYPHS[id as JobFieldId];
  if (Glyph) return <Glyph size={size} />;
  return (
    <G size={size}>
      <Circle cx={11} cy={11} r={6.5} {...base} />
      <Path d="m16 16 4 4" {...base} />
    </G>
  );
}
