import { describe, expect, it, vi } from 'vitest';
import { activateCreatedLeague, leagueSetupDestination } from './LeagueCreatePage';

describe('leagueSetupDestination', () => {
  it('opens the season setup in the newly-created league context', () => {
    expect(leagueSetupDestination('my-new-league')).toBe('/admin/season/setup?league=my-new-league');
  });

  it('persists the new league before reloading into its explicit tenant URL', () => {
    const calls: string[] = [];
    const setLeagueSlug = vi.fn((slug: string) => calls.push(`set:${slug}`));
    const replaceLocation = vi.fn((destination: string) => calls.push(`replace:${destination}`));

    activateCreatedLeague('my-new-league', setLeagueSlug, replaceLocation);

    expect(calls).toEqual([
      'set:my-new-league',
      'replace:/admin/season/setup?league=my-new-league',
    ]);
  });
});
