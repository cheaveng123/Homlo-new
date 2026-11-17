import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from './theme';

/**
 * HOMLO outline set (tier B/C), drawn in-house: 24px grid, 1.8 line, round caps
 * and joins, rounded corners, one color. Each glyph carries one small custom
 * detail (basket slats, mug steam, keypad dots) so it reads as ours, not a stock set.
 */
export type IconName =
  | 'back' | 'x' | 'search' | 'pin' | 'clock' | 'brief' | 'cal' | 'laptop' | 'check' | 'cam'
  | 'plus' | 'minus' | 'filt' | 'heart' | 'flame' | 'star' | 'cup' | 'code' | 'cart' | 'book'
  | 'shield' | 'truck' | 'leaf' | 'pen' | 'chart'
  | 'hotel' | 'bag' | 'bike' | 'grid' | 'sun' | 'bolt' | 'sliders'
  | 'dots' | 'chevron' | 'message' | 'send' | 'image' | 'upload' | 'globe' | 'home' | 'sort'
  | 'trash' | 'locate' | 'building' | 'info' | 'calendar'
  | 'helmet' | 'coins' | 'calc' | 'megaphone' | 'headset' | 'utensils' | 'clipboard';

const calendar = (
  <>
    <Rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <Path d="M8 3v4M16 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
  </>
);

