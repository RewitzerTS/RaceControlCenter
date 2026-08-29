import { afterEach, describe, expect, it } from 'vitest';
import { applyLeagueBranding, fallbackLeagueBranding, resolveTheme, shouldUseStandardRaceVoraBranding } from './leagueBranding';

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

  it('colors the browser safe area with the active theme surface', () => {
    const branding = fallbackLeagueBranding('racevora');
    branding.theme = { ...branding.theme, background: '#101820', surface: '#142433' };

    applyLeagueBranding(branding);

    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#142433');
    expect(document.documentElement.style.backgroundColor).toBe('rgb(20, 36, 51)');
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
