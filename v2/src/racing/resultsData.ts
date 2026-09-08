import type { SupabaseClient } from '@supabase/supabase-js';
import type { LeagueSupabaseClient } from '../lib/supabase';
import type { Database } from '../types/database';

type Tables = Database['public']['Tables'];
export type ResultsDriver = Pick<Tables['drivers']['Row'], 'id' | 'display_name' | 'gamertag' | 'car_name' | 'league_team' | 'is_active'> & Partial<Pick<Tables['drivers']['Row'], 'number' | 'nationality_code' | 'avatar_url' | 'ai_driver_reference'>>;
export type ResultsRace = Pick<Tables['races']['Row'], 'id' | 'season_id' | 'round_number' | 'grand_prix_name' | 'country_code' | 'status' | 'current_result_version_id'>;
export type PublishedResult = Pick<Tables['race_results']['Row'], 'id' | 'race_id' | 'result_version_id' | 'driver_id' | 'points_owner_driver_id' | 'awarded_points' | 'participation_status' | 'fastest_lap_time_ms' | 'fastest_lap_ms' | 'fastest_lap_time' | 'points_car_name' | 'car_name_snapshot'> & Partial<Pick<Tables['race_results']['Row'], 'finish_position' | 'points_team_name'>>;
export interface ResultsAssignment { driver_id: string; car_name: string | null; created_at: string; team_name?: string | null; effective_round_number?: number; id?: string; seat_code?: string; participant_type?: string; ai_driver_name?: string | null; gamertag_snapshot?: string | null; number?: number | null }
// This existing private roster table predates the generated client snapshot.
// Extend its read contract locally; do not create another client or change RLS.
type ResultsDatabase = Omit<Database, 'public'> & { public: Omit<Database['public'], 'Tables'> & { Tables: Tables & {
  season_driver_assignments: { Row: ResultsAssignment & { season_id: string }; Insert: never; Update: never; Relationships: [] }
} } };
export interface ResultsData { season: { id: string; name: string } | null; drivers: ResultsDriver[]; races: ResultsRace[]; results: PublishedResult[]; assignments: ResultsAssignment[] }
export interface ResultCell { points: number; isBot: boolean; hasFastestLap: boolean; carName: string }
export interface MatrixRow { driver: ResultsDriver; raceCells: ResultCell[]; total: number }
export interface ResultsMatrix { completedRaces: ResultsRace[]; rows: MatrixRow[] }

export function fastestLapDriver(rows: PublishedResult[]): string | null {
  let best = Infinity;
  let winner: string | null = null;
  for (const row of rows) {
    const numeric = [row.fastest_lap_time_ms, row.fastest_lap_ms].find((value) => value != null && Number.isFinite(Number(value)) && Number(value) > 0);
    const match = row.fastest_lap_time?.trim().replace(',', '.').match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
    const lap = numeric != null ? Number(numeric) : match ? (Number(match[1] ?? 0) * 60 + Number(match[2])) * 1000 : null;
    if (lap != null && lap > 0 && lap < best) { best = lap; winner = row.driver_id; }
  }
  return winner;
}

export function currentResults(races: ResultsRace[], results: PublishedResult[]) {
  const versions = new Map(races.map((race) => [race.id, race.current_result_version_id]));
  return results.filter((row) => Boolean(versions.get(row.race_id)) && versions.get(row.race_id) === row.result_version_id);
}

export function buildResultsMatrix(data: ResultsData): ResultsMatrix {
  const results = currentResults(data.races, data.results);
  const resultRaceIds = new Set(results.map((row) => row.race_id));
  const completedRaces = data.races.filter((race) => race.status === 'completed' || resultRaceIds.has(race.id)).sort((a, b) => b.round_number - a.round_number);
  const byRace = new Map(completedRaces.map((race) => [race.id, results.filter((row) => row.race_id === race.id)]));
  const fastest = new Map(completedRaces.map((race) => [race.id, fastestLapDriver(byRace.get(race.id)!)]));
  const roster = new Set(data.assignments.map((row) => row.driver_id));
  const hasRoster = roster.size > 0;
  results.forEach((row) => roster.add(row.points_owner_driver_id || row.driver_id));
  const drivers = hasRoster ? data.drivers.filter((driver) => roster.has(driver.id)) : data.drivers;
  const rows = drivers.map((driver) => {
    const assignment = data.assignments.filter((row) => row.driver_id === driver.id).at(-1);
    const raceCells = completedRaces.map((race): ResultCell => {
      const owned = byRace.get(race.id)!.filter((row) => (row.points_owner_driver_id || row.driver_id) === driver.id);
      return {
        // Published awarded_points includes bonuses and steward decisions. Never recalculate it here.
        points: owned.reduce((sum, row) => sum + Number(row.awarded_points), 0),
        isBot: owned.some((row) => row.participation_status?.toUpperCase() === 'BOT'),
        hasFastestLap: owned.some((row) => row.driver_id === fastest.get(race.id)),
        carName: owned[0]?.points_car_name || owned[0]?.car_name_snapshot || assignment?.car_name || driver.car_name || '—',
      };
    });
    return { driver, raceCells, total: raceCells.reduce((sum, cell) => sum + cell.points, 0) };
  }).sort((a, b) => b.total - a.total || a.driver.display_name.localeCompare(b.driver.display_name, 'de'));
  return { completedRaces, rows };
}

