import { Platform, ViewStyle } from 'react-native';

/** Lagoon & Sunrise — exact values, no substitutions. */
export const colors = {
  teal: '#0891B2',
  deepTeal: '#14324A',
  night: '#14324A',
  tint: '#DCF1F6',
  tintMid: '#8BD3E3',
  bg: '#F3F6F5',
  card: '#FFFFFF',
  border: '#E6EDEF',
  track: '#D5E6EA',
  text: '#12303C',
  muted: '#6A7C84',
  sun: '#F5A524',
  clay: '#E8870F',
  cream: '#FFF1D2',
  creamInk: '#7A4300',
  eyebrowInk: '#8A4B00',
  danger: '#C0392B',
  dangerTint: '#FBEAE6',
  white: '#FFFFFF',
  dusk: '#6B4FA0',
  clayTint: '#FDF0D9',
  clayInk: '#A8620B',
  creamLine: '#E3C98A',
  surface: '#FFFFFF',
  line: '#E6EDEF',
  chipBg: '#D5E6EA',
  textPrimary: '#12303C',
  textSecondary: '#6A7C84',
  sub: '#6A7C84',
  mint: '#0891B2',
  mintTint: '#DCF1F6',
  green: '#0891B2',
  greenDark: '#14324A',
  mintBloom: '#96D1BE',
  forest: '#14324A',
  mint100: '#DCF1F6',
  primary: '#0891B2',
  deep: '#14324A',
  red: '#C0392B',
  redSoft: '#FDECEC',
  warn: '#E8870F',
  warnBg: '#FDF0D9',
  amber: '#F5A524',
  amberDark: '#F5A524',
  amberTint: '#FDF0D9',
  amberGlow: '#FDF0D9',
} as const;

export type AccentKey = 'lagoon' | 'sunrise' | 'clay' | 'dusk';

/** Accent families for tinted surfaces, icon discs, badges. */
export const accents: Record<AccentKey, { bg: string; mid: string; ink: string }> = {
  lagoon: { bg: '#DCF1F6', mid: '#8BD3E3', ink: '#14324A' },
  sunrise: { bg: '#FFF1D2', mid: '#FFE0A0', ink: '#7A4300' },
  clay: { bg: '#FDF0D9', mid: '#F8CDB6', ink: '#A8620B' },
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