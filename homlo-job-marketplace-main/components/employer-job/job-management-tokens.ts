// job-management-tokens — design tokens (colors, fonts, shadows) for the employer Job Management + Edit Job screens
import { Platform, ViewStyle } from 'react-native';

export const colors = {
  forest: '#0E3B2E',
  mint: '#0F9D62',
  mintLight: '#2FC985',
  tint: '#E6F7EE',
  bg: '#F6F8F7',
  white: '#FFFFFF',
  muted: '#6B7C74',
  red: '#C0392B',
  redTint: '#FBE7E4',
  redBorder: '#F2D4D0',
  line: '#E3ECE7',
  dash: '#D5E3DB',
  amberBg: '#FFF1DC',
  amberText: '#B7791F',
  scrim: 'rgba(14,59,46,0.55)',
  toggleOff: '#CBD7D1',
};

// Loaded via @expo-google-fonts (Plus Jakarta Sans = headings, Inter = body/labels)
export const font = {
  h800: 'PlusJakartaSans_800ExtraBold',
  h700: 'PlusJakartaSans_700Bold',
  b400: 'Inter_400Regular',
  b500: 'Inter_500Medium',
  b600: 'Inter_600SemiBold',
};

const s = (color: string, y: number, opacity: number, radius: number, elevation: number): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: { shadowColor: color, shadowOffset: { width: 0, height: y }, shadowOpacity: opacity, shadowRadius: radius },
    default: { elevation },
  }) as ViewStyle;

export const shadows = {
  card: s(colors.forest, 10, 0.12, 15, 8),
  boost: { ...s(colors.mint, 8, 0.35, 10, 6), backgroundColor: colors.mint } as ViewStyle,
  menu: s(colors.forest, 14, 0.28, 17, 14),
};