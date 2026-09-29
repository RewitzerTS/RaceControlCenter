import type { LeagueSupabaseClient } from '../lib/supabase';
import type { Json } from '../types/database';
import type { SeasonCalendarEntry, StartedSeason } from './operations';

export type LeagueTeam = { id: string; name: string };
export type LeagueProfile = { id: string; display_name: string; gamertag: string | null; is_active: boolean };
export type TeamDirectory = { teams: LeagueTeam[]; preferences: { driver_id: string; team_id: string }[]; profiles: LeagueProfile[] };
export type ProfileSeatAssignment = { seat_code: string; driver_id: string; team_id: string | null };

export async function loadTeamDirectory(client: LeagueSupabaseClient): Promise<TeamDirectory> {
  const { data, error } = await client.rpc('get_league_team_directory');
  if (error) throw new Error(error.message);
  const directory = data as unknown as TeamDirectory;
  if (!directory || !Array.isArray(directory.teams) || !Array.isArray(directory.preferences) || !Array.isArray(directory.profiles)) throw new Error('Fahrer und Liga-Teams konnten nicht geladen werden. Bitte erneut versuchen.');
  return directory;
}
export async function createLeagueTeam(client: LeagueSupabaseClient, name: string) {
  const { data, error } = await client.rpc('create_league_team', { p_name: name.trim() });
  if (error) throw new Error(error.message);
  return data;
}
export async function assignLeagueTeam(client: LeagueSupabaseClient, driverId: string, teamId: string | null, round: number | null) {
  const { error } = await client.rpc('assign_league_driver_team', { p_driver_id: driverId, p_team_id: teamId, p_effective_from_round: round });
  if (error) throw new Error(error.message);
}
export function validProfileAssignments(assignments: ProfileSeatAssignment[], directory: TeamDirectory | null) {
  if (!directory) return false;
  return new Set(assignments.map(row => row.driver_id)).size === assignments.length
    && assignments.every(row => directory.profiles.some(profile => profile.id === row.driver_id && profile.is_active && (profile.gamertag?.trim().length ?? 0) >= 2)
      && (!row.team_id || directory.teams.some(team => team.id === row.team_id)));
}
export async function startSeasonFromProfiles(client: LeagueSupabaseClient, input: {
  name: string; slug: string; gameKey: string; startDate: string; fastestLapBonusEnabled: boolean;
  assignments: ProfileSeatAssignment[]; calendar: SeasonCalendarEntry[];
}): Promise<StartedSeason> {
  const { data, error } = await client.rpc('start_league_season_from_profiles', {
    p_name: input.name, p_slug: input.slug, p_game_key: input.gameKey, p_start_date: input.startDate,
    p_fastest_lap_bonus_enabled: input.fastestLapBonusEnabled,
    p_assignments: input.assignments as unknown as Json, p_calendar: input.calendar as unknown as Json,
  });
  if (error) throw new Error(error.message);
  return data as unknown as StartedSeason;
}
