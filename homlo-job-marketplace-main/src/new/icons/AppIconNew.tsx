import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colorsNew } from '../theme/tokensNew';

/** AppIconNew: 24px grid, 1.6 line, round caps and joins, no fill, one color. */
const G = {
  home: () => (<><Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><Path d="M9 22V12h6v10" /></>),
  search: () => (<><Circle cx="11" cy="11" r="8" /><Path d="M21 21l-4.3-4.3" /></>),
  plus: () => <Path d="M12 5v14M5 12h14" />,
  minus: () => <Path d="M5 12h14" />,
  bell: () => (<><Path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><Path d="M13.7 21a2 2 0 01-3.4 0" /></>),
  user: () => (<><Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><Circle cx="12" cy="7" r="4" /></>),
  sliders: () => <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  pin: () => (<><Path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><Circle cx="12" cy="10" r="3" /></>),
  heart: () => <Path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 000-7.8z" />,
  brief: () => (<><Rect x="2" y="7" width="20" height="14" rx="2" /><Path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></>),
  back: () => <Path d="M15 18l-6-6 6-6" />,
  chev: () => <Path d="M9 18l6-6-6-6" />,
  down: () => <Path d="M6 9l6 6 6-6" />,
  clock: () => (<><Circle cx="12" cy="12" r="10" /><Path d="M12 6v6l4 2" /></>),
  file: () => (<><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Path d="M14 2v6h6M16 13H8M16 17H8" /></>),
  x: () => <Path d="M18 6L6 18M6 6l12 12" />,
  send: () => <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />,
  cal: () => (<><Rect x="3" y="4" width="18" height="18" rx="2" /><Path d="M16 2v4M8 2v4M3 10h18" /></>),
  mon: () => (<><Rect x="2" y="3" width="20" height="14" rx="2" /><Path d="M8 21h8M12 17v4" /></>),
  hist: () => (<><Path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.7L3 8" /><Path d="M3 3v5h5M12 7v5l3 2" /></>),
  trend: () => (<><Path d="M23 6l-9.5 9.5-5-5L1 18" /><Path d="M17 6h6v6" /></>),
  ul: () => <Path d="M17 17L7 7M7 17V7h10" />,
  sort: () => <Path d="M7 15l5 5 5-5M7 9l5-5 5 5" />,
  map: () => (<><Path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z" /><Path d="M8 2v16M16 6v16" /></>),
  bld: () => (<><Path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18z" /><Path d="M6 12H4a2 2 0 00-2 2v6a2 2 0 002 2h2M18 9h2a2 2 0 012 2v9a2 2 0 01-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4" /></>),
  arr: () => <Path d="M5 12h14M12 5l7 7-7 7" />,
  chk: () => <Path d="M20 6L9 17l-5-5" />,
  dots: () => (<><Circle cx="5" cy="12" r="1" /><Circle cx="12" cy="12" r="1" /><Circle cx="19" cy="12" r="1" /></>),
  users: () => (<><Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><Circle cx="9" cy="7" r="4" /><Path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" /></>),
  upload: () => <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
} as const;

export type AppIconNameNew = keyof typeof G;

type Props = { name: AppIconNameNew; size?: number; color?: string; strokeWidth?: number; filled?: boolean };

export function AppIconNew({ name, size = 22, color = colorsNew.deep, strokeWidth = 1.6, filled = false }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {G[name]()}
    </Svg>
  );
}
