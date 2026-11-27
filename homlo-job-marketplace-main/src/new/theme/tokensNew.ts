import { ViewStyle } from 'react-native';

export const colorsNew = {
  primary: '#0891B2',
  deep: '#14324A',
  gradStart: '#0B7F99',
  tint: '#DCF1F6',
  tint2: '#8BD3E3',
  bg: '#F3F6F5',
  card: '#FFFFFF',
  white: '#FFFFFF',
  border: '#E6EDEF',
  text: '#12303C',
  muted: '#6A7C84',
  track: '#D5E6EA',
  sun: '#F5A524',
  clay: '#E8870F',
  cream: '#FFF1D2',
  cream2: '#FFE0A0',
  creamInk: '#7A4300',
  creamEyebrow: '#8A4B00',
  creamStrong: '#4A2900',
  clayTint: '#FDF0D9',
  clayTint2: '#F8DDB0',
  clayInk: '#A8620B',
  dusk: '#EEF3F4',
  dusk2: '#D5E6EA',
  duskInk: '#14324A',
  danger: '#C0392B',
  dangerTint: '#FBEAE6',
} as const;

export type AccentNew = 'lagoon' | 'sunrise' | 'clay' | 'dusk';
export const accentNew: Record<AccentNew, { bg: string; bg2: string; ink: string }> = {
  lagoon: { bg: colorsNew.tint, bg2: colorsNew.tint2, ink: colorsNew.deep },
  sunrise: { bg: colorsNew.cream, bg2: colorsNew.cream2, ink: colorsNew.creamInk },
  clay: { bg: colorsNew.clayTint, bg2: colorsNew.clayTint2, ink: colorsNew.clayInk },
  dusk: { bg: colorsNew.dusk, bg2: colorsNew.dusk2, ink: colorsNew.duskInk },
};

export const spaceNew = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const layoutNew = { screenX: 16, sectionGap: 24, touchMin: 44 } as const;
export const radiusNew = { chip: 14, tile: 16, card: 22, hero: 24, sheet: 26, pill: 999 } as const;

export const shadowNew: Record<'sm' | 'lg', ViewStyle> = {
  sm: { shadowColor: '#12303C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 22, elevation: 2 },
  lg: { shadowColor: colorsNew.deep, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 28, elevation: 8 },
};

// px scale: 12 caption, 13 meta, 14 body, 16 title, 17 section, 20 header, 24 hero
export const typeScaleNew = {
  caption: { size: 12, line: 16 },
  meta: { size: 13, line: 18 },
  body: { size: 14, line: 20 },
  title: { size: 16, line: 22 },
  section: { size: 17, line: 24 },
  header: { size: 20, line: 28 },
  hero: { size: 24, line: 32 },
} as const;
export type TextVariantNew = keyof typeof typeScaleNew;
