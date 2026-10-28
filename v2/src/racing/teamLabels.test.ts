import { describe, expect, it, vi } from 'vitest';
import { loadTeamLabels, teamLabel } from './teamLabels';
import { buildStandings, type StandingsData } from './standingsData';
import { renameTeam, type TeamManager } from '../operations/teamManager';
import type { LeagueSupabaseClient } from '../lib/supabase';

describe('season team display names', () => {
  const labels = [{ season_id: 's15', team_id: 'team', key_name: 'Original', display_name: 'New name' }];
  it('keeps other seasons and teams separate and preserves null assignments', () => {
    expect(teamLabel(labels, 's15', 'Original')).toBe('New name');
    expect(teamLabel(labels, 's14', 'Original')).toBe('Original');
    expect(teamLabel(labels, 's15', 'Other')).toBe('Other');
    expect(teamLabel(labels, 's15', null)).toBeNull();
  });
  it('keeps pre-rename and post-rename points in the same team without merging transfers', () => {
    const results = [25, 18, 15].map((points, i) => ({ id: String(i), race_id: `r${i}`, result_version_id: `v${i}`, driver_id: 'd', points_owner_driver_id: null, awarded_points: points, finish_position: i + 1, participation_status: 'HUMAN', points_team_name: teamLabel(labels, 's15', i === 2 ? 'Other' : 'Original'), points_car_name: 'Car' }));
    const data = { season: { id: 's15', name: '15' }, drivers: [{ id: 'd', display_name: 'Driver', is_active: true }], assignments: [],
      races: results.map((r, i) => ({ id: r.race_id, round_number: i + 1, current_result_version_id: r.result_version_id, status: 'completed' })), results,
      currentRoster: [{ driver_id: 'd', team_name: 'Other', car_name: 'Car' }] } as unknown as StandingsData;
    const table = buildStandings(data);
    expect(table.teamStandings.map(t => [t.teamName, t.points])).toEqual([['New name', 43], ['Other', 15]]);
    expect(table.driverStandings[0].points).toBe(58);
  });
  it('uses the separate rename API with a revision and no lineup mutation', async () => {
    const state = { revision: 'r', profiles: [], teams: [], races: [] } as unknown as TeamManager;
    const rpc = vi.fn().mockResolvedValue({ data: state, error: null });
    await renameTeam({ rpc } as unknown as LeagueSupabaseClient, state, 'Original', ' New name ', null);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('rename_league_season_team', { p_key_name: 'Original', p_display_name: 'New name', p_round: null, p_revision: 'r' });
  });
  it('surfaces label lookup failures instead of showing a split points table', async () => {
    const error = { message: 'access denied' };
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    await expect(loadTeamLabels({ rpc } as unknown as LeagueSupabaseClient)).rejects.toEqual(error);
  });
});
