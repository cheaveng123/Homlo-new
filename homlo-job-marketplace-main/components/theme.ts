// Exact values from the finalized home screen design. Do not approximate —
// every hex/px here was picked deliberately, copy them as literals.

export const colors = {
  bg: '#FFFFFF',
  mint: '#0891B2',
  mintTint: '#DCF1F6',
  textPrimary: '#12303C',
  textSecondary: '#6A7C84',
  border: '#E6EDEF',
  divider: '#F0F0F0',
  chipBg: '#EEF3F4',
  white: '#FFFFFF',
};

export const radius = {
  searchBar: 16,
  guideCard: 14,
  jobImage: 26, // deliberately large — this was a specific ask, don't shrink it
  pill: 999,
  circle: 999,
  brandMark: 8,
};

// Load Plus Jakarta Sans once at the app root (see README) and reference
// this constant everywhere instead of the system font.
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
};