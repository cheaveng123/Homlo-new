// job-management-tokens — design tokens (colors, fonts, shadows) for the employer Job Management + Edit Job screens
import { Platform, ViewStyle } from 'react-native';

export const colors = {
  forest: '#14272B',
  mint: '#0E7C86',
  mintLight: '#3EA6AE',
  tint: '#D8F0EE',
  bg: '#F4F8F8',
  white: '#FFFFFF',
  muted: '#58696B',
  red: '#C0392B',
  redTint: '#FBEAE6',
  redBorder: '#F2D4D0',
  line: '#E4ECEC',
  dash: '#D9EAEA',
  amberBg: '#FFF1D2',
  amberText: '#7A4300',
  scrim: 'rgba(7,59,66,0.55)',
  toggleOff: '#D9EAEA',
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