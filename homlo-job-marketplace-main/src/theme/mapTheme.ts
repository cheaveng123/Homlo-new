import { colors, fontFamily, radii } from "@/theme";

export const MAP_THEME = {
  primary: colors.primary,
  primarySoft: colors.tint,
  onPrimary: colors.white,
  surface: colors.card,
  text: colors.text,
  textMuted: colors.muted,
  border: colors.border,
  userDot: colors.primary,
  routeCasing: colors.white,
  shadow: "rgba(0,0,0,0.16)",
  fontFamily: {
    regular: fontFamily.regular,
    medium: fontFamily.medium,
    semiBold: fontFamily.semiBold,
    bold: fontFamily.bold,
  },
  radii: {
    card: radii.systemCard,
    pill: radii.pill,
    row: radii.row,
  },
} as const;

export type MapTheme = typeof MAP_THEME;