export function resultSeries(matrix: ResultsMatrix) {
  const races = [...matrix.completedRaces].reverse();
  const series = matrix.rows.map((row) => {
    let points = 0;
    return { driver: row.driver, values: [...row.raceCells].reverse().map((cell) => (points += cell.points)) };
  });
  const leaders = races.map((_, i) => Math.max(0, ...series.map((row) => row.values[i])));
  return { races, series, leaders };
}

export function resultsFocusIds(rows: MatrixRow[], mode: string, own: string, compare: string[], compact: boolean) {
  const valid = new Set(rows.map((row) => row.driver.id));
  const ids = mode === 'own' ? [own] : mode === 'compare' ? [own, ...compare.slice(0, 2)] : [...rows.slice(0, compact ? 3 : 5).map((row) => row.driver.id), own];
  const selected = [...new Set(ids.filter((id) => valid.has(id)))];
  return selected.length ? selected : rows.slice(0, compact ? 3 : 5).map((row) => row.driver.id);
}

export async function loadResults(client: LeagueSupabaseClient, slug: string, authenticated: boolean, signal: AbortSignal): Promise<ResultsData> {
  const league = await client.from('leagues').select('id').eq('slug', slug).abortSignal(signal).single();
  signal.throwIfAborted();
  if (league.error) throw league.error;
  const seasonResponse = await client.from('seasons').select('id,name').eq('league_id', league.data.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).abortSignal(signal).maybeSingle();
  signal.throwIfAborted();
  if (seasonResponse.error) throw seasonResponse.error;
  const season = seasonResponse.data;
  if (!season) return { season: null, drivers: [], races: [], results: [], assignments: [] };
  const [driversResponse, racesResponse] = await Promise.all([
    client.from('drivers').select('id,display_name,gamertag,car_name,league_team,is_active,number,nationality_code,avatar_url,ai_driver_reference').eq('league_id', league.data.id).order('display_name').limit(500).abortSignal(signal),
    client.from('races').select('id,season_id,round_number,grand_prix_name,country_code,status,current_result_version_id').eq('season_id', season.id).order('round_number').limit(500).abortSignal(signal),
  ]);
  signal.throwIfAborted();
  if (driversResponse.error) throw driversResponse.error;
  if (racesResponse.error) throw racesResponse.error;
  const drivers = driversResponse.data ?? [];
  const races = racesResponse.data ?? [];
  const published = races.filter((race) => race.current_result_version_id);
  const results: PublishedResult[] = [];
  // Bound URL length and page explicitly: a full season can exceed the API's row cap.
  for (let offset = 0; offset < published.length; offset += 40) {
    const chunk = published.slice(offset, offset + 40);
    let complete = false;
    for (let page = 0; page < 20; page++) {
      signal.throwIfAborted();
      const response = await client.from('race_results').select('id,race_id,result_version_id,driver_id,points_owner_driver_id,awarded_points,participation_status,fastest_lap_time_ms,fastest_lap_ms,fastest_lap_time,points_car_name,car_name_snapshot,finish_position,points_team_name')
        .in('race_id', chunk.map((race) => race.id)).in('result_version_id', chunk.map((race) => race.current_result_version_id!))
        .order('race_id').order('id').range(page * 1000, page * 1000 + 999).abortSignal(signal);
      signal.throwIfAborted();
      if (response.error) throw response.error;
      results.push(...response.data);
      if (response.data.length < 1000) { complete = true; break; }
    }
    if (!complete) throw new Error('Results pagination limit reached; refusing partial totals.');
  }
  let assignments: ResultsAssignment[];
  if (authenticated) {
    const rosterClient = client as unknown as SupabaseClient<ResultsDatabase>;
    const response = await rosterClient.from('season_driver_assignments').select('id,driver_id,car_name,created_at,team_name,seat_code,participant_type,ai_driver_name,gamertag_snapshot,number').eq('season_id', season.id).order('created_at').limit(1000).abortSignal(signal);
    signal.throwIfAborted();
    if (response.error) throw response.error;
    assignments = response.data;
  } else {
    assignments = currentResults(races, results).map((row) => ({ driver_id: row.driver_id, car_name: row.car_name_snapshot, created_at: '', team_name: !row.points_owner_driver_id || row.points_owner_driver_id === row.driver_id ? row.points_team_name : '', effective_round_number: races.find((race) => race.id === row.race_id)!.round_number }));
  }
  return { season, drivers, races, results: currentResults(races, results), assignments };
}

export async function loadResultsOwnDriver(client: LeagueSupabaseClient, userId: string, drivers: ResultsDriver[], signal: AbortSignal) {
  if (!userId) return '';
  const identity = await client.from('driver_identities').select('id').eq('user_id', userId).abortSignal(signal).maybeSingle();
  signal.throwIfAborted();
  if (identity.error) throw identity.error;
  if (!identity.data) return '';
  const links = await client.from('driver_identity_links').select('driver_id').eq('driver_identity_id', identity.data.id).abortSignal(signal);
  signal.throwIfAborted();
  if (links.error) throw links.error;
  const available = new Set(drivers.map((driver) => driver.id));
  return links.data.find((link) => available.has(link.driver_id))?.driver_id ?? '';
}
