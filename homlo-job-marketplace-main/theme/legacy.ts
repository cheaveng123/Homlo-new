/**
 * theme.ts — shared design tokens for the Homlo app.
 * This is the module resolved by `@/theme`.
 */

export const colors = {
  // Core palette (from src/new/theme/tokensNew.ts)
  primary: '#0891B2',
  deep: '#14324A',
  teal: '#0891B2',
  deepTeal: '#14324A',
  tint: '#DCF1F6',
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
  creamInk: '#7A4300',
  clayTint: '#FDF0D9',
  danger: '#C0392B',
  dangerTint: '#FBEAE6',

  // Aliases used across existing code
  ink: '#12303C',
  mint: '#0891B2',
  greenDark: '#14324A',
  mintBloom: '#FFF1D2',
  amber: '#F5A524',
  amberDark: '#E8870F',
  red: '#C0392B',
  redSoft: '#FBEAE6',
  sub: '#6A7C84',
  pageBg: '#F3F6F5',
  cardBg: '#FFFFFF',
  line: '#E6EDEF',
  green: '#0891B2',
  mintTint: '#DCF1F6',
  amberTint: '#FDF0D9',
  chipBg: '#D5E6EA',
  mintSoft: '#DCF1F6',
  warn: '#E8870F',
  warnBg: '#FDF0D9',
  amberGlow: '#FDF0D9',
  forest900: '#14324A',
  gray: '#5D7480',
} as const;

export const font = {
  head: 'PlusJakartaSans_700Bold',
  regular: 'Inter_400Regular',
  bold: 'Inter_700Bold',
  heading: 'PlusJakartaSans_700Bold',
  body: 'Inter_400Regular',
} as const;

export const fonts = {
  heading: 'PlusJakartaSans_700Bold',
  body: 'Inter_400Regular',
  bold: 'Inter_700Bold',
} as const;

export const fontFamily = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semiBold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
  extraBold: 'PlusJakartaSans-ExtraBold',
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
} as const;

export const radii = {
  pill: 999,
  row: 18,
  systemCard: 20,
} as const;

export const spacing = {
  screenX: 20,
  listX: 16,
  rowGap: 10,
  rowPadY: 12,
  rowPadX: 14,
  rowContentGap: 12,
} as const;

export const type = {
  screenTitle: { fontFamily: fontFamily.extraBold,  fontSize: 26, letterSpacing: -0.3 },
  screenSubtitle: { fontFamily: fontFamily.regular,  fontSize: 13 },
  searchPlaceholder: { fontFamily: fontFamily.regular,  fontSize: 13 },
  tabLabel: { fontFamily: fontFamily.bold,  fontSize: 13 },
  sectionLabel: { fontFamily: fontFamily.extraBold,  fontSize: 11.5, letterSpacing: 0.5 },
  markAllRead: { fontFamily: fontFamily.bold,  fontSize: 12 },
  rowJobTitle: { fontFamily: fontFamily.bold,  fontSize: 14.5 },
  rowTime: { fontFamily: fontFamily.semiBold,  fontSize: 11 },
  rowFrom: { fontFamily: fontFamily.regular,  fontSize: 12 },
  rowSnippet: { fontFamily: fontFamily.regular,  fontSize: 13 },
  rowSnippetUnread: { fontFamily: fontFamily.bold,  fontSize: 13 },
  statusPill: { fontFamily: fontFamily.bold,  fontSize: 10.5 },
  avatarInitial44: { fontFamily: fontFamily.extraBold,  fontSize: 16 },
  avatarInitial38: { fontFamily: fontFamily.extraBold,  fontSize: 14 },
  avatarInitial26: { fontFamily: fontFamily.extraBold,  fontSize: 11 },
  chatName: { fontFamily: fontFamily.bold,  fontSize: 15 },
  chatRole: { fontFamily: fontFamily.regular,  fontSize: 12 },
  dateChip: { fontFamily: fontFamily.semiBold,  fontSize: 11.5 },
  systemCardText: { fontFamily: fontFamily.regular,  fontSize: 14, lineHeight: 19.6 },
  viewJobLabel: { fontFamily: fontFamily.bold,  fontSize: 13.5 },
  bubbleTime: { fontFamily: fontFamily.regular,  fontSize: 10.5 },
  bubbleTimeSeen: { fontFamily: fontFamily.bold,  fontSize: 10.5 },
  quickReplyChip: { fontFamily: fontFamily.bold,  fontSize: 12 },
  chatInputPlaceholder: { fontFamily: fontFamily.regular,  fontSize: 13.5 },
} as const;
