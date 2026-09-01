import { afterEach, describe, expect, it } from 'vitest';
import { applyLeagueBranding, CUSTOM_THEME_ID, customThemeHasAccessibleContrast, fallbackLeagueBranding, resolvePersonalTheme, resolveTheme, shouldUseStandardRaceVoraBranding, THEME_PRESETS } from './leagueBranding';

afterEach(() => {
  document.querySelector('meta[name="theme-color"]')?.remove();
  document.documentElement.removeAttribute('style');
});

describe('personal theme resolution', () => {
  it('accepts the numeric theme_id stored in Supabase user metadata', () => {
    expect(resolveTheme({ theme_id: 2 })).toMatchObject({
      id: 2,
      name: 'Papaya Grid',
      primary: '#FF8000',
    });
  });

  it('continues to accept string-based league settings and falls back safely', () => {
    expect(resolveTheme({ theme_id: '6' }).id).toBe(6);
    expect(resolveTheme({ theme_preset: 4 }).id).toBe(4);
    expect(resolveTheme({ theme_id: 'unknown' }).id).toBe(0);
  });

  it('resolves a custom personal palette from user metadata', () => {
    expect(resolvePersonalTheme({
      theme_preset: CUSTOM_THEME_ID,
      theme_custom: {
        primary_color: '#123456',
        secondary_color: '#654321',
        accent_color: '#ABCDEF',
        accent_2_color: '#FEDCBA',
        background_color: '#050607',
        surface_color: '#111213',
        text_color: '#F4F5F6',
        text_on_primary_color: '#FFFFFF',
      },
    })).toMatchObject({
      id: CUSTOM_THEME_ID,
      primary: '#123456',
      background: '#050607',
      text: '#F4F5F6',
    });
  });

  it('rejects invalid custom colors and falls back to safe theme values', () => {
    expect(resolvePersonalTheme({
      theme_preset: CUSTOM_THEME_ID,
      theme_custom: { primary_color: 'not-a-color' },
    })).toMatchObject({
      id: CUSTOM_THEME_ID,
      primary: '#35246A',
    });
  });

  it('requires readable contrast for custom themes', () => {
    expect(customThemeHasAccessibleContrast(THEME_PRESETS[2])).toBe(true);
    expect(customThemeHasAccessibleContrast({
      ...THEME_PRESETS[2],
      text: '#121212',
      background: '#111111',
    })).toBe(false);
  });

  it('colors the browser safe area with the active theme surface', () => {
    const branding = fallbackLeagueBranding('racevora');
    branding.theme = { ...branding.theme, background: '#101820', surface: '#142433' };

    applyLeagueBranding(branding);

    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#142433');
    expect(document.documentElement.style.backgroundColor).toBe('rgb(20, 36, 51)');
  });

  it('offers RaceVora plus eleven independently named team-inspired palettes', () => {
    expect(THEME_PRESETS).toHaveLength(12);
    expect(THEME_PRESETS.map((theme) => theme.id)).toEqual([...Array(12).keys()]);
    expect(THEME_PRESETS.find((theme) => theme.id === 4)).toMatchObject({
      name: 'Neon Glacier',
      primary: '#FF87BC',
      secondary: '#00A1E8',
    });
    expect(THEME_PRESETS.slice(8).map((theme) => theme.name)).toEqual([
      'Midnight Charge',
      'Azure Sprint',
      'Velocity Steel',
      'Golden Crest',
    ]);
  });

  it('keeps protected constructor names out of every public theme name', () => {
    const protectedNames = /mercedes|mclaren|ferrari|red bull|racing bulls|aston martin|alpine|williams|haas|audi|cadillac/i;
    THEME_PRESETS.forEach((theme) => expect(theme.name).not.toMatch(protectedNames));
  });
});

describe('RaceVora public branding guard', () => {
  it('uses the RaceVora palette as the fallback', () => {
    expect(fallbackLeagueBranding('racevora').theme).toMatchObject({
      id: 0,
      name: 'RaceVora',
      primary: '#35246A',
      background: '#021B34',
    });
  });

  it('keeps logged-out and loading views on standard branding', () => {
    expect(shouldUseStandardRaceVoraBranding({ authenticated: false, authLoading: false, leagueSlug: 'rcc', pathname: '/home', search: '' })).toBe(true);
    expect(shouldUseStandardRaceVoraBranding({ authenticated: true, authLoading: true, leagueSlug: 'rcc', pathname: '/home', search: '' })).toBe(true);
  });

  it('allows tenant branding only for an authenticated real league view', () => {
    expect(shouldUseStandardRaceVoraBranding({ authenticated: true, authLoading: false, leagueSlug: 'rcc', pathname: '/home', search: '' })).toBe(false);
  });

  it('forces every supported demo entry point back to RaceVora branding', () => {
    expect(shouldUseStandardRaceVoraBranding({ authenticated: true, authLoading: false, leagueSlug: 'rcc', pathname: '/race-hub', search: '?demo=1' })).toBe(true);
    expect(shouldUseStandardRaceVoraBranding({ authenticated: true, authLoading: false, leagueSlug: 'racevora-demo', pathname: '/race-hub', search: '' })).toBe(true);
    expect(shouldUseStandardRaceVoraBranding({ authenticated: true, authLoading: false, leagueSlug: 'rcc', pathname: '/owner/demo', search: '' })).toBe(true);
  });
});
