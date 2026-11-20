// Custom line glyphs for the Category detail page.
// viewBox 0 0 24 24, stroke 1.9, round caps and joins.
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type G = { size?: number; color?: string; filled?: boolean };

function Base({ size = 24, color = '#14324A', children }: G & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export const BackGlyph = (p: G) => <Base {...p}><Path d="M15 5l-7 7 7 7" /></Base>;

export const MoreGlyph = (p: G) => (
  <Base {...p}>
    <Circle cx={6} cy={12} r={1.2} />
    <Circle cx={12} cy={12} r={1.2} />
    <Circle cx={18} cy={12} r={1.2} />
  </Base>
);

export const ChevronDownGlyph = (p: G) => <Base {...p}><Path d="M7 10l5 5 5-5" /></Base>;

export const BookmarkGlyph = ({ filled, color = '#14324A', ...p }: G) => (
  <Base {...p} color={color}>
    <Path d="M7 4h10v16l-5-4-5 4z" fill={filled ? color : 'none'} />
  </Base>
);

export const BriefcaseGlyph = (p: G) => <Base {...p}><Path d="M4 8h16v11H4zM9 8V5h6v3M4 13h16" /></Base>;

export const ClockGlyph = (p: G) => (
  <Base {...p}>
    <Circle cx={12} cy={12} r={8} />
    <Path d="M12 8v4l3 2" />
  </Base>
);

export const LaptopGlyph = (p: G) => <Base {...p}><Path d="M5 6h14v9H5zM3 18h18" /></Base>;

export const PinGlyph = (p: G) => (
  <Base {...p}>
    <Path d="M12 21s6-5.2 6-10a6 6 0 10-12 0c0 4.8 6 10 6 10z" />
    <Circle cx={12} cy={11} r={2} />
  </Base>
);

export const CheckGlyph = (p: G) => <Base {...p}><Path d="M5 12l4 4 10-10" /></Base>;

export const SearchGlyph = (p: G) => (
  <Base {...p}>
    <Circle cx={11} cy={11} r={6.5} />
    <Path d="M16 16l4 4" />
  </Base>
);

export const FilterGlyph = (p: G) => (
  <Base {...p}>
    <Path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <Circle cx={16} cy={7} r={2} />
    <Circle cx={8} cy={17} r={2} />
  </Base>
);
