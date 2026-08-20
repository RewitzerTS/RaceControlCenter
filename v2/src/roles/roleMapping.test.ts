import { describe, expect, it } from 'vitest';
import { mapLegacyLeagueRole } from './roleMapping';

describe('mapLegacyLeagueRole', () => {
  it.each([
    ['member', 'driver'],
    ['steward', 'steward'],
    ['admin', 'league_admin'],
    ['owner', 'league_admin'],
  ])('maps %s to %s', (legacy, expected) => {
    expect(mapLegacyLeagueRole(legacy)).toBe(expected);
  });

  it('fails closed for unknown roles', () => {
    expect(mapLegacyLeagueRole('superuser')).toBeNull();
    expect(mapLegacyLeagueRole(null)).toBeNull();
  });
});
