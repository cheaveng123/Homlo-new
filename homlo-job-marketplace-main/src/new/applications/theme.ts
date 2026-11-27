// Lagoon & Sunrise design tokens. Light only. Do not add colours.
export const colors = {
  teal: '#0891B2',
  deep: '#14324A',
  tint: '#DCF1F6',
  tint2: '#8BD3E3',
  page: '#F3F6F5',
  card: '#FFFFFF',
  border: '#E6EDEF',
  track: '#D5E6EA',
  text: '#12303C',
  muted: '#6A7C84',
  sun: '#F5A524',
  clay: '#E8870F',
  cream: '#FFF1D2',
  ink: '#7A4300',
  white: '#FFFFFF',
} as const;

// MAP THESE to the font names the project ALREADY loads (one place only).
export const fonts = {
  heading: 'PlusJakartaSans_700Bold',
  headingHeavy: 'PlusJakartaSans_800ExtraBold',
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
} as const;

export const radii = { badge: 10, chip: 14, tile: 16, card: 20, hero: 24, pill: 999 } as const;
export const SIDE_MARGIN = 16;

export const cardShadow = {
  shadowColor: '#0891B2',
  shadowOpacity: 0.1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

// Backward-compatible aliases for existing application files still referencing theme.ts
export const appColors = {
  waitingBg: colors.cream,
  waitingInk: colors.ink,
  acceptedBg: colors.teal,
  acceptedInk: colors.white,
  declinedBg: colors.page,
  declinedInk: colors.muted,
  bg: colors.page,
  surface: colors.card,
  border: colors.border,
  divider: colors.border,
  primary: colors.teal,
  primaryInk: colors.white,
  muted: colors.muted,
  ink: colors.text,
  subtle: colors.muted,
  fallbackBg: colors.tint,
  fallbackInk: colors.deep,
  tint: colors.tint,
  tint2: colors.tint2,
  danger: colors.clay,
  dangerTint: colors.page,
  cream: colors.cream,
  creamInk: colors.ink,
  deep: colors.deep,
  card: colors.card,
  white: colors.white,
  track: colors.track,
  text: colors.text,
  sun: colors.sun,
  clay: colors.clay,
} as const;

export const appRadius = { ...radii, pill: radii.pill } as const;
export const appShadow = { sm: cardShadow } as const;