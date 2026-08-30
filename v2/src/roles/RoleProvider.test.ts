import { describe, expect, it } from 'vitest';
import { membershipRoleForLeague } from './RoleProvider';

describe('membershipRoleForLeague', () => {
  const leagues = [
    { id: 'league-rcc', slug: 'rcc' },
    { id: 'league-two', slug: 'league-two' },
  ];

  it('returns the role only for an approved membership in the requested league', () => {
    expect(membershipRoleForLeague(
      [{ league_id: 'league-two', role: 'steward' }],
      leagues,
      'league-two',
    )).toBe('steward');
  });

  it('does not treat a default league slug as a membership', () => {
    expect(membershipRoleForLeague([], leagues, 'rcc')).toBeNull();
    expect(membershipRoleForLeague(
      [{ league_id: 'league-two', role: 'driver' }],
      leagues,
      'rcc',
    )).toBeNull();
  });
});
