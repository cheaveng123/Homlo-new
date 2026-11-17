/**
 * theme/tokens.ts
 *
 * Single source of truth for the Inbox / Chat redesign.
 * Every value here is copied 1:1 from the approved HTML mockup —
 * do not eyeball or "round" these when wiring up screens.
 * If a spacing/size/radius value isn't in here, ask before inventing one.
 */

export const colors = {
  white: '#FFFFFF',
  card: '#FAFCFB',

  mint100: '#DCF1F6',
  mint300: '#8BD3E3',
  mint500: '#0891B2',
  mint700: '#0B6F8A',

  forest900: '#14324A',
  gray: '#6A7C84',

  coral100: '#FDF0D9',
  coral500: '#F5A524',

  sand100: '#F3F6F5',
  sand400: '#C9BFA8',

  amber100: '#FDF0D9',
  amber500: '#F5A524',

  line: '#E6EDEF',

  // status-pill text colors (not swatches above — matched from mockup)
  appliedText: '#A8620B',
  interviewText: '#0B6F8A',
} as const;

export const radius = {
  pill: 999,
  row: 18,
  systemCard: 20,
} as const;

export const spacing = {
  screenX: 20, // horizontal padding used by header / search / tabs
  listX: 16, // horizontal padding of the message list itself
  rowGap: 10, // gap between message rows
  rowPadY: 12,
  rowPadX: 14,
  rowContentGap: 12, // gap between avatar and text block
} as const;

/**
 * Font family: match this to whatever you load 'Plus Jakarta Sans' as
 * in your app (e.g. via expo-font). Fall back to system font until
 * the custom font is confirmed loaded, so nothing renders in Helvetica
 * and then "pops" once the font swaps in.
 */
export const fontFamily = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semiBold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
  extraBold: 'PlusJakartaSans-ExtraBold',
} as const;

/**
 * Every text style used across Inbox + Chat, named by where it's used.
 * fontWeight is kept alongside fontFamily on purpose: if the custom
 * font fails to load, RN still bolds correctly with the system font.
 */
export const type = {
  screenTitle: { fontFamily: fontFamily.extraBold, fontWeight: '800' as const, fontSize: 26, letterSpacing: -0.3 },
  screenSubtitle: { fontFamily: fontFamily.regular, fontWeight: '400' as const, fontSize: 13 },

  searchPlaceholder: { fontFamily: fontFamily.regular, fontWeight: '400' as const, fontSize: 13 },

  tabLabel: { fontFamily: fontFamily.bold, fontWeight: '700' as const, fontSize: 13 },

  sectionLabel: { fontFamily: fontFamily.extraBold, fontWeight: '800' as const, fontSize: 11.5, letterSpacing: 0.5 },
  markAllRead: { fontFamily: fontFamily.bold, fontWeight: '700' as const, fontSize: 12 },

  rowJobTitle: { fontFamily: fontFamily.bold, fontWeight: '700' as const, fontSize: 14.5 },
  rowTime: { fontFamily: fontFamily.semiBold, fontWeight: '600' as const, fontSize: 11 },
  rowFrom: { fontFamily: fontFamily.regular, fontWeight: '400' as const, fontSize: 12 },
  rowSnippet: { fontFamily: fontFamily.regular, fontWeight: '400' as const, fontSize: 13 },
  rowSnippetUnread: { fontFamily: fontFamily.bold, fontWeight: '700' as const, fontSize: 13 },
  statusPill: { fontFamily: fontFamily.bold, fontWeight: '700' as const, fontSize: 10.5 },

  avatarInitial44: { fontFamily: fontFamily.extraBold, fontWeight: '800' as const, fontSize: 16 },
  avatarInitial38: { fontFamily: fontFamily.extraBold, fontWeight: '800' as const, fontSize: 14 },
  avatarInitial26: { fontFamily: fontFamily.extraBold, fontWeight: '800' as const, fontSize: 11 },

  chatName: { fontFamily: fontFamily.bold, fontWeight: '700' as const, fontSize: 15 },
  chatRole: { fontFamily: fontFamily.regular, fontWeight: '400' as const, fontSize: 12 },

  dateChip: { fontFamily: fontFamily.semiBold, fontWeight: '600' as const, fontSize: 11.5 },
  systemCardText: { fontFamily: fontFamily.regular, fontWeight: '400' as const, fontSize: 14, lineHeight: 19.6 }, // 1.4 line-height
  viewJobLabel: { fontFamily: fontFamily.bold, fontWeight: '700' as const, fontSize: 13.5 },
  bubbleTime: { fontFamily: fontFamily.regular, fontWeight: '400' as const, fontSize: 10.5 },
  bubbleTimeSeen: { fontFamily: fontFamily.bold, fontWeight: '700' as const, fontSize: 10.5 },

  quickReplyChip: { fontFamily: fontFamily.bold, fontWeight: '700' as const, fontSize: 12 },
  chatInputPlaceholder: { fontFamily: fontFamily.regular, fontWeight: '400' as const, fontSize: 13.5 },
} as const;

/** Fixed component dimensions referenced by more than one file. */
export const sizes = {
  bellButton: 38,
  filterButton: 38,
  iconButtonChat: 34,
  avatarRow: 46,
  avatarChatHeader: 38,
  avatarSystemCard: 26,
  unreadBadge: 14,
  clipButton: 38,
  sendButton: 42,
  fab: 52,
} as const;
