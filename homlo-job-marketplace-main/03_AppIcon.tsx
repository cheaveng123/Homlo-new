// → components/ui/AppIcon.tsx
// The app's icon set. Spec: 24px grid, thin 1.6 line, round caps + joins, no fill, one color.
// Needs: react-native-svg
import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

export type IconName =
  | 'user' | 'pin' | 'call' | 'brief' | 'clock' | 'crown' | 'lang' | 'cur' | 'sec' | 'dev' | 'pw'
  | 'chevron' | 'back' | 'gear' | 'cam' | 'edit' | 'check' | 'logout' | 'home' | 'search' | 'plus'
  | 'bell' | 'nav' | 'eye' | 'close' | 'heart' | 'laptop' | 'calendar'
  | 'bolt' | 'sliders' | 'grid' | 'cup' | 'hotel' | 'bag' | 'bike';

type P = {
  stroke: string; strokeWidth: number; strokeLinecap: 'round'; strokeLinejoin: 'round'; fill: 'none';
};

const ICONS: Record<IconName, (p: P, c: string) => React.ReactNode> = {
  user: (p) => (<><Circle cx="12" cy="8" r="4" {...p} /><Path d="M4.5 21c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" {...p} /></>),
  pin: (p) => (<><Path d="M12 21s7-6 7-11.5a7 7 0 0 0-14 0C5 15 12 21 12 21z" {...p} /><Circle cx="12" cy="9.5" r="2.5" {...p} /></>),
  call: (p) => <Path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" {...p} />,
  brief: (p) => (<><Rect x="3" y="7" width="18" height="13" rx="3" {...p} /><Path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18" {...p} /></>),
  clock: (p) => (<><Circle cx="12" cy="12" r="9" {...p} /><Path d="M12 7v5l3 2" {...p} /></>),
  crown: (p) => <Path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" {...p} />,
  lang: (p) => (<><Circle cx="12" cy="12" r="9.5" {...p} /><Path d="M7.5 8.5h7M11 7v1.5M8.5 8.5c.6 3 2.4 4.8 5.2 5.8M14 8.5c-.6 3-2.6 5-6 6.2" {...p} /></>),
  cur: (p) => (<><Path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" {...p} /><Circle cx="12" cy="12" r="4.5" {...p} /><Path d="M12 9.6v4.8M13.6 10.6h-2.2a1 1 0 0 0 0 2h1.2a1 1 0 0 1 0 2h-2.3" {...p} /></>),
  sec: (p, c) => (<><Path d="M12.5 21.5H7.5A2.5 2.5 0 0 1 5 19V5a2.5 2.5 0 0 1 2.5-2.5H11" {...p} /><Path d="M16.5 2.5l3.5 1.2v3c0 2.3-1.5 3.6-3.5 4.3-2-.7-3.5-2-3.5-4.3v-3z" {...p} /><Circle cx="10" cy="18.5" r="0.9" fill={c} /></>),
  dev: (p) => (<><Rect x="6.5" y="2.5" width="11" height="19" rx="3" {...p} /><Path d="M10.5 5.5h3M11 18.5h2" {...p} /></>),
  pw: (p, c) => (<><Path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" {...p} />{[8, 10.7, 13.3, 16].map((x) => <Circle key={x} cx={x} cy="12" r="1.15" fill={c} />)}</>),
  chevron: (p) => <Path d="M9 6l6 6-6 6" {...p} />,
  back: (p) => <Path d="M19 12H5M11 6l-6 6 6 6" {...p} />,
  gear: (p) => (<><Circle cx="12" cy="12" r="3" {...p} /><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" {...p} /></>),
  cam: (p) => (<><Path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" {...p} /><Circle cx="12" cy="13" r="3.5" {...p} /></>),
  edit: (p) => (<><Path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" {...p} /><Path d="M13.5 6.5l4 4" {...p} /></>),
  check: (p) => <Path d="M5 12.5l4.5 4.5L19 7.5" {...p} />,
  logout: (p) => <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" {...p} />,
  home: (p) => (<><Path d="M4 11l8-7 8 7v9H4z" {...p} /><Path d="M10 20v-6h4v6" {...p} /></>),
  search: (p) => (<><Circle cx="11" cy="11" r="7" {...p} /><Path d="M20 20l-4-4" {...p} /></>),
  plus: (p) => <Path d="M12 5v14M5 12h14" {...p} />,
  bell: (p) => (<><Path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z" {...p} /><Path d="M10 21h4" {...p} /></>),
  nav: (p) => <Path d="M12 3l8 18-8-4-8 4z" {...p} />,
  eye: (p) => (<><Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" {...p} /><Circle cx="12" cy="12" r="3" {...p} /></>),
  close: (p) => <Path d="M6 6l12 12M18 6L6 18" {...p} />,
  heart: (p) => <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...p} />,
  laptop: (p) => (<><Rect x="4" y="5" width="16" height="11" rx="2" {...p} /><Path d="M2.5 19h19" {...p} /></>),
  calendar: (p) => (<><Rect x="3.5" y="5" width="17" height="15.5" rx="3" {...p} /><Path d="M3.5 10h17M8 3v4M16 3v4" {...p} /></>),
  bolt: (p) => <Path d="M13 3L5 13h6l-1 8 8-11h-6z" {...p} />,
  sliders: (p) => (<><Path d="M4 7h10M18 7h2M4 17h2M10 17h10" {...p} /><Circle cx="16" cy="7" r="2" {...p} /><Circle cx="8" cy="17" r="2" {...p} /></>),
  grid: (p) => (<><Rect x="3" y="3" width="7.5" height="7.5" rx="2" {...p} /><Rect x="13.5" y="3" width="7.5" height="7.5" rx="2" {...p} /><Rect x="3" y="13.5" width="7.5" height="7.5" rx="2" {...p} /><Rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" {...p} /></>),
  cup: (p) => <Path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 9h2a2 2 0 0 1 0 4h-2M8 4v1.5M12 4v1.5" {...p} />,
  hotel: (p, c) => (<><Rect x="5" y="3" width="14" height="18" rx="2" {...p} /><Path d="M10 21v-4h4v4" {...p} />{[[9, 8], [15, 8], [9, 12], [15, 12]].map(([x, y]) => <Circle key={`${x}${y}`} cx={x} cy={y} r="0.9" fill={c} />)}</>),
  bag: (p) => <Path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" {...p} />,
  bike: (p) => (<><Circle cx="6" cy="16" r="3" {...p} /><Circle cx="18" cy="16" r="3" {...p} /><Path d="M6 16l4-8h4l4 8M10 8H8" {...p} /></>),
};

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function AppIcon({ name, size = 24, color = '#0E3B2E', strokeWidth = 1.6 }: Props) {
  const p: P = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {ICONS[name](p, color)}
    </Svg>
  );
}