const shapes: Record<IconName, React.ReactElement> = {
  back: <Path d="M14.5 5.5 8 12l6.5 6.5" />,
  x: <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  search: (<><Circle cx="11" cy="11" r="6.5" /><Path d="m16 16 4.5 4.5M8.4 9.4a3 3 0 0 1 2.2-2" /></>),
  pin: (<><Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><Circle cx="12" cy="10" r="2.3" /></>),
  clock: (<><Circle cx="12" cy="12" r="8.5" /><Path d="M12 7.5V12l3 2" /></>),
  brief: (<><Rect x="3" y="7.5" width="18" height="12.5" rx="3" /><Path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 13h7.5M13.5 13H21" /><Rect x="10.5" y="11.8" width="3" height="2.6" rx="0.8" /></>),
  cal: calendar,
  calendar,
  laptop: (<><Rect x="4.5" y="4.5" width="15" height="10.5" rx="2" /><Path d="M2.5 18.5h19M3.6 18.5l1.4-3.5h14l1.4 3.5" /></>),
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  cam: (<><Path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z" /><Circle cx="12" cy="13.8" r="3.5" /><Path d="M17.8 11.2h.01" /></>),
  plus: <Path d="M12 4.5v15M4.5 12h15" />,
  minus: <Path d="M4.5 12h15" />,
  filt: <Path d="M4 7h16M7 12h10M10 17h4" />,
  heart: <Path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />,
  flame: (<><Path d="M12 3c.5 3.2 3.4 4.8 4.8 7.6 1.6 3 1.2 6.6-1.3 8.8A6.3 6.3 0 0 1 5.6 15.3c-.2-2.6 1-4.5 2.5-5.9.2 1.4.9 2.4 2 2.9C9.6 8.6 10.6 5.4 12 3Z" /><Path d="M12 14c.9 1.1 1.7 2 1.7 3.2a1.7 1.7 0 0 1-3.4 0c0-1.1.8-1.9 1.7-3.2Z" /></>),
  star: <Path d="M12 3.8l2.5 5.1 5.6.8-4.1 4 1 5.6L12 16.6l-5 2.7 1-5.6-4.1-4 5.6-.8Z" />,
  cup: (<><Path d="M4.5 9.5h11v4.5a4.5 4.5 0 0 1-4.5 4.5H9A4.5 4.5 0 0 1 4.5 14Z" /><Path d="M15.5 10.8h1.4a2.2 2.2 0 0 1 0 4.4h-1.4M8 3.8c-.6.8-.6 1.6 0 2.4M11.5 3.8c-.6.8-.6 1.6 0 2.4M3.5 21h14" /></>),
  code: (<><Rect x="3" y="4.5" width="18" height="15" rx="3" /><Path d="M3 8.5h18M9.5 12l-2 2 2 2M14.5 12l2 2-2 2" /></>),
  // basket: woven slats + two handles (reference-style)
  cart: (<><Path d="M3.5 9.5h17l-1.6 8.6a2 2 0 0 1-2 1.6H7.1a2 2 0 0 1-2-1.6Z" /><Path d="M8 9.5l3-5M16 9.5l-3-5M9 13v3.5M12 13v3.5M15 13v3.5" /></>),
  book: <Path d="M12 6.5C10.3 5.2 7.8 4.6 4 4.8V18c3.8-.2 6.3.4 8 1.7 1.7-1.3 4.2-1.9 8-1.7V4.8c-3.8-.2-6.3.4-8 1.7ZM12 6.5v13.2" />,
  shield: (<><Path d="M12 3.5l7 2.8v5.2c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6.3Z" /><Path d="m9 12 2.2 2.2L15 10.3" /></>),
  truck: (<><Path d="M4.5 6.5h8a1 1 0 0 1 1 1v8.5h-10V7.5a1 1 0 0 1 1-1ZM13.5 9.5h4l3 3.5V16h-7" /><Circle cx="7" cy="17.8" r="1.8" /><Circle cx="17" cy="17.8" r="1.8" /></>),
  leaf: <Path d="M5 19c0-8.3 5.2-13.4 14-14 0 8.8-5.1 14-13.4 14ZM5.5 18.5 14 10" />,
  pen: (<><Path d="M4.5 19.5l.9-3.9L15.8 5.2a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8.4 18.6Z" /><Path d="M14 7l3 3" /></>),
  chart: (<><Rect x="5" y="11" width="3.2" height="6.5" rx="1" /><Rect x="10.4" y="6.5" width="3.2" height="11" rx="1" /><Rect x="15.8" y="9" width="3.2" height="8.5" rx="1" /><Path d="M3.5 20.5h17" /></>),
  hotel: <Path d="M4 20.5V5.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v15M15 10h3a2 2 0 0 1 2 2v8.5M2.5 20.5h19M8 7.5h3M8 11h3M8 14.5h3M8.5 20.5V18h2v2.5" />,
  bag: (<><Path d="M5.5 8h13l-.9 11a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8Z" /><Path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" /></>),
  bike: (<><Circle cx="6" cy="16.5" r="3.5" /><Circle cx="18" cy="16.5" r="3.5" /><Path d="M6 16.5l3.5-7h5.5l3 7M12 16.5l3-7M8 9.5h3M13.5 6.5h2.5" /></>),
  grid: (<><Rect x="4" y="4" width="7" height="7" rx="2" /><Rect x="13" y="4" width="7" height="7" rx="2" /><Rect x="4" y="13" width="7" height="7" rx="2" /><Rect x="13" y="13" width="7" height="7" rx="3.5" /></>),
  sun: (<><Circle cx="12" cy="12" r="4" /><Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></>),
  bolt: <Path d="M13.5 3 5.5 13.2h6l-1 7.8 8-10.2h-6Z" />,
  dots: (<><Circle cx="12" cy="5.5" r="1.5" /><Circle cx="12" cy="12" r="1.5" /><Circle cx="12" cy="18.5" r="1.5" /></>),
  chevron: <Path d="M9.5 5.5 16 12l-6.5 6.5" />,
  message: (<><Path d="M4 7.5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9.5L5 20v-3.6a3 3 0 0 1-1-2.4Z" /><Path d="M8.5 9.5h7M8.5 12.5h4.5" /></>),
  send: (<><Path d="M20.5 3.5 3.9 10.1a.6.6 0 0 0 0 1.1l6.3 2.6 2.6 6.3a.6.6 0 0 0 1.1 0Z" /><Path d="M10.2 13.8 20.5 3.5" /></>),
  image: (<><Rect x="3" y="4.5" width="18" height="15" rx="3" /><Circle cx="15.5" cy="9.5" r="1.8" /><Path d="m3.5 17 5.5-5 4 3.5 2.5-2 4.5 4" /></>),
  upload: (<><Path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" /><Path d="M4.5 15v3a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-3" /></>),
  globe: (<><Circle cx="12" cy="12" r="8.5" /><Path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17" /></>),
  home: (<><Path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" /><Path d="M9.5 20.5v-5h5v5" /></>),
  sort: <Path d="M8 19.5v-15M4.5 8 8 4.5 11.5 8M16 4.5v15M12.5 16l3.5 3.5 3.5-3.5" />,
  trash: (<><Path d="M4.5 7h15M9.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V7" /><Path d="M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12M10 11v5.5M14 11v5.5" /></>),
  locate: (<><Circle cx="12" cy="12" r="7" /><Circle cx="12" cy="12" r="2.2" /><Path d="M12 2.5v2.5M12 19v2.5M2.5 12h2.5M19 12h2.5" /></>),
  building: (<><Rect x="5" y="3" width="14" height="18" rx="2.5" /><Path d="M9 7.5h1.5M13.5 7.5H15M9 11.5h1.5M13.5 11.5H15M10 21v-4h4v4" /></>),
  info: (<><Circle cx="12" cy="12" r="8.5" /><Path d="M12 11v5M12 7.8h.01" /></>),
  sliders: (<><Path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h9M17 17h3" /><Circle cx="15" cy="7" r="2" /><Circle cx="9" cy="12" r="2" /><Circle cx="15" cy="17" r="2" /></>),
  // category glyphs
  helmet: (<><Path d="M4.5 16.5a7.5 7.5 0 0 1 15 0" /><Path d="M3 16.5h18v1.6a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 18.1ZM10 9.5V6.8h4v2.7M8 11.5v2M16 11.5v2" /></>),
  coins: (<><Path d="M4 7.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5S13.3 5 10 5 4 6.1 4 7.5ZM4 7.5v4c0 1.4 2.7 2.5 6 2.5M16 7.5V9" /><Circle cx="15.5" cy="15" r="4.5" /><Path d="M15.5 13v4" /></>),
  calc: (<><Rect x="5" y="3" width="14" height="18" rx="2.5" /><Rect x="8" y="6" width="8" height="3.5" rx="1" /><Path d="M8.5 13.5h.01M12 13.5h.01M15.5 13.5h.01M8.5 17h.01M12 17h.01M15.5 17h.01" /></>),
  megaphone: (<><Path d="M3.5 9.8h3l8-4.5v13.4l-8-4.5h-3a1 1 0 0 1-1-1v-2.4a1 1 0 0 1 1-1Z" /><Path d="M6.5 14.2 7.8 19h2.4l-1-4.2M18 9.5a3.5 3.5 0 0 1 0 5M20.5 7a7 7 0 0 1 0 10" /></>),
  headset: (<><Path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" /><Rect x="3.5" y="13" width="3.6" height="5.6" rx="1.6" /><Rect x="16.9" y="13" width="3.6" height="5.6" rx="1.6" /><Path d="M18.7 18.6c0 1.4-1.6 2.4-4 2.4h-1.2" /></>),
  // fork + spoon (reference-style)
  utensils: (<><Path d="M6.5 3.5V8a2 2 0 0 0 2 2 2 2 0 0 0 2-2V3.5M8.5 3.5v17" /><Path d="M16.5 20.5v-8M16.5 12.5c-1.9 0-3-1.9-3-4.5s1.1-4.5 3-4.5 3 1.9 3 4.5-1.1 4.5-3 4.5Z" /></>),
  clipboard: (<><Rect x="5" y="4.5" width="14" height="16.5" rx="2.5" /><Path d="M9 3.5h6v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1ZM8.5 11h7M8.5 14.5h7M8.5 18h4" /></>),
};

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number; fill?: string };

export function AppIcon({ name, size = 20, color = colors.text, strokeWidth = 1.8, fill = 'none' }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes[name]}
    </Svg>
  );
}
