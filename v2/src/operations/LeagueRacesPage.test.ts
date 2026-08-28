import { describe, expect, it } from 'vitest';
import type { LeagueRace } from './operations';
import { activeSeasonRaces, seasonCompletionBlockers } from './LeagueRacesPage';

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

describe('activeSeasonRaces', () => {
  it('keeps archived-season races out of current administration views', () => {
    const activeRace = race({ id: 'active-race', season_id: 'season-active' });
    const archivedRace = race({ id: 'archived-race', season_id: 'season-archived' });

    expect(activeSeasonRaces({
      league: { id: 'league-1', name: 'Test League', slug: 'test-league', status: 'active' },
      seasons: [
        { id: 'season-active', name: 'Active', slug: 'active', is_active: true, game_label: 'F1 25', start_date: null, end_date: null },
        { id: 'season-archived', name: 'Archived', slug: 'archived', is_active: false, game_label: 'F1 25', start_date: null, end_date: null },
      ],
      races: [activeRace, archivedRace],
      driver_standings: [],
      team_standings: [],
    }).map((item) => item.id)).toEqual(['active-race']);
  });
});
