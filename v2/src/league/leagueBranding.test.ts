import { describe, expect, it } from 'vitest';
import { fallbackLeagueBranding, shouldUseStandardRaceVoraBranding } from './leagueBranding';

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
