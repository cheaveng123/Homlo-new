import { Platform, ViewStyle } from 'react-native';

/** Lagoon & Sunrise — exact values, no substitutions. */
export const colors = {
  teal: '#0E7C86',
  deepTeal: '#073B42',
  night: '#052E34',
  tint: '#D8F0EE',
  tintMid: '#B5E2DF',
  bg: '#F4F8F8',
  card: '#FFFFFF',
  border: '#E4ECEC',
  track: '#D9EAEA',
  text: '#14272B',
  muted: '#58696B',
  sun: '#F5B52B',
  clay: '#C4531F',
  cream: '#FFF1D2',
  creamInk: '#7A4300',
  eyebrowInk: '#8A4B00',
  danger: '#C0392B',
  dangerTint: '#FBEAE6',
  white: '#FFFFFF',
  dusk: '#6B4FA0',
  clayTint: '#FDE6DA',
  clayInk: '#8A3A12',
  creamLine: '#E3C98A',
  surface: '#FFFFFF',
  line: '#E4ECEC',
  chipBg: '#D9EAEA',
  textPrimary: '#14272B',
  textSecondary: '#58696B',
  sub: '#58696B',
  mint: '#0E7C86',
  mintTint: '#D8F0EE',
  green: '#0E7C86',
  greenDark: '#073B42',
  mintBloom: '#96D1BE',
  forest: '#073B42',
  mint100: '#D8F0EE',
  primary: '#0E7C86',
  deep: '#073B42',
  red: '#C0392B',
  redSoft: '#FDECEC',
  warn: '#C4531F',
  warnBg: '#FDE6DA',
  amber: '#F5B52B',
  amberDark: '#F5B52B',
  amberTint: '#FDE6DA',
  amberGlow: '#FDE6DA',
} as const;

export type AccentKey = 'lagoon' | 'sunrise' | 'clay' | 'dusk';

/** Accent families for tinted surfaces, icon discs, badges. */
export const accents: Record<AccentKey, { bg: string; mid: string; ink: string }> = {
  lagoon: { bg: '#D8F0EE', mid: '#B5E2DF', ink: '#073B42' },
  sunrise: { bg: '#FFF1D2', mid: '#FFE0A0', ink: '#7A4300' },
  clay: { bg: '#FDE6DA', mid: '#F8CDB6', ink: '#8A3A12' },
  dusk: { bg: '#EDE6F7', mid: '#D9CBEE', ink: '#4A3578' },
};

/** Solid colors for logo / avatar tiles. */
export const solids = [colors.teal, colors.deepTeal, colors.clay, colors.dusk] as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const SIDE = 16;

export const radius = { chip: 14, tile: 16, card: 20, hero: 24, sheet: 28, pill: 999 } as const;

/** Font family names as loaded by @expo-google-fonts (map to your familyForWeight helper if you prefer). */
export const font = {
  head: 'PlusJakartaSans_800ExtraBold',
  headBold: 'PlusJakartaSans_700Bold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Type scale (px): 12 caption, 13 meta, 14 body, 16 title, 17 section, 20 header, 24 hero. */
export const fs = { caption: 12, meta: 13, body: 14, title: 16, section: 17, header: 20, hero: 24 } as const;

/** Soft teal-tinted shadow (iOS shadow + Android elevation). */
export const shadow: ViewStyle =
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: colors.teal,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
    },
    android: { elevation: 3, shadowColor: colors.teal },
    default: {},
  }) ?? {};