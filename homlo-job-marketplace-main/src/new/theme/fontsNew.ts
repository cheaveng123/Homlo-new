import { useFonts } from 'expo-font';
import { PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  NotoSansKhmer_400Regular,
  NotoSansKhmer_500Medium,
  NotoSansKhmer_600SemiBold,
  NotoSansKhmer_700Bold,
} from '@expo-google-fonts/noto-sans-khmer';

/** Call once in the root layout. Keep the splash screen visible until it returns true. */
export function useFontsNew(): boolean {
  const [loaded, error] = useFonts({
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    NotoSansKhmer_400Regular,
    NotoSansKhmer_500Medium,
    NotoSansKhmer_600SemiBold,
    NotoSansKhmer_700Bold,
  });
  return loaded || !!error; // never block the app forever if a font fails
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
