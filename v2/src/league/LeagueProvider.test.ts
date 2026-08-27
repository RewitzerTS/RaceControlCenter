import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACTIVE_LEAGUE_STORAGE_KEY,
  LEGACY_ACTIVE_LEAGUE_STORAGE_KEY,
  LEGACY_TENANT_STORAGE_KEY,
  persistActiveLeagueSlug,
  resolveInitialLeagueSlug,
} from './LeagueProvider';

describe('resolveInitialLeagueSlug', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  it('prefers a valid league from the URL', () => {
    expect(resolveInitialLeagueSlug('?league=second-league', 'first-league', 'rcc')).toBe('second-league');
  });

  it('restores the persisted league when the URL has no league', () => {
    expect(resolveInitialLeagueSlug('', 'my-league', 'rcc')).toBe('my-league');
  });

  it('ignores invalid stored values', () => {
    expect(resolveInitialLeagueSlug('', '../invalid', 'rcc')).toBe('rcc');
  });

  it('synchronizes the active league with embedded legacy pages and clears tenant caches', () => {
    sessionStorage.setItem('rcc.calendar.activeSection', 'archive');
    sessionStorage.setItem('rcc.calendar.archiveSeason', 'old-season');
    sessionStorage.setItem('rcc.standings.view.v1:rcc', 'teams');

    persistActiveLeagueSlug('new-league');

    expect(localStorage.getItem(ACTIVE_LEAGUE_STORAGE_KEY)).toBe('new-league');
    expect(sessionStorage.getItem(LEGACY_ACTIVE_LEAGUE_STORAGE_KEY)).toBe('new-league');
    expect(sessionStorage.getItem(LEGACY_TENANT_STORAGE_KEY)).toBe('new-league');
    expect(sessionStorage.getItem('rcc.calendar.activeSection')).toBeNull();
    expect(sessionStorage.getItem('rcc.calendar.archiveSeason')).toBeNull();
    expect(sessionStorage.getItem('rcc.standings.view.v1:rcc')).toBeNull();
  });
});
