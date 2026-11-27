import { Platform, type ViewStyle } from 'react-native';
import { Easing } from 'react-native-reanimated';

/**
 * HOMLO design tokens: the single source for the approved dashboard style.
 * Color rule 60/30/10: cyan + white/navy lead; amber is the single spice.
 * Coral and violet live only inside multi-tone icons that already use them.
 */
export const palette = {
  cyan: '#0891B2',
  cyanDeep: '#0B6F8A',
  cyanSoft: '#8BD3E3',
  cyanTint: '#DCF1F6',
  navy: '#14324A',
  amber: '#F5A524',
  amberDeep: '#E8870F',
  amberInk: '#A8620B',
  amberTint: '#FDF0D9',
  coral: '#EF6A4C',
  violet: '#6A5FC1',
  ink: '#12303C',
  muted: '#6A7C84',
  line: '#E6EDEF',
  surface: '#FFFFFF',
  page: '#F3F6F5',
  pillIdle: '#EEF3F4',
  slate: '#5D7480',
  field: '#F2F6F8',
  placeholderA: '#EEF5F7',
  placeholderB: '#D2E1E6',
  placeholderInk: '#6D8C97',
  iconIdle: '#69777A',
  danger: '#C0392B',
  dangerTint: '#FBEAE6',
  heroA: '#0B7F99',
  heroB: '#0891B2',
  heroC: '#0A86A4',
  heroGlow: '#2DBAD4',
  headerSolid: '#0A87A5',
} as const;

export const radii = { input: 14, tile: 16, card: 22, sheet: 26, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 32, gutter: 16 } as const;
export const durations = { fast: 150, base: 200, select: 300, enter: 600, count: 900, fill: 1000, shimmer: 1400, loop: 5000 } as const;
export const easings = {
  out: Easing.out(Easing.cubic),
  inOut: Easing.bezier(0.4, 0, 0.2, 1),
} as const;

/** Card shadow `0 8 22 rgba(18,48,60,.08)`; Android uses elevation. */
export const shadows: Record<'card' | 'lift' | 'nav', ViewStyle> = {
  card: Platform.select<ViewStyle>({
    ios: { shadowColor: '#12303C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 22 },
    default: { elevation: 2 },
  }) as ViewStyle,
  lift: Platform.select<ViewStyle>({
    ios: { shadowColor: '#06425A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16 },
    default: { elevation: 6 },
  }) as ViewStyle,
  nav: { shadowColor: '#0B3A48', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 12 },
};

/** Hero gradient: 165deg #0B7F99 -> #0891B2 (60%) -> #0A86A4. */
export const heroGradient = {
  colors: [palette.heroA, palette.heroB, palette.heroC] as const,
  locations: [0, 0.6, 1] as const,
  start: { x: 0.37, y: 0 },
  end: { x: 0.63, y: 1 },
};
