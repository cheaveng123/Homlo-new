// Explore redesign tokens: "Lagoon & Sunrise".
// If the app already has a tokens file, keep these VALUES and map them onto the existing names.
import { Platform, TextStyle } from 'react-native';

export const c = {
  teal: '#0E7C86',
  deep: '#073B42',
  deepStart: '#052E34',
  tint: '#D8F0EE',
  tint2: '#B5E2DF',
  page: '#F4F8F8',
  card: '#FFFFFF',
  line: '#E4ECEC',
  track: '#D9EAEA',
  text: '#14272B',
  muted: '#58696B',
  sun: '#F5B52B',
  clay: '#C4531F',
  cream: '#FFF1D2',
  cream2: '#FFE0A0',
  creamInk: '#7A4300',
  creamEyebrow: '#8A4B00',
  clayTint: '#FDE6DA',
  clayTint2: '#F8CDB6',
  clayInk: '#8A3A12',
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
export const r = { chip: 14, tile: 16, card: 20, hero: 24, sheet: 28, pill: 999 } as const;

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
