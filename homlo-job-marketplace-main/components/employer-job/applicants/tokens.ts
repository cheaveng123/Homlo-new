import { Platform, type ViewStyle } from 'react-native';

/** New applicants page palette (employer dashboard family: cyan + navy lead, amber is the spice). */
export const AP = {
  cyan: '#0891B2',
  cyanDeep: '#0B6F8A',
  cyanSoft: '#3FC1DB',
  navy: '#14324A',
  amber: '#F5A524',
  amberSoft: '#FFC765',
  amberDeep: '#A8620B',
  tint: '#DCF1F6',
  bg: '#F3F6F5',
  line: '#E6EDEF',
  ink: '#12303C',
  muted: '#6A7C84',
  faint: '#9AABB1',
  white: '#FFFFFF',
  danger: '#C0392B',
  dangerTint: '#FBEAE6',
} as const;

/** Job containers: tile gradients in a fixed order so neighbours never match. */
export const JOB_TILES: [string, string][] = [
  ['#0BA5C8', '#0B7F99'],
  ['#21486A', '#14324A'],
  ['#FFB938', '#E8870F'],
  ['#0891B2', '#0891B2'],
  ['#5E86A8', '#3D6283'],
];

export const cardShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: '#0B4F63', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.09, shadowRadius: 18 },
  default: { elevation: 3 },
}) as ViewStyle;

export const liftShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: '#06425A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12 },
  default: { elevation: 5 },
}) as ViewStyle;
