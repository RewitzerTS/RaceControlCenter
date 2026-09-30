import { describe, expect, it, vi } from 'vitest';
import { editableAliases, occupiedAi, saveDriverEditor, startSeasonWithoutAssignments } from './driverEditor';
import type { LeagueSupabaseClient } from '../lib/supabase';
import type { SeasonAiAssignment } from './operations';

describe('unified driver editor', () => {
  it('keeps personal names outside editable rows and offers all four platforms', () => {
    const rows = editableAliases({ main: 'Main', aliases: [{ id: 'a', alias: 'Personal', platform: 'ea', scope: 'personal', editable: false }, { id: 'b', alias: 'SteamName', platform: 'steam', scope: 'league', editable: true }] });
    expect(rows).toHaveLength(4);
    expect(rows.map(r => r.platform).sort()).toEqual(['ea', 'playstation', 'steam', 'xbox']);
    expect(rows.some(r => r.alias === 'Personal')).toBe(false);
    expect(rows[0].alias).toBe('SteamName');
  });
  it('detects current and future seat conflicts, but not an expired assignment or the same driver', () => {
    const base = { ai_driver_id: 'ai', human_driver_id: 'other', effective_from_round: 3, effective_to_round: null } as SeasonAiAssignment;
    expect(occupiedAi([base], 'ai', 'me', 2)).toBe(base);
    expect(occupiedAi([{ ...base, effective_to_round: 2 }], 'ai', 'me', 3)).toBeUndefined();
    expect(occupiedAi([base], 'ai', 'other', 1)).toBeUndefined();
  });
  it('saves profile, aliases and explicit seat atomically without a number field', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { revision: 'next', gamertags: { aliases: [] } }, error: null });
    const profile = { display_name: 'Driver', gamertag: 'Main', nationality_code: 'DE', is_active: true };
    await saveDriverEditor({ rpc } as unknown as LeagueSupabaseClient, { id: 'driver', profile, aliases: [{ alias: ' EAName ', platform: 'ea' }, { alias: '', platform: 'xbox' }], aiId: 'ai', round: 4, revision: 'old' });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith('save_league_driver_editor', { p_driver_id: 'driver', p_profile: profile, p_aliases: [{ alias: 'EAName', platform: 'ea' }], p_ai_driver_id: 'ai', p_round: 4, p_revision: 'old' });
  });
  it('starts a season through an API with no assignment parameter', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    await startSeasonWithoutAssignments({ rpc } as unknown as LeagueSupabaseClient, { name: 'Season', slug: 'season', gameKey: 'f1_26', startDate: '2026-10-01', fastestLapBonusEnabled: false, calendar: [] });
    expect(rpc).toHaveBeenCalledWith('start_league_season_setup', { p_name: 'Season', p_slug: 'season', p_game_key: 'f1_26', p_start_date: '2026-10-01', p_fastest_lap_bonus_enabled: false, p_calendar: [] });
  });
});
