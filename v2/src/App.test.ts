import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetRouteScroll, resolveExperienceBranding } from './App';
import { applyLeagueBranding, fallbackLeagueBranding } from './league/leagueBranding';

describe('personal theme independent of league permissions', () => {
  it('retains saved colors when the league role is missing or failed', () => {
    const branding = resolveExperienceBranding(fallbackLeagueBranding('rcc'), { theme_preset: 11 }, false, true);
    expect(branding.slug).toBe('racevora');
    expect(branding.theme.id).toBe(11);
    applyLeagueBranding(branding);
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#C7A24E');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#17191E');
  });
  it('updates personal colors without requiring a league role', () => {
    for (const id of [1, 11, 2]) {
      const branding = resolveExperienceBranding(fallbackLeagueBranding('rcc'), { theme_preset: id }, false, true);
      applyLeagueBranding(branding);
      expect(document.documentElement.dataset.leagueTheme).toBe(String(id));
    }
  });
  it('preserves the public and demo standard palette', () => {
    expect(resolveExperienceBranding(fallbackLeagueBranding('rcc'), { theme_preset: 11 }, true, false).theme.id).toBe(0);
  });
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('route scroll restoration', () => {
  it('opens ordinary routes at the top', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);

    resetRouteScroll('');

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'auto', left: 0, top: 0 });
  });

  it('keeps explicit fragment navigation meaningful', () => {
    const target = document.createElement('div');
    target.id = 'results';
    target.scrollIntoView = vi.fn();
    document.body.append(target);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    resetRouteScroll('#results');

    expect(target.scrollIntoView).toHaveBeenCalledOnce();
  });
});
