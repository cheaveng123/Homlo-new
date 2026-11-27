import { Platform, type ViewStyle } from 'react-native';
import { Easing } from 'react-native-reanimated';

/** Employer Dashboard palette. Cyan + white/navy lead; amber is the single spice. */
export const dash = {
  cyan: '#0891B2',
  cyanDeep: '#0B6F8A',
  cyanSoft: '#8BD3E3',
  navy: '#14324A',
  amber: '#F5A524',
  amberDeep: '#E8870F',
  coral: '#EF6A4C',
  violet: '#6A5FC1',
  ink: '#12303C',
  muted: '#6A7C84',
  line: '#E6EDEF',
  surface: '#FFFFFF',
  headerSolid: '#0A87A5',
  navIcon: '#69777A',
} as const;

/** Header content height below the status bar (padding 22 + 40 row + 12). */
export const HEADER_H = 74;
export const NAV_BASE_H = 64;

export const easeInOut = Easing.bezier(0.4, 0, 0.2, 1);
export const easeOut = Easing.out(Easing.cubic);

export const cardShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: '#0B4F63', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14 },
  default: { elevation: 2 },
}) as ViewStyle;
