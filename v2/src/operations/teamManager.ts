import type { LeagueSupabaseClient } from '../lib/supabase';
import type { Json } from '../types/database';
import type { LeagueProfile } from './leagueTeams';
import { vehicleChangeRounds, type RosterRace } from './roster';

export type TeamMode = 'current' | 'next';
export type TeamMember = LeagueProfile & { team_name: string | null; car_name: string | null };
export type TeamManager = { mode: TeamMode; season: { id: string; name: string } | null; view_round: number | null; revision: string; races: RosterRace[]; teams: { name: string }[]; profiles: TeamMember[] };
export type TeamEdit = { original: string | null; name: string; drivers: [string, string]; departures: Record<string, string> };
function response(data: unknown): TeamManager {
  const value = data as TeamManager;
  if (!value || typeof value.revision !== 'string' || !Array.isArray(value.profiles) || !Array.isArray(value.teams) || !Array.isArray(value.races)) throw new Error('TEAM_LOAD_FAILED');
  return value;
}
export async function loadTeamManager(client: LeagueSupabaseClient, mode: TeamMode, round: number | null) {
  const { data, error } = await client.rpc('get_league_team_manager', { p_mode: mode, p_round: round });
  if (error) throw error;
  return response(data);
}
export function departingMembers(state: TeamManager, edit: TeamEdit) {
  return state.profiles.filter(p => edit.original !== null && p.team_name === edit.original && !edit.drivers.includes(p.id));
}
export function teamEditReady(state: TeamManager, edit: TeamEdit, round: number | null) {
  const ids = edit.drivers.filter(Boolean);
  return edit.name.trim().length >= 2 && edit.name.trim().length <= 80
    && !state.teams.some(t => t.name !== edit.original && t.name.toLocaleLowerCase() === edit.name.trim().toLocaleLowerCase())
    && new Set(ids).size === ids.length && ids.every(id => state.profiles.some(p => p.id === id && p.is_active))
    && ids.every(id => state.mode === 'next' || Boolean(state.profiles.find(p => p.id === id)?.car_name))
    && (state.mode === 'next' ? round === null : Boolean(round && vehicleChangeRounds(state.races).some(r => r.round === round) && state.season))
    && departingMembers(state, edit).every(p => Boolean(edit.departures[p.id] && edit.departures[p.id] !== edit.name.trim() && edit.departures[p.id] !== edit.original && state.teams.some(t => t.name === edit.departures[p.id])));
}
export async function saveTeamManager(client: LeagueSupabaseClient, state: TeamManager, edit: TeamEdit, round: number | null) {
  if (!teamEditReady(state, edit, round)) throw new Error('TEAM_FORM_INCOMPLETE');
  const { data, error } = await client.rpc('save_league_team_lineup', {
    p_mode: state.mode, p_round: round, p_original_name: edit.original, p_name: edit.name.trim(),
    p_driver_ids: edit.drivers.filter(Boolean), p_revision: state.revision,
    p_departures: departingMembers(state, edit).map(p => ({ driver_id: p.id, team_name: edit.departures[p.id] })) as Json,
  });
  if (error) throw error;
  return response(data);
}
