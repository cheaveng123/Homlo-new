import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colorsNew } from '../theme/tokensNew';

/**
 * AppIconNew: HOMLO tier C utility set, drawn in-house.
 * 24px grid, 1.8 line, round caps and joins, rounded corners (~2.5).
 * House signature: one small solid detail per icon where it carries meaning
 * (pin dot, clock hub, briefcase clasp, calendar day); it takes `accent` when given.
 */
type Draw = (a: string) => React.ReactNode;
const dot = (cx: number, cy: number, r: number, a: string) => <Circle cx={cx} cy={cy} r={r} fill={a} stroke="none" />;

const G = {
  home: (a) => (<><Path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" /><Path d="M9.5 20.5v-5h5v5" />{dot(12, 11.2, 1.3, a)}</>),
  search: () => (<><Circle cx="11" cy="11" r="6.5" /><Path d="m16 16 4.5 4.5" /><Path d="M8.3 9.4a3 3 0 0 1 2.3-2" strokeWidth={1.4} /></>),
  plus: () => <Path d="M12 4.5v15M4.5 12h15" />,
  minus: () => <Path d="M4.5 12h15" />,
  bell: () => (<><Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.8h-15Z" /><Path d="M10 20.3a2.2 2.2 0 0 0 4 0" /></>),
  user: () => (<><Circle cx="12" cy="8" r="4" /><Path d="M4.5 20.5c.6-3.9 3.6-6 7.5-6s6.9 2.1 7.5 6" /></>),
  sliders: (a) => (<><Path d="M4 7h9M17.5 7H20M4 12h3M11.5 12H20M4 17h10.5M19 17h1" />{dot(15.2, 7, 2.1, a)}{dot(9.2, 12, 2.1, a)}{dot(16.8, 17, 2.1, a)}</>),
  pin: (a) => (<><Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />{dot(12, 10, 2.3, a)}</>),
  heart: () => <Path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />,
  brief: (a) => (<><Rect x="3" y="7.5" width="18" height="12.5" rx="3" /><Path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 13h7.5M13.5 13H21" /><Rect x="10.5" y="11.8" width="3" height="2.6" rx="0.8" fill={a} stroke="none" /></>),
  back: () => <Path d="M14.5 5.5 8 12l6.5 6.5" />,
  chev: () => <Path d="M9.5 5.5 16 12l-6.5 6.5" />,
  down: () => <Path d="M5.5 9.5 12 16l6.5-6.5" />,
  clock: (a) => (<><Circle cx="12" cy="12" r="8.5" /><Path d="M12 7.5V12l3 2" />{dot(12, 12, 1.3, a)}</>),
  file: () => (<><Path d="M14 3H7.5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7.5Z" /><Path d="M14 3v4.5h4.5M9 12.5h6M9 16h4" /></>),
  x: () => <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  send: () => (<><Path d="M20.5 3.5 3.9 10.1a.6.6 0 0 0 0 1.1l6.3 2.6 2.6 6.3a.6.6 0 0 0 1.1 0Z" /><Path d="M10.2 13.8 20.5 3.5" /></>),
  cal: (a) => (<><Rect x="3.5" y="5" width="17" height="15.5" rx="3" /><Path d="M8 3v4M16 3v4M3.5 10h17" /><Rect x="13.5" y="13.5" width="3.2" height="3.2" rx="0.9" fill={a} stroke="none" /></>),
  mon: () => (<><Rect x="3" y="4" width="18" height="12.5" rx="2.5" /><Path d="M9 20.5h6M12 16.5v4" /></>),
  hist: (a) => (<><Path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><Path d="M3.8 3.8v3.6h3.6M12 8v4.2l2.6 1.6" />{dot(12, 12.2, 1.2, a)}</>),
  trend: () => (<><Path d="M3.5 16.5 9 11l3.5 3.5 8-8" /><Path d="M15 6.5h5.5V12" /></>),
  ul: () => <Path d="M17 17 7 7M7 15.5V7h8.5" />,
  sort: () => <Path d="M8 19.5v-15M4.5 8 8 4.5 11.5 8M16 4.5v15M12.5 16l3.5 3.5 3.5-3.5" />,
  map: (a) => (<><Path d="M3.5 6.5 9 4l6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5Z" /><Path d="M9 4v13.5M15 6.5V20" />{dot(12, 11, 1.3, a)}</>),
  bld: () => (<><Rect x="5" y="3" width="14" height="18" rx="2.5" /><Path d="M9 7.5h1.5M13.5 7.5H15M9 11.5h1.5M13.5 11.5H15M10 21v-4h4v4" /></>),
  arr: () => <Path d="M4.5 12h15M13.5 6l6 6-6 6" />,
  chk: () => <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  dots: (a) => (<>{dot(5.5, 12, 1.7, a)}{dot(12, 12, 1.7, a)}{dot(18.5, 12, 1.7, a)}</>),
  users: () => (<><Circle cx="9" cy="8" r="3.5" /><Path d="M2.5 20c.5-3.4 3.2-5.3 6.5-5.3s6 1.9 6.5 5.3M16 4.7a3.5 3.5 0 0 1 0 6.6M17.5 14.9c2.2.6 3.6 2.4 4 5.1" /></>),
  upload: () => (<><Path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" /><Path d="M4.5 15v3a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-3" /></>),
} satisfies Record<string, Draw>;

export type AppIconNameNew = keyof typeof G;

type Props = { name: AppIconNameNew; size?: number; color?: string; strokeWidth?: number; filled?: boolean; accent?: string };

export function AppIconNew({ name, size = 22, color = colorsNew.deep, strokeWidth = 1.8, filled = false, accent }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {G[name](accent ?? color)}
    </Svg>
  );
}
