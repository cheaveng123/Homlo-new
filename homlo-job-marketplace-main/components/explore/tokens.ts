// Explore redesign tokens: "Lagoon & Sunrise".
// If the app already has a tokens file, keep these VALUES and map them onto the existing names.
import { Platform, TextStyle } from 'react-native';

export const c = {
  teal: '#0891B2',
  deep: '#14324A',
  deepStart: '#0B7F99',
  tint: '#DCF1F6',
  tint2: '#8BD3E3',
  page: '#F3F6F5',
  card: '#FFFFFF',
  line: '#E6EDEF',
  track: '#D5E6EA',
  text: '#12303C',
  muted: '#6A7C84',
  sun: '#F5A524',
  clay: '#E8870F',
  cream: '#FFF1D2',
  cream2: '#FFE0A0',
  creamInk: '#7A4300',
  creamEyebrow: '#8A4B00',
  clayTint: '#FDF0D9',
  clayTint2: '#F8DDB0',
  clayInk: '#A8620B',
  purple: '#6B4FA0', // logo/avatar solid only
  white: '#FFFFFF',
} as const;

export type Tint = { bg: string; ink: string };
export const tints = {
  lagoon: { bg: c.tint, ink: c.deep },
  sunrise: { bg: c.cream, ink: c.creamInk },
  clay: { bg: c.clayTint, ink: c.clayInk },
} satisfies Record<string, Tint>;

export const sp = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const r = { chip: 14, tile: 16, card: 22, hero: 24, sheet: 26, pill: 999 } as const;

// Install: @expo-google-fonts/plus-jakarta-sans, @expo-google-fonts/inter, @expo-google-fonts/noto-sans-khmer
// Khmer: use the matching Noto Sans Khmer weight for each family below and check line heights.
export const fonts = {
  heading: 'PlusJakartaSans_700Bold',
  headingXL: 'PlusJakartaSans_800ExtraBold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
} as const;

export const type: Record<string, TextStyle> = {
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  meta: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  title: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 22 },
  section: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 24 },
  header: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 28 },
  hero: { fontFamily: fonts.headingXL, fontSize: 24, lineHeight: 32 },
};

// Soft, teal-tinted shadow (Android uses elevation).
export const shadow = {
  soft: Platform.select({
    ios: { shadowColor: c.teal, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
    default: { elevation: 4, shadowColor: c.teal },
  }) as object,
  float: Platform.select({
    ios: { shadowColor: c.teal, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
    default: { elevation: 6, shadowColor: c.teal },
  }) as object,
};
