// Line glyphs for the Job type page (paths from the approved preview).
// viewBox 0 0 24 24 unless noted, round caps and joins. Two-tone icons draw
// their soft parts at 28% opacity in the same color: no tiles behind icons.
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { palette } from '@/src/design/tokens';

type G = { size?: number; color?: string };

export const BackArrow = ({ size = 24, color = palette.ink }: G) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 12H5M11 5.5 4.5 12l6.5 6.5" />
  </Svg>
);

export const SearchIcon = ({ size = 20, color = palette.muted }: G) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
    <Circle cx={11} cy={11} r={6.5} />
    <Path d="m16 16 4 4" />
  </Svg>
);

export const FilterIcon = ({ size = 18, color = palette.slate }: G) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <Circle cx={15} cy={7} r={2} />
    <Circle cx={9} cy={17} r={2} />
  </Svg>
);

export const PinIcon = ({ size = 15, color = palette.slate }: G) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path d="M8 1.5a5 5 0 0 1 5 5c0 3.5-5 8-5 8s-5-4.5-5-8a5 5 0 0 1 5-5Z" stroke={color} strokeWidth={1.5} />
    <Circle cx={8} cy={6.5} r={1.6} fill={color} />
  </Svg>
);

/** "Location to be confirmed": dashed pin with a question mark. */
export const PinUnknownIcon = ({ size = 15, color = palette.slate }: G) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path d="M8 1.5a5 5 0 0 1 5 5c0 3.5-5 8-5 8s-5-4.5-5-8a5 5 0 0 1 5-5Z" stroke={color} strokeWidth={1.4} strokeDasharray="2.2 1.8" />
    <Path d="M6.7 5.4a1.4 1.4 0 1 1 1.9 1.3c-.4.2-.6.5-.6.9v.3" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    <Circle cx={8} cy={9.6} r={0.75} fill={color} />
  </Svg>
);

export const StarIcon = ({ size = 15 }: G) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path d="m8 1.6 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.4l-3.8 2 .7-4.3-3.1-3 4.3-.6Z" fill={palette.amber} />
  </Svg>
);

export const MegaphoneIcon = ({ size = 14, color = palette.amberInk }: G) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" stroke={color} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round">
    <Path d="M2 6.2h3l5-3v9.6l-5-3H2Z" fill={color} />
    <Path d="M12 5.5a3 3 0 0 1 0 5" fill="none" strokeWidth={1.5} />
  </Svg>
);

export const PhotoIcon = ({ size = 22, color = palette.placeholderInk }: G) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={3.5} y={5} width={17} height={14} rx={3} />
    <Circle cx={9} cy={10.5} r={1.6} />
    <Path d="m4 17 5-4.5 3.5 3L15 13l5 4.5" />
  </Svg>
);

const twoTone = { fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const PersonIcon = ({ size = 24, color = palette.slate }: G) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...twoTone}>
    <Circle cx={12} cy={8} r={3.5} />
    <Path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6Z" fill={color} fillOpacity={0.28} stroke="none" />
    <Path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" />
  </Svg>
);

export const ClockIcon = ({ size = 24, color = palette.slate }: G) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...twoTone}>
    <Path d="M12 12V3.5A8.5 8.5 0 0 1 20.5 12Z" fill={color} fillOpacity={0.28} stroke="none" />
    <Circle cx={12} cy={12} r={8.5} />
    <Path d="M12 7.5V12l3 1.8" />
  </Svg>
);

export const CheckIcon = ({ size = 11, color = '#FFFFFF' }: G) => (
  <Svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m2.5 6.3 2.4 2.3 4.6-5" />
  </Svg>
);

const HEART = 'M12 20s-7.5-4.6-7.5-10.2a4.2 4.2 0 0 1 7.5-2.5 4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z';

/** White heart drawn straight on a photo with a soft dark halo (works the same on iOS and Android). */
export const PhotoHeart = ({ size = 26, filled }: { size?: number; filled: boolean }) => (
  <Svg width={size} height={size} viewBox="-1 -1 26 26">
    <Path d={HEART} fill="none" stroke="#000000" strokeOpacity={0.22} strokeWidth={4.2} strokeLinejoin="round" />
    <Path d={HEART} fill={filled ? '#FFFFFF' : 'none'} stroke="#FFFFFF" strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>
);
