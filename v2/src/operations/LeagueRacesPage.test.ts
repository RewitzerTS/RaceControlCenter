import { describe, expect, it } from 'vitest';
import type { LeagueRace } from './operations';
import { seasonCompletionBlockers } from './LeagueRacesPage';

function race(overrides: Partial<LeagueRace>): LeagueRace {
  return {
    circuit_name: null,
    country_code: null,
    grand_prix_name: 'Test GP',
    has_sprint: false,
    id: 'race-1',
    race_date: null,
    race_start_at: null,
    result_activated_at: null,
    result_count: 0,
    result_status: null,
    result_version: null,
    round_number: 1,
    season_id: 'season-1',
    season_name: 'Season 1',
    status: 'upcoming',
    ...overrides,
  };
}

describe('seasonCompletionBlockers', () => {
  it('blocks upcoming races and completed races without an official result', () => {
    const blockers = seasonCompletionBlockers([
      race({ id: 'upcoming' }),
      race({ id: 'missing-result', round_number: 2, status: 'completed' }),
      race({ id: 'official', result_status: 'active', round_number: 3, status: 'completed' }),
      race({ id: 'cancelled', round_number: 4, status: 'cancelled' }),
    ], 'season-1');

    expect(blockers.map((blocker) => blocker.id)).toEqual(['upcoming', 'missing-result']);
  });

  it('ignores races from archived or different seasons', () => {
    expect(seasonCompletionBlockers([
      race({ season_id: 'season-2' }),
    ], 'season-1')).toEqual([]);
  });
});
