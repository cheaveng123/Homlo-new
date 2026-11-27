import Svg, { Path, Circle, Rect, Line } from "react-native-svg";

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function SearchIcon({ size = 18, color = "#5C6B67", strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function PinIcon({ size = 13, color = "#FFFFFF", strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="10" r="2.4" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function ClockIcon({ size = 17, color = "#0B6F8A", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 7v5l3.5 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BriefcaseIcon({ size = 17, color = "#0B6F8A", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="8" width="18" height="12" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="3" y1="13" x2="21" y2="13" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function CalendarIcon({ size = 17, color = "#0B6F8A", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="8" y1="3" x2="8" y2="7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="16" y1="3" x2="16" y2="7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function HomeIcon({ size = 17, color = "#0B6F8A", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 11.5 12 4l8 7.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}