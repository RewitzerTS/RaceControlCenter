import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidatePublishedResultCaches } from './resultPublication';

describe('result publication cache invalidation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('removes every legacy data and standings cache for the published league only', () => {
    localStorage.setItem('rcc_query_cache_v3:testliga:races', 'stale');
    localStorage.setItem('rcc_query_cache_v4:testliga:raceResults', 'stale');
    localStorage.setItem('rcc_query_cache_v4:andereliga:races', 'keep');
    sessionStorage.setItem('rcc.standings.view.v2:testliga:fahrer-wm', 'stale');
    sessionStorage.setItem('rcc.standings.view.v2:andereliga:fahrer-wm', 'keep');
    const listener = vi.fn();
    window.addEventListener('racevora:result-published', listener);

    invalidatePublishedResultCaches('TestLiga');

    expect(localStorage.getItem('rcc_query_cache_v3:testliga:races')).toBeNull();
    expect(localStorage.getItem('rcc_query_cache_v4:testliga:raceResults')).toBeNull();
    expect(localStorage.getItem('rcc_query_cache_v4:andereliga:races')).toBe('keep');
    expect(sessionStorage.getItem('rcc.standings.view.v2:testliga:fahrer-wm')).toBeNull();
    expect(sessionStorage.getItem('rcc.standings.view.v2:andereliga:fahrer-wm')).toBe('keep');
    expect(listener).toHaveBeenCalledOnce();

    window.removeEventListener('racevora:result-published', listener);
  });
});
