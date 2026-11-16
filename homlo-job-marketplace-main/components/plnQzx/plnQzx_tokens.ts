import { Platform, ViewStyle } from 'react-native';

/** Lagoon & Sunrise tokens. Only used by the plnQzx_* files. */
export const QZ = {
  c: {
    primary: '#0E7C86', deep: '#073B42', tint: '#D8F0EE', tint2: '#B5E2DF',
    bg: '#F4F8F8', card: '#FFFFFF', border: '#E4ECEC', track: '#D9EAEA',
    text: '#14272B', muted: '#58696B',
    sun: '#F5B52B', clay: '#C4531F', cream: '#FFF1D2', creamInk: '#7A4300', creamLine: '#E3C98A',
    danger: '#C0392B', dangerTint: '#FBEAE6', white: '#FFFFFF',
  },
  sp: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  r: { chip: 14, tile: 16, card: 20, hero: 24, sheet: 28, pill: 999 },
  fs: { xs: 12, sm: 13, md: 14, lg: 16, xl: 17, h2: 20, h1: 24 },
  // TODO (AI): map to the font family names that are ALREADY loaded in the app.
  // Plus Jakarta Sans for headings, Inter for UI, matching Khmer font at matching weights.
  font: {
    head: 'PlusJakartaSans_800ExtraBold',
    headMd: 'PlusJakartaSans_700Bold',
    ui: 'Inter_400Regular',
    uiMd: 'Inter_500Medium',
    uiSb: 'Inter_600SemiBold',
  },
  khmer: {
    head: 'NotoSansKhmer_700Bold',
    headMd: 'NotoSansKhmer_700Bold',
    ui: 'NotoSansKhmer_400Regular',
    uiMd: 'NotoSansKhmer_500Medium',
    uiSb: 'NotoSansKhmer_600SemiBold',
  },
} as const;

/** Soft teal-tinted shadow (iOS shadow + Android elevation). */
export const qzShadow: ViewStyle =
  Platform.select<ViewStyle>({
    ios: { shadowColor: '#0E7C86', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 3, shadowColor: '#0E7C86' },
    default: {},
  }) ?? {};
