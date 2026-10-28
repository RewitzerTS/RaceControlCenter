import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function fixture(error: unknown = null) {
  const history = {
    drivers: [], races: [],
    assignments: [{ season_id: 'old', team_name: 'Alpha' }, { season_id: 'new', team_name: 'Alpha' }],
    currentRosters: [{ season_id: 'new', team_name: 'Alpha' }],
    raceResults: [{ race_id: 'r1', points_team_name: 'Alpha', awarded_points: 25 }, { race_id: 'r2', points_team_name: 'Alpha', awarded_points: 18 }],
    racesById: new Map([['r1', { season_id: 'old' }], ['r2', { season_id: 'new' }]]),
    fastestByRace: new Map(), profileNumbersByDriver: { driver: 12 }
  };
  const window = {
    RCCDriverStats: { loadLeagueHistory: vi.fn().mockResolvedValue(history) },
    RCCDriverContext: { createAssignmentResolver: vi.fn().mockReturnValue('resolver') },
    supabaseClient: { rpc: vi.fn().mockResolvedValue({ data: [{ season_id: 'new', key_name: 'Alpha', display_name: 'Renamed' }], error }) }
  };
  runInNewContext(readFileSync('scripts/legacy-season-team-labels.js', 'utf8'), { window });
  return { history, window };
}

it('uses season-specific team names in embedded Career without changing cached results or statistics', async () => {
  const { history, window } = fixture();
  const result = await window.RCCDriverStats.loadLeagueHistory();
  expect(result.assignments.map((row: { team_name: string }) => row.team_name)).toEqual(['Alpha', 'Renamed']);
  expect(result.currentRosters[0].team_name).toBe('Renamed');
  expect(result.resultsByRace.get('r2')[0]).toEqual({ race_id: 'r2', points_team_name: 'Renamed', awarded_points: 18 });
  expect(result.resultsByRace.get('r1')[0].points_team_name).toBe('Alpha');
  expect(history.raceResults[1].points_team_name).toBe('Alpha');
  expect(history.assignments[1].team_name).toBe('Alpha');
  expect(result.profileNumbersByDriver).toBe(history.profileNumbersByDriver);
  expect(result.fastestByRace).toBe(history.fastestByRace);
  expect(window.RCCDriverContext.createAssignmentResolver).toHaveBeenCalledWith(expect.objectContaining({ assignments: result.assignments }));
});

it('reports lookup failures instead of silently displaying split team identities', async () => {
  const { window } = fixture(new Error('lookup failed'));
  await expect(window.RCCDriverStats.loadLeagueHistory()).rejects.toThrow('lookup failed');
});
