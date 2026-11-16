// Exact values from the finalized home screen design. Do not approximate —
// every hex/px here was picked deliberately, copy them as literals.

export const colors = {
  bg: '#FFFFFF',
  mint: '#0F9D62',
  mintTint: '#E7F7EF',
  textPrimary: '#1A1A1A',
  textSecondary: '#717171',
  border: '#EBEBEB',
  divider: '#F0F0F0',
  chipBg: '#F2F2F2',
  white: '#FFFFFF',

  // Homlo mint design-system tokens (home-page mockup). The soft mint bloom
  // uses `mintBloom` to avoid clashing with the legacy `mint` brand green.
  green: '#0F6E56',
  greenDark: '#0B5443',
  greenTint10: 'rgba(15,110,86,0.10)',
  greenTint30: 'rgba(15,110,86,0.30)',
  greenTint35: 'rgba(15,110,86,0.35)',
  mintBloom: '#96D1BE',

  ink: '#12211D',
  sub: '#5C6B67',
  line: '#E7EEEC',
  cardBg: '#FFFFFF',
  pageBg: '#F6F8F7',

  overlayScrim: 'rgba(255,255,255,0.55)', // fallback tint behind the light blur
  salaryOnDark: '#B7F2D9',
  locationOnDark: 'rgba(255,255,255,0.85)',

  // Warm amber accent (the app's non-mint highlight — matches the
  // urgent/popular-category pills on the category & search-detail screens).
  amber: '#F5A623',
  amberDark: '#C97A16',
  amberTint: 'rgba(245,166,35,0.14)',
  amberGlow: 'rgba(245,166,35,0.30)',
};

export const radius = {
  searchBar: 16,
  guideCard: 14,
  jobImage: 26, // deliberately large — this was a specific ask, don't shrink it
  pill: 999,
  circle: 999,
  brandMark: 8,
};

// Corner radius per element type in the redesigned feed — mirrors the mockup.
export const radii = {
  featured: 23,
  twoCol: 19,
  standard: 19,
  ticket: 19,
  large: 22,
  small: 18,
  overlay: 15,
  searchBar: 19,
  finderBtn: 16,
  finderArrow: 15, // circular — half of the 30px diameter
  quickTile: 14,
};

export const spacing = {
  screenX: 20,
  headerPadTop: 18,
  headerPadBottom: 22,
  afterLocRow: 16,
  afterSearchBar: 18,
  afterFinderBtn: 20,
  sectionTop: 22,
  afterDivider: 10,
  afterTitle: 12,
  rowGap: 12,
  cardGap: 12,
};

// Load both families once at the app root (see README) and reference these
// constants everywhere. Mirror of the category/search-detail typographic
// system: Plus Jakarta Sans for headings, Inter for labels, meta and
// placeholders.
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',

  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
};

export const type = {
  cityName: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.ink },
  finderLabel: { fontFamily: fontFamily.bold, fontSize: 15.5, color: colors.ink },
  searchPlaceholder: { fontFamily: fontFamily.interMedium, fontSize: 15.5, color: colors.sub },
  quickLabel: { fontFamily: fontFamily.interSemiBold, fontSize: 11.5, color: colors.sub },
  sectionTitle: { fontFamily: fontFamily.extraBold, fontSize: 18, color: colors.ink },

  jobTitle: { fontFamily: fontFamily.bold, fontSize: 15.5, color: '#FFFFFF', lineHeight: 20 },
  jobTitleLight: { fontFamily: fontFamily.bold, fontSize: 15.5, color: colors.ink, lineHeight: 20 },
  salary: { fontFamily: fontFamily.interBold, fontSize: 13, color: colors.salaryOnDark },
  salaryLight: { fontFamily: fontFamily.interBold, fontSize: 13, color: colors.green },
  location: { fontFamily: fontFamily.interMedium, fontSize: 12, color: colors.locationOnDark },
  locationLight: { fontFamily: fontFamily.interMedium, fontSize: 12, color: colors.sub },
};