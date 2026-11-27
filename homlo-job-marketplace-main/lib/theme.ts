import { colors as appColors, font } from "@/theme";

export const colors = {
  ...appColors,
  text: appColors.text,
  bg: appColors.bg,
  card: appColors.card,
  border: appColors.border,
  muted: appColors.muted,
  mutedText: appColors.muted,
  mintSoft: appColors.tint,
  red: appColors.danger,
  redSoft: appColors.dangerTint,
  // Legacy aliases
  ink: appColors.text,
  pageBg: appColors.bg,
  cardBg: appColors.card,
  line: appColors.border,
  chipBg: appColors.track,
  textPrimary: appColors.text,
  textSecondary: appColors.muted,
  sub: appColors.muted,
  mint: appColors.teal,
  mintTint: appColors.tint,
  green: appColors.teal,
  greenDark: appColors.deepTeal,
  mintBloom: appColors.tint,
  forest: appColors.deepTeal,
  mint100: appColors.tint,
  primary: appColors.teal,
  deep: appColors.deepTeal,
  white: appColors.white,
  danger: appColors.danger,
  dangerTint: appColors.dangerTint,
  warn: appColors.clay,
  warnBg: appColors.clayTint,
  amber: appColors.sun,
  amberDark: appColors.sun,
  amberTint: appColors.clayTint,
  amberGlow: appColors.clayTint,
};

export const fonts = {
  heading: font.head || "PlusJakartaSans_700Bold",
  body: font.regular || "Inter_400Regular",
  bold: font.bold || "Inter_700Bold",
} as const;

export const fontFamily = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extraBold: "PlusJakartaSans_800ExtraBold",
  interRegular: "Inter_400Regular",
  interMedium: "Inter_500Medium",
  interSemiBold: "Inter_600SemiBold",
  interBold: "Inter_700Bold",
};
