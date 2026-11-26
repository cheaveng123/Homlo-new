// Fonts are bundled natively (assets/fonts, linked by `npx react-native-asset`),
// so nothing has to load at runtime. Kept for callers that still wait on it.
export function useFontsNew(): boolean {
  return true;
}

export type WeightNew = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

export const familyNew = {
  heading: {
    regular: 'PlusJakartaSans_700Bold', medium: 'PlusJakartaSans_700Bold', semibold: 'PlusJakartaSans_700Bold',
    bold: 'PlusJakartaSans_700Bold', extrabold: 'PlusJakartaSans_800ExtraBold',
  },
  body: {
    regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold',
    bold: 'Inter_600SemiBold', extrabold: 'Inter_600SemiBold',
  },
  khmer: {
    regular: 'NotoSansKhmer_400Regular', medium: 'NotoSansKhmer_500Medium', semibold: 'NotoSansKhmer_600SemiBold',
    bold: 'NotoSansKhmer_700Bold', extrabold: 'NotoSansKhmer_700Bold',
  },
} as const;
