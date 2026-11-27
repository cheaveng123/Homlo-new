// → lib/profileTheme.ts
// Tokens for the profile screens — palette "Lagoon & Sunrise" (teal + saffron/clay accents), Plus Jakarta Sans + Inter.
export const C = {
  bg: '#F4F8F8', surface: '#FFFFFF', fg: '#14272B', muted: '#58696B', border: '#E4ECEC',
  primary: '#0E7C86', mint: '#12A0AB', mint100: '#D8F0EE', forest: '#073B42',
  danger: '#C0392B', warn: '#B86E00', warnBg: '#FFF1DC', neutralBg: '#EEF1EF',
};

// If the project already has familyForWeight(), swap these for it.
export const F = {
  h800: 'PlusJakartaSans_800ExtraBold', h700: 'PlusJakartaSans_700Bold',
  b400: 'Inter_400Regular', b500: 'Inter_500Medium', b600: 'Inter_600SemiBold',
};

export const shadow = {
  shadowColor: '#073B42', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 2,
};
