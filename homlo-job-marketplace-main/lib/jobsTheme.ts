// Palette "Lagoon & Sunrise". Main = lagoon teal. Accents = sun (saffron), clay, cream.
// Spacing is an 8pt grid. Screen side margin is always S.lg (16). Touch targets are at least 44.
export const J = {
  primary: '#0891B2', deep: '#14324A', tint: '#DCF1F6',
  sun: '#F5A524', clay: '#E8870F', cream: '#FFF1D2', creamInk: '#7A4300', eyebrowInk: '#8A4B00',
  fg: '#12303C', muted: '#6A7C84', border: '#E6EDEF', bg: '#F3F6F5', surface: '#FFFFFF',
  track: '#D5E6EA', headerFrom: '#0B7F99',
};

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const R = { chip: 14, logo: 16, card: 20, hero: 24, pill: 999 };
// Type scale (px). Headings use Plus Jakarta Sans, body uses Inter (see F in profileTheme).
export const TS = { caption: 12, meta: 13, body: 14, title: 16, section: 17, header: 20, hero: 24 };

// Soft gradient pairs for logo tiles and selector circles (cycle by index).
export const TINTS: [string, string][] = [
  ['#DCF1F6', '#8BD3E3'], ['#FFF1D2', '#FFE0A0'], ['#FDF0D9', '#F8DDB0'], ['#EEF3F4', '#D5E6EA'],
];
export const SOLIDS = ['#0891B2', '#14324A', '#E8870F', '#6B4FA0'];

export const shadowSm = {
  shadowColor: '#14324A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 1,
};
export const shadowMd = {
  shadowColor: '#14324A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 28, elevation: 8,
};