import type { LeagueSupabaseClient } from '../lib/supabase';
import type { LeagueDriver } from './operations';

export type RosterRace = { id: string; round: number; name: string; locked: boolean };
export type RaceSubstitution = { id: string; race_id: string; primary_driver_id: string; substitute_driver_id: string };
export type VehicleAssignment = { id: string; driver_id: string; from_round: number; team_name: string | null; car_name: string | null };
export type RosterWorkspace = { season_id: string | null; races: RosterRace[]; substitutions: RaceSubstitution[]; vehicles: VehicleAssignment[] };

// Imported legacy human profiles can contain an F1 driver's name in this field.
export function isHumanDriver(driver: Pick<LeagueDriver, 'ai_driver_reference'>) {
  return !/^[a-z0-9_]+:[a-z0-9_-]+$/.test(driver.ai_driver_reference ?? '');
}

export function vehicleChangeRounds(races: RosterRace[]) {
  const lastLocked = Math.max(0, ...races.filter((race) => race.locked).map((race) => race.round));
  return races.filter((race) => !race.locked && race.round > lastLocked);
}

export async function loadRosterWorkspace(client: LeagueSupabaseClient): Promise<RosterWorkspace> {
  const { data, error } = await client.rpc('get_league_roster_workspace');
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || !Array.isArray(data.races) || !Array.isArray(data.substitutions) || !Array.isArray(data.vehicles)) {
    throw new Error('Invalid roster response');
  }
  return data as unknown as RosterWorkspace;
}

export async function saveSubstitution(client: LeagueSupabaseClient, raceId: string, primaryId: string, substituteId: string | null) {
  const { error } = await client.rpc('set_race_substitution', {
    p_race_id: raceId, p_primary_driver_id: primaryId, p_substitute_driver_id: substituteId,
  });
  if (error) throw new Error(error.message);
}

export async function saveVehicleChange(client: LeagueSupabaseClient, driverId: string, round: number, team: string, car: string, aiDriverId: string | null) {
  const { error } = await client.rpc('change_season_vehicle', {
    p_driver_id: driverId, p_effective_from_round: round, p_team_name: team.trim(), p_car_name: car.trim(), p_ai_driver_id: aiDriverId,
  });
  if (error) throw new Error(error.message);
}
