import { Platform, type ViewStyle } from 'react-native';

/**
 * Explore palette: same navy structure as the rest of the app, with the secondary
 * sunshine amber leading this screen (warm wash, indicator, highlights).
 */
export const EX = {
  amber: '#F5A524',
  amberDeep: '#E8870F',
  amberText: '#A8620B',
  cream: '#FFF3DA',
  creamSoft: '#FFF8EA',
  navy: '#14324A',
  ink: '#12303C',
  muted: '#6A7C84',
  line: '#E6EDEF',
  icon: '#4A6072',
  slate: '#5D7480',
  cyan: '#0891B2',
  cyanDeep: '#0B6F8A',
  white: '#FFFFFF',
  page: '#FFFFFF',
} as const;

export const shadowCard: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: '#12303C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.09, shadowRadius: 22 },
  default: { elevation: 3 },
}) as ViewStyle;

export const shadowSearch: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: '#12303C', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.13, shadowRadius: 26 },
  default: { elevation: 6 },
}) as ViewStyle;

export const shadowSoft: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: '#12303C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 10 },
  default: { elevation: 2 },
}) as ViewStyle;
