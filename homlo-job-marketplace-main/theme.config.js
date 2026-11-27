// Lagoon & Sunrise palette. Keep the token NAMES stable — only the swatches
// change — so every consumer repaints without touching its imports.
const themeColors = {
  primary: { light: '#0891B2', dark: '#0891B2' },
  background: { light: '#F3F6F5', dark: '#F3F6F5' },
  surface: { light: '#FFFFFF', dark: '#FFFFFF' },
  foreground: { light: '#12303C', dark: '#12303C' },
  muted: { light: '#6A7C84', dark: '#6A7C84' },
  border: { light: '#E6EDEF', dark: '#E6EDEF' },
  success: { light: '#0891B2', dark: '#0891B2' },
  warning: { light: '#F5A524', dark: '#F5A524' },
  error: { light: '#C0392B', dark: '#C0392B' },
  softBlue: { light: '#8BD3E3', dark: '#8BD3E3' },
};

module.exports = { themeColors };