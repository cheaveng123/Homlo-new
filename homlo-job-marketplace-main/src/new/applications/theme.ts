// Lagoon & Sunrise design tokens. Light only. Do not add colours.
export const colors = {
  teal: '#0E7C86',
  deep: '#073B42',
  tint: '#D8F0EE',
  tint2: '#B5E2DF',
  page: '#F4F8F8',
  card: '#FFFFFF',
  border: '#E4ECEC',
  track: '#D9EAEA',
  text: '#14272B',
  muted: '#58696B',
  sun: '#F5B52B',
  clay: '#C4531F',
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
  shadowColor: '#0E7C86',
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