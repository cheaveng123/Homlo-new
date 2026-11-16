// components/ui/AppIcon.tsx
// The app's icon set. Spec: 24px grid, thin 1.6 line, round caps + joins, no fill, one color.
// Needs: react-native-svg
import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';

export type IconName =
  | 'user' | 'pin' | 'call' | 'brief' | 'clock' | 'crown' | 'lang' | 'cur' | 'sec' | 'dev' | 'pw'
  | 'chevron' | 'back' | 'gear' | 'cam' | 'edit' | 'check' | 'logout' | 'home' | 'search' | 'plus'
  | 'bell' | 'nav' | 'eye' | 'close' | 'heart' | 'laptop' | 'calendar'
  | 'arrow' | 'circle-check' | 'building' | 'mail' | 'lock' | 'eye-off' | 'sliders' | 'sort'
  | 'star' | 'target' | 'grid' | 'dots' | 'trash' | 'undo' | 'maximize' | 'pause' | 'play'
  | 'share' | 'image' | 'image-off' | 'alert' | 'refresh' | 'zap' | 'upload' | 'map' | 'locate'
  | 'send' | 'message' | 'users' | 'chart' | 'card' | 'bag' | 'grad' | 'sun' | 'globe' | 'info'
  | 'bolt' | 'cup' | 'hotel' | 'bike';

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
  arrow: (p) => <Path d="M4 12h14M13 6l6 6-6 6" {...p} />,
  'circle-check': (p) => (<><Circle cx="12" cy="12" r="9" {...p} /><Path d="M8.5 12.5l2.5 2.5 4.5-4.5" {...p} /></>),
  building: (p) => (<><Rect x="4" y="3" width="16" height="18" rx="2" {...p} /><Path d="M9 21V9h6v12M4 7h16M9 12h.01M12 12h.01M15 12h.01M12 16h.01" {...p} /></>),
  mail: (p) => (<><Rect x="3" y="5" width="18" height="14" rx="2" {...p} /><Path d="m3 7 9 6 9-6" {...p} /></>),
  lock: (p) => (<><Rect x="3" y="11" width="18" height="10" rx="2" {...p} /><Path d="M7 11V7a5 5 0 0 1 10 0v4" {...p} /></>),
  'eye-off': (p) => (<><Path d="M10.6 5.2A8.5 8.5 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2 2.9M6.6 6.6A13.2 13.2 0 0 0 2 12s3.5 7 10 7a8.5 8.5 0 0 0 4.4-1.1" {...p} /><Path d="M2 2l20 20" {...p} /><Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" {...p} /></>),
  sliders: (p) => (<><Path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" {...p} /></>),
  sort: (p) => <Path d="M8 3v18M8 3L4 7M8 3l4 4M16 21V3M16 21l4-4M16 21l-4-4" {...p} />,
  star: (p) => <Path d="M12 3l2.7 5.47 6.04.88-4.37 4.26 1.03 6.02L12 16.9l-5.4 2.73 1.03-6.02L3.26 9.35l6.04-.88z" {...p} />,
  target: (p) => (<><Circle cx="12" cy="12" r="9" {...p} /><Circle cx="12" cy="12" r="5" {...p} /><Circle cx="12" cy="12" r="1.4" {...p} /></>),
  grid: (p) => (<><Rect x="3" y="3" width="7.5" height="7.5" rx="1.5" {...p} /><Rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" {...p} /><Rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" {...p} /><Rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" {...p} /></>),
  dots: (p, c) => (<><Circle cx="5" cy="12" r="1.4" fill={c} /><Circle cx="12" cy="12" r="1.4" fill={c} /><Circle cx="19" cy="12" r="1.4" fill={c} /></>),
  trash: (p) => (<><Path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M6 7l1 13h10l1-13M10 11v6M14 11v6" {...p} /></>),
  undo: (p) => (<><Path d="M8 5L4 9l4 4" {...p} /><Path d="M4 9h11a5 5 0 0 1 0 10h-3" {...p} /></>),
  maximize: (p) => <Path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" {...p} />,
  pause: (p) => (<><Rect x="6" y="4" width="4" height="16" rx="1" {...p} /><Rect x="14" y="4" width="4" height="16" rx="1" {...p} /></>),
  play: (p) => <Path d="M7 4.5v15l12-7.5z" {...p} />,
  share: (p) => (<><Circle cx="18" cy="5" r="3" {...p} /><Circle cx="6" cy="12" r="3" {...p} /><Circle cx="18" cy="19" r="3" {...p} /><Path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" {...p} /></>),
  image: (p) => (<><Rect x="3" y="4" width="18" height="16" rx="3" {...p} /><Path d="M21 15l-4.5-4.5L7 20" {...p} /><Circle cx="8.5" cy="9.5" r="1.8" {...p} /></>),
  'image-off': (p) => (<><Path d="M2 2l20 20" {...p} /><Path d="M10.4 10.4a2 2 0 0 0-2.8 2.8" {...p} /><Path d="m9.1 9.1 7.3 7.3" {...p} /><Path d="M13 21H5a2 2 0 0 1-2-2V8" {...p} /><Path d="M21 21H8" {...p} /><Path d="M21 21V8a2 2 0 0 0-2-2H8" {...p} /><Path d="M8 3h9a2 2 0 0 1 2 2v9" {...p} /></>),
  alert: (p) => (<><Circle cx="12" cy="12" r="9" {...p} /><Path d="M12 8v4M12 16h.01" {...p} /></>),
  refresh: (p) => (<><Path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" {...p} /><Path d="M21 3v5h-5" {...p} /><Path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" {...p} /><Path d="M8 16H3v5" {...p} /></>),
  zap: (p) => <Path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" {...p} />,
  upload: (p) => (<><Path d="M12 15V4M12 4L8 8M12 4l4 4" {...p} /><Path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" {...p} /></>),
  map: (p) => (<><Path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" {...p} /><Path d="M9 4v14M15 6v14" {...p} /></>),
  locate: (p) => (<><Circle cx="12" cy="12" r="7" {...p} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" {...p} /></>),
  send: (p) => <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" {...p} />,
  message: (p) => <Path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...p} />,
  users: (p) => (<><Circle cx="9" cy="8" r="3.5" {...p} /><Path d="M2.5 21c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" {...p} /><Path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 15.8c2 .8 3.5 2.4 3.5 5.2" {...p} /></>),
  chart: (p) => <Path d="M3 17l6-6 4 4 8-8M16 7h6v6" {...p} />,
  card: (p) => (<><Rect x="2.5" y="5" width="19" height="14" rx="3" {...p} /><Path d="M2.5 10h19M6 15h4" {...p} /></>),
  bag: (p) => (<><Path d="M6 8h12l-1 12H7z" {...p} /><Path d="M9 8V6a3 3 0 0 1 6 0v2" {...p} /></>),
  grad: (p) => (<><Path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z" {...p} /><Path d="M22 10v6" {...p} /><Path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" {...p} /></>),
  sun: (p) => (<><Circle cx="12" cy="12" r="4" {...p} /><Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" {...p} /></>),
  globe: (p) => (<><Circle cx="12" cy="12" r="9" {...p} /><Path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3z" {...p} /></>),
  info: (p) => (<><Circle cx="12" cy="12" r="9" {...p} /><Path d="M12 11v5M12 8h.01" {...p} /></>),
  bolt: (p) => <Path d="M13 3L5 13h6l-1 8 8-11h-6z" {...p} />,
  cup: (p) => <Path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 9h2a2 2 0 0 1 0 4h-2M8 4v1.5M12 4v1.5" {...p} />,
  hotel: (p, c) => (<><Rect x="5" y="3" width="14" height="18" rx="2" {...p} /><Path d="M10 21v-4h4v4" {...p} />{[[9, 8], [15, 8], [9, 12], [15, 12]].map(([x, y]) => <Circle key={`${x}${y}`} cx={x} cy={y} r="0.9" fill={c} />)}</>),
  bike: (p) => (<><Circle cx="6" cy="16" r="3" {...p} /><Circle cx="18" cy="16" r="3" {...p} /><Path d="M6 16l4-8h4l4 8M10 8H8" {...p} /></>),
};

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number; style?: StyleProp<ViewStyle> };

export function AppIcon({ name, size = 24, color = '#0E3B2E', strokeWidth = 1.6, style }: Props) {
  const p: P = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {ICONS[name](p, color)}
    </Svg>
  );
}