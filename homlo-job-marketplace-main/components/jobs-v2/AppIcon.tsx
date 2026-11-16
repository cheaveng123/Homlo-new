import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from './theme';

/**
 * Thin-line icon set: 24px grid, 1.6 stroke, round caps and joins.
 * If your app already has an AppIcon, keep yours and map these names to it.
 */
export type IconName =
  | 'back' | 'x' | 'search' | 'pin' | 'clock' | 'brief' | 'cal' | 'laptop' | 'check' | 'cam'
  | 'plus' | 'minus' | 'filt' | 'heart' | 'flame' | 'star' | 'cup' | 'code' | 'cart' | 'book'
  | 'shield' | 'truck' | 'leaf' | 'pen' | 'chart'
  | 'hotel' | 'bag' | 'bike' | 'grid' | 'sun' | 'bolt' | 'sliders'
  | 'dots' | 'chevron' | 'message' | 'send' | 'image' | 'upload' | 'globe' | 'home' | 'sort'
  | 'trash' | 'locate' | 'building' | 'info' | 'calendar';

const shapes: Record<IconName, React.ReactElement> = {
  back: <Path d="M15 5l-7 7 7 7" />,
  x: <Path d="M6 6l12 12M18 6L6 18" />,
  search: (
    <>
      <Circle cx="11" cy="11" r="6" />
      <Path d="M16 16l4 4" />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10z" />
      <Circle cx="12" cy="11" r="2" />
    </>
  ),
  clock: (
    <>
      <Circle cx="12" cy="12" r="8" />
      <Path d="M12 8v4l3 2" />
    </>
  ),
  brief: (
    <>
      <Rect x="4" y="8" width="16" height="11" rx="3" />
      <Path d="M9 8V6h6v2" />
    </>
  ),
  cal: (
    <>
      <Rect x="4" y="6" width="16" height="14" rx="3" />
      <Path d="M4 11h16M9 4v4M15 4v4" />
    </>
  ),
  laptop: (
    <>
      <Rect x="5" y="6" width="14" height="9" rx="2" />
      <Path d="M3 19h18" />
    </>
  ),
  check: <Path d="M5 12.5l4.5 4.5L19 7" />,
  cam: (
    <>
      <Rect x="3" y="7" width="18" height="13" rx="3" />
      <Circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M5 12h14" />,
  filt: <Path d="M4 7h16M7 12h10M10 17h4" />,
  heart: <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  flame: <Path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />,
  star: <Path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7z" />,
  cup: <Path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 10h1.5a2 2 0 0 1 0 4H16M8 4v2M12 4v2" />,
  code: <Path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />,
  cart: (
    <>
      <Path d="M3 5h2.5l2 10h9.5l2-7.5H7" />
      <Circle cx="9" cy="19" r="1.3" />
      <Circle cx="17" cy="19" r="1.3" />
    </>
  ),
  book: <Path d="M4 5.5h6.5a2 2 0 0 1 2 2V19a2 2 0 0 0-2-2H4zM20 5.5h-6.5a2 2 0 0 0-2 2V19a2 2 0 0 1 2-2H20z" />,
  shield: <Path d="M12 4l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V7z" />,
  truck: (
    <>
      <Path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
      <Circle cx="7" cy="18" r="1.6" />
      <Circle cx="17" cy="18" r="1.6" />
    </>
  ),
  leaf: <Path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14zM5 19l8-8" />,
  pen: <Path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3" />,
  chart: <Path d="M5 19V9M12 19V5M19 19v-7" />,
  hotel: (
    <>
      <Path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5h3a2 2 0 0 1 2 2v7" />
      <Path d="M2 21h20" />
      <Path d="M8 7h2M8 11h2M8 15h2" />
    </>
  ),
  bag: <Path d="M6 8h12l1 12H5zM9 8V6a3 3 0 0 1 6 0v2" />,
  bike: (
    <>
      <Circle cx="6" cy="17" r="3.2" />
      <Circle cx="18" cy="17" r="3.2" />
      <Path d="M6 17l5-7h7l-3 7M10 9h4" />
    </>
  ),
  grid: (
    <>
      <Rect x="4" y="4" width="7" height="7" rx="1.5" />
      <Rect x="13" y="4" width="7" height="7" rx="1.5" />
      <Rect x="4" y="13" width="7" height="7" rx="1.5" />
      <Rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  sun: (
    <>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </>
  ),
  bolt: <Path d="M13 3L5 13h6l-1 8 8-10h-6z" />,
  dots: (
    <>
      <Circle cx="12" cy="5.5" r="1.5" />
      <Circle cx="12" cy="12" r="1.5" />
      <Circle cx="12" cy="18.5" r="1.5" />
    </>
  ),
  chevron: <Path d="M9 6l6 6-6 6" />,
  message: <Path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9l-5 4z" />,
  send: <Path d="M3 11.5L20 4l-5.5 16-3.5-7z" />,
  image: (
    <>
      <Rect x="3" y="4" width="18" height="16" rx="3" />
      <Circle cx="9" cy="10" r="1.6" />
      <Path d="M4.5 17.5l4.5-4.5 3.5 3.5 3-3 4 4" />
    </>
  ),
  upload: (
    <>
      <Path d="M12 16V5M12 5l-4 4m4-4l4 4" />
      <Path d="M5 20h14" />
    </>
  ),
  globe: (
    <>
      <Circle cx="12" cy="12" r="8" />
      <Path d="M4 12h16M12 4c2.6 2.6 2.6 13.4 0 16M12 4c-2.6 2.6-2.6 13.4 0 16" />
    </>
  ),
  home: <Path d="M4 11l8-7 8 7v9h-6.5v-6h-3v6H4z" />,
  sort: (
    <>
      <Path d="M7 5v14m0 0l-3-3m3 3l3-3M17 19V5m0 0l-3 3m3-3l3 3" />
    </>
  ),
  trash: (
    <>
      <Path d="M5 7h14M9 7V5h6v2" />
      <Path d="M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </>
  ),
  locate: (
    <>
      <Circle cx="12" cy="12" r="7" />
      <Circle cx="12" cy="12" r="2" />
      <Path d="M12 2.5v2.5M12 19v2.5M2.5 12h2.5M19 12h2.5" />
    </>
  ),
  building: (
    <>
      <Path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
      <Path d="M19 21H3M8 8h3M8 12h3M8 16h3" />
    </>
  ),
  info: (
    <>
      <Circle cx="12" cy="12" r="8" />
      <Path d="M12 11v5" />
      <Path d="M12 7.5v.5" />
    </>
  ),
  calendar: (
    <>
      <Rect x="4" y="6" width="16" height="14" rx="3" />
      <Path d="M4 11h16M9 4v4M15 4v4" />
    </>
  ),
  sliders: (
    <>
      <Path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h9M17 17h3" />
      <Circle cx="15" cy="7" r="2" />
      <Circle cx="9" cy="12" r="2" />
      <Circle cx="15" cy="17" r="2" />
    </>
  ),
};

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number; fill?: string };

export function AppIcon({ name, size = 20, color = colors.text, strokeWidth = 1.6, fill = 'none' }: Props) {
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
