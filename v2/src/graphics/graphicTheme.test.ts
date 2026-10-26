import { describe, expect, it } from 'vitest';
import { THEME_PRESETS } from '../league/leagueBranding';
import { readGraphicTheme, resolveRaceResultPortraitTemplate } from './renderPng';

function contrast(a: string, b: string) {
  const luminance = (hex: string) => [1, 3, 5]
    .map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  return (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
}

function palette(colors: Partial<(typeof THEME_PRESETS)[number]> = {}) {
  const root = document.createElement('div');
  const values = { ...THEME_PRESETS[0], ...colors };
  for (const key of ['background', 'surface', 'primary', 'secondary', 'accent', 'text'] as const) {
    root.style.setProperty(`--brand-${key}`, values[key].toLowerCase());
  }
  root.style.setProperty('--brand-on-primary', values.textOnPrimary);
  document.body.append(root);
  try { return readGraphicTheme(root); } finally { root.remove(); }
}

describe('graphic palette contrast', () => {
  it('uses readable turquoise for the standard palette without changing app tokens', () => {
    const theme = palette();
    expect(theme.primary).toBe('#56a5b8');
    expect(theme.secondary).toBe(THEME_PRESETS[0].secondary);
    expect(THEME_PRESETS[0].primary).toBe('#35246A');
    for (const background of [theme.background, theme.surface, theme.surfaceAlt]) {
      expect(contrast(theme.primary, background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(theme.onPrimary, theme.primary)).toBeGreaterThanOrEqual(4.5);
    expect(resolveRaceResultPortraitTemplate(theme)).toContain(theme.primary);
  });

  it('also corrects the default fallback when no CSS theme is available', () => {
    expect(readGraphicTheme(document.createElement('div')).primary).toBe('#56a5b8');
  });

  it.each(THEME_PRESETS.slice(1))('preserves the $name palette', preset => {
    const theme = palette(preset);
    expect(theme.primary).toBe(preset.primary);
    expect(theme.onPrimary).toBe(preset.textOnPrimary);
  });

  it('does not replace deliberately customized purple palettes', () => {
    const theme = palette({ background: '#101010', primary: '#35246A' });
    expect(theme.primary).toBe('#35246A');
    expect(theme.background).toBe('#101010');
  });
});
