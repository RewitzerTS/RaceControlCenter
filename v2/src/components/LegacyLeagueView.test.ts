import { describe, expect, it } from 'vitest';
import { legacyLeagueSource } from './LegacyLeagueView';

describe('legacyLeagueSource', () => {
  it('always replaces a stale embedded league context', () => {
    expect(legacyLeagueSource('kalender', '?league=old-league&view=archive', 'new-league'))
      .toBe('/kalender.html?league=new-league&view=archive&embed=1');
  });

  it('adds the active league to embedded pages without a league query', () => {
    expect(legacyLeagueSource('ergebnisse', '?view=drivers', 'rcc'))
      .toBe('/ergebnisse.html?view=drivers&embed=1&league=rcc');
  });
});
