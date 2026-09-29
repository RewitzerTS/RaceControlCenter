import { describe, expect, it, vi } from 'vitest';
import { validProfileAssignments, startSeasonFromProfiles, type TeamDirectory } from './leagueTeams';
import type { LeagueSupabaseClient } from '../lib/supabase';

const directory: TeamDirectory = { profiles: [{ id: 'driver', display_name: 'Driver', gamertag: 'Tag', is_active: true }], teams: [{ id: 'team', name: 'RCC Racing' }], preferences: [] };
describe('league profile selection', () => {
  it('accepts existing active profiles and independent team IDs', () => {
    expect(validProfileAssignments([{ seat_code: 'mercedes', driver_id: 'driver', team_id: 'team' }], directory)).toBe(true);
  });
  it('rejects duplicate, missing, inactive, tagless and foreign selections', () => {
    const row = { seat_code: 'mercedes', driver_id: 'driver', team_id: null };
    expect(validProfileAssignments([row, { ...row, seat_code: 'ferrari' }], directory)).toBe(false);
    expect(validProfileAssignments([{ ...row, driver_id: 'foreign' }], directory)).toBe(false);
    expect(validProfileAssignments([{ ...row, team_id: 'foreign' }], directory)).toBe(false);
    expect(validProfileAssignments([row], { ...directory, profiles: [{ ...directory.profiles[0], is_active: false }] })).toBe(false);
    expect(validProfileAssignments([row], { ...directory, profiles: [{ ...directory.profiles[0], gamertag: null }] })).toBe(false);
    expect(validProfileAssignments([], null)).toBe(false);
  });
  it('sends profile IDs, not editable names, with the complete season transaction', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    await startSeasonFromProfiles({ rpc } as unknown as LeagueSupabaseClient, { name: 'Season', slug: 'season', gameKey: 'f1_26', startDate: '2026-09-29', fastestLapBonusEnabled: false, assignments: [{ seat_code: 'seat', driver_id: 'driver', team_id: 'team' }], calendar: [] });
    expect(rpc).toHaveBeenCalledWith('start_league_season_from_profiles', expect.objectContaining({ p_game_key: 'f1_26', p_assignments: [{ seat_code: 'seat', driver_id: 'driver', team_id: 'team' }] }));
  });
});
