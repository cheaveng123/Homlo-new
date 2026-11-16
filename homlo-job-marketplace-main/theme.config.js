// Lagoon & Sunrise palette. Keep the token NAMES stable — only the swatches
// change — so every consumer repaints without touching its imports.
const themeColors = {
  primary: { light: '#0E7C86', dark: '#0E7C86' },
  background: { light: '#F4F8F8', dark: '#F4F8F8' },
  surface: { light: '#FFFFFF', dark: '#FFFFFF' },
  foreground: { light: '#14272B', dark: '#14272B' },
  muted: { light: '#58696B', dark: '#58696B' },
  border: { light: '#E4ECEC', dark: '#E4ECEC' },
  success: { light: '#0E7C86', dark: '#0E7C86' },
  warning: { light: '#F5B52B', dark: '#F5B52B' },
  error: { light: '#C0392B', dark: '#C0392B' },
  softBlue: { light: '#B5E2DF', dark: '#B5E2DF' },
};

module.exports = { themeColors };