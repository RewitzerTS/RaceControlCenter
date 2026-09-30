import { describe, expect, it, vi } from 'vitest';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { departingMembers, loadTeamManager, saveTeamManager, teamEditReady, type TeamEdit, type TeamManager } from './teamManager';
import { teamManagerCopy, teamManagerError } from './teamManagerCopy';

const state: TeamManager = { mode: 'current', season: { id: 'season', name: 'Saison' }, view_round: 2, revision: 'revision', races: [
  { id: 'r1', round: 1, name: 'Old', locked: true }, { id: 'r2', round: 2, name: 'New', locked: false },
], teams: [{ name: 'Alpha' }, { name: 'Beta' }], profiles: [
  { id: 'a', display_name: 'A', gamertag: 'TagA', is_active: true, team_name: 'Alpha', car_name: 'Mercedes' },
  { id: 'b', display_name: 'B', gamertag: 'TagB', is_active: true, team_name: 'Alpha', car_name: 'Red Bull' },
  { id: 'c', display_name: 'C', gamertag: 'TagC', is_active: true, team_name: 'Beta', car_name: 'Ferrari' },
  { id: 'd', display_name: 'D', gamertag: 'TagD', is_active: true, team_name: null, car_name: 'Alpine' },
] };
const edit: TeamEdit = { original: 'Alpha', name: 'Alpha', drivers: ['a', 'c'], departures: { b: 'Beta' } };
describe('team lineup transaction', () => {
  it('requires an explicit open race for current-season edits', () => {
    expect(teamEditReady(state, edit, 2)).toBe(true);
    for (const round of [null, 0, 1, 3]) expect(teamEditReady(state, edit, round)).toBe(false);
    expect(teamEditReady({ ...state, season: null }, edit, 2)).toBe(false);
  });
  it('rejects races preceding an already locked later round', () => {
    expect(teamEditReady({ ...state, races: [...state.races, { id: 'later', round: 3, name: 'Later', locked: true }] }, edit, 2)).toBe(false);
  });
  it('requires every outgoing driver to get a different existing team', () => {
    expect(departingMembers(state, edit).map(p => p.id)).toEqual(['b']);
    for (const departures of [{}, { b: 'Alpha' }, { b: 'foreign' }] as Record<string, string>[]) expect(teamEditReady(state, { ...edit, departures }, 2)).toBe(false);
  });
  it('does not treat unassigned drivers as departures when creating a team', () => {
    const create: TeamEdit = { original: null, name: 'Hobbyracer', drivers: ['a', 'b'], departures: {} };
    expect(departingMembers(state, create)).toEqual([]);
    expect(teamEditReady(state, create, 2)).toBe(true);
  });
  it('requires different active known profiles with cars in the current season', () => {
    expect(teamEditReady(state, { ...edit, drivers: ['a', 'a'] }, 2)).toBe(false);
    expect(teamEditReady(state, { ...edit, drivers: ['a', 'foreign'] }, 2)).toBe(false);
    expect(teamEditReady({ ...state, profiles: state.profiles.map(p => ({ ...p, is_active: false })) }, edit, 2)).toBe(false);
    expect(teamEditReady({ ...state, profiles: state.profiles.map(p => ({ ...p, car_name: null })) }, edit, 2)).toBe(false);
  });
  it('renames a team centrally but rejects collisions and departures back into the retired name', () => {
    expect(teamEditReady(state, { ...edit, name: 'Hobbyracer' }, 2)).toBe(true);
    expect(teamEditReady(state, { ...edit, name: 'Beta' }, 2)).toBe(false);
    expect(teamEditReady(state, { ...edit, name: 'Hobbyracer', departures: { b: 'Alpha' } }, 2)).toBe(false);
  });
  it('next-season planning has no effective round or car requirement', () => {
    const next = { ...state, mode: 'next' as const, season: null, profiles: state.profiles.map(p => ({ ...p, car_name: null })) };
    expect(teamEditReady(next, edit, null)).toBe(true);
    expect(teamEditReady(next, edit, 2)).toBe(false);
  });
  it('saves lineup and required departures in one RPC without changing cars or points', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: state, error: null });
    await saveTeamManager({ rpc } as unknown as LeagueSupabaseClient, state, edit, 2);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('save_league_team_lineup', { p_mode: 'current', p_round: 2, p_original_name: 'Alpha', p_name: 'Alpha', p_driver_ids: ['a', 'c'], p_departures: [{ driver_id: 'b', team_name: 'Beta' }], p_revision: 'revision' });
  });
  it('does not send incomplete requests', async () => {
    const rpc = vi.fn();
    await expect(saveTeamManager({ rpc } as unknown as LeagueSupabaseClient, state, edit, null)).rejects.toThrow('TEAM_FORM_INCOMPLETE');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects incomplete load and surfaces RPC failures', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: {}, error: null }).mockResolvedValueOnce({ data: null, error: { message: 'TEAM_STATE_CHANGED' } });
    const client = { rpc } as unknown as LeagueSupabaseClient;
    await expect(loadTeamManager(client, 'current', null)).rejects.toThrow('TEAM_LOAD_FAILED');
    await expect(saveTeamManager(client, state, edit, 2)).rejects.toEqual({ message: 'TEAM_STATE_CHANGED' });
  });
  it.each(Object.values(teamManagerCopy))('provides actionable translated failure messages', copy => {
    expect(teamManagerError({ message: 'TEAM_STATE_CHANGED' }, copy)).toBe(copy.stale);
    expect(teamManagerError({ message: 'TEAM_FULL' }, copy)).toBe(copy.full);
    expect(teamManagerError({ message: 'TEAM_NAME_EXISTS' }, copy)).toBe(copy.duplicate);
    expect(teamManagerError({ message: 'ROSTER_LOCKED' }, copy)).toBe(copy.locked);
    expect(teamManagerError(new Error('Network failed'), copy)).toBe(copy.saveError);
  });
});
