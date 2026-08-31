import { describe, expect, it } from 'vitest';
import { isMobileMoreRoute, LEGAL_FOOTER_LINKS, MOBILE_PRIMARY_NAV_ITEMS, shouldUseLeagueBrandLogo } from './AppShell';

describe('mobile app navigation', () => {
  it('keeps exactly the three direct destinations before More', () => {
    expect(MOBILE_PRIMARY_NAV_ITEMS.map((item) => item.path)).toEqual([
      '/home',
      '/racing',
      '/career',
    ]);
  });

  it('marks secondary areas as part of More', () => {
    expect(isMobileMoreRoute('/vora')).toBe(true);
    expect(isMobileMoreRoute('/admin/results/import')).toBe(true);
    expect(isMobileMoreRoute('/profile')).toBe(true);
    expect(isMobileMoreRoute('/home')).toBe(false);
    expect(isMobileMoreRoute('/racing/calendar')).toBe(false);
  });

  it('keeps all legal documents directly reachable from every app page', () => {
    expect(LEGAL_FOOTER_LINKS.map((link) => link.href)).toEqual([
      '/impressum.html',
      '/datenschutz.html',
      '/agb.html',
      '/widerruf.html',
    ]);
  });

  it('falls back after a league logo fails but retries a newly saved logo', () => {
    const brokenLogo = 'https://example.com/broken.svg';
    const replacementLogo = 'https://example.com/replacement.svg';

    expect(shouldUseLeagueBrandLogo(brokenLogo, null)).toBe(true);
    expect(shouldUseLeagueBrandLogo(brokenLogo, brokenLogo)).toBe(false);
    expect(shouldUseLeagueBrandLogo(replacementLogo, brokenLogo)).toBe(true);
    expect(shouldUseLeagueBrandLogo('   ', null)).toBe(false);
  });
});
