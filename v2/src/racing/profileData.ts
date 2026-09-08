import type { SupabaseClient } from '@supabase/supabase-js';
import type { LeagueSupabaseClient } from '../lib/supabase';
import type { Database } from '../types/database';
import { currentResults, fastestLapDriver, type PublishedResult, type ResultsAssignment, type ResultsDriver, type ResultsRace } from './resultsData';

type Tables = Database['public']['Tables'];
export type HistorySeason = Pick<Tables['seasons']['Row'], 'id' | 'name' | 'start_date' | 'created_at' | 'is_active'>;
export type HistoryRace = ResultsRace & Pick<Tables['races']['Row'], 'circuit_name' | 'race_date' | 'race_start_at' | 'race_time' | 'weather'>;
export type HistoryResult = PublishedResult & Pick<Tables['race_results']['Row'], 'grid_position' | 'race_time'> & Partial<Pick<Tables['race_results']['Row'], 'race_time_ms'>>;
export type HistoryAssignment = ResultsAssignment & { season_id: string };
type HistoryDatabase = Omit<Database, 'public'> & { public: Omit<Database['public'], 'Tables'> & { Tables: Tables & { season_driver_assignments: { Row: HistoryAssignment; Insert: never; Update: never; Relationships: [] } } } };
export interface HistoryData { leagueId: string; seasons: HistorySeason[]; drivers: ResultsDriver[]; races: HistoryRace[]; results: HistoryResult[]; assignments: HistoryAssignment[]; profileNumbers: Record<string, number> }

// Every query has a stable order and explicit pagination. Never show partial career totals.
export async function readHistoryPages<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, signal: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < 100; page++) {
    signal.throwIfAborted();
    const response = await query(page * 1000, page * 1000 + 999);
    signal.throwIfAborted();
    if (response.error) throw response.error;
    rows.push(...response.data ?? []);
    if ((response.data?.length ?? 0) < 1000) return rows;
  }
  throw new Error('History pagination limit reached');
}

export async function loadHistory(client: LeagueSupabaseClient, slug: string, userId: string, signal: AbortSignal, raceSeason?: string): Promise<HistoryData> {
  const league = await client.from('leagues').select('id').eq('slug', slug).abortSignal(signal).single();
  signal.throwIfAborted();
  if (league.error) throw league.error;
  const leagueId = league.data.id;
  const [seasons, drivers] = await Promise.all([
    readHistoryPages((from, to) => client.from('seasons').select('id,name,start_date,created_at,is_active').eq('league_id', leagueId).order('created_at').order('id').range(from, to).abortSignal(signal), signal),
    readHistoryPages((from, to) => client.from('drivers').select('id,display_name,gamertag,car_name,league_team,is_active,number,nationality_code,avatar_url,ai_driver_reference').eq('league_id', leagueId).order('id').range(from, to).abortSignal(signal), signal),
  ]);
  const races: HistoryRace[] = [];
  const assignments: HistoryAssignment[] = [];
  const roster = client as unknown as SupabaseClient<HistoryDatabase>;
  // Race details only need their selected season; an invalid ID never falls back.
  const selectedSeasons = raceSeason === 'active' ? seasons.filter((season) => season.is_active).slice(-1) : raceSeason ? seasons.filter((season) => season.id === raceSeason) : seasons;
  for (let offset = 0; offset < selectedSeasons.length; offset += 40) {
    const ids = selectedSeasons.slice(offset, offset + 40).map((season) => season.id);
    races.push(...await readHistoryPages((from, to) => client.from('races').select('id,season_id,round_number,grand_prix_name,country_code,status,current_result_version_id,circuit_name,race_date,race_start_at,race_time,weather').in('season_id', ids).order('id').range(from, to).abortSignal(signal), signal));
    if (userId) assignments.push(...await readHistoryPages((from, to) => roster.from('season_driver_assignments').select('id,season_id,driver_id,car_name,created_at,team_name,seat_code,participant_type,ai_driver_name,gamertag_snapshot,number').in('season_id', ids).order('created_at').order('id').range(from, to).abortSignal(signal), signal));
  }
  const results: HistoryResult[] = [];
  const published = races.filter((race) => race.current_result_version_id);
  for (let offset = 0; offset < published.length; offset += 40) {
    const chunk = published.slice(offset, offset + 40);
    results.push(...await readHistoryPages((from, to) => client.from('race_results').select('id,race_id,result_version_id,driver_id,points_owner_driver_id,awarded_points,participation_status,fastest_lap_time_ms,fastest_lap_ms,fastest_lap_time,points_car_name,car_name_snapshot,finish_position,points_team_name,grid_position,race_time,race_time_ms').in('race_id', chunk.map((race) => race.id)).in('result_version_id', chunk.map((race) => race.current_result_version_id!)).order('race_id').order('id').range(from, to).abortSignal(signal), signal));
  }
  const valid = currentResults(races, results) as HistoryResult[];
  const profileNumbers: Record<string, number> = {};
  if (userId) {
    // Optional own profile number must not hide otherwise available racing history.
    const identity = await client.from('driver_identities').select('id,profile_number').eq('user_id', userId).abortSignal(signal).maybeSingle();
    signal.throwIfAborted();
    if (!identity.error && identity.data) {
      const links = await client.from('driver_identity_links').select('driver_id').eq('driver_identity_id', identity.data.id).abortSignal(signal);
      signal.throwIfAborted();
      const number = identity.data.profile_number;
      if (!links.error && number != null && Number.isInteger(number) && number >= 0 && number <= 99) for (const link of links.data) if (drivers.some((driver) => driver.id === link.driver_id)) profileNumbers[link.driver_id] = number;
    }
  }
  return { leagueId, seasons, drivers, races, results: valid, assignments, profileNumbers };
}

export const position = (value: unknown): number | null => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
export const points = (row: PublishedResult) => Number(row.awarded_points) || 0;
export const owner = (row: PublishedResult) => row.points_owner_driver_id || row.driver_id;
const average = (values: (number | null)[]) => { const usable = values.filter((n): n is number => n != null); return usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : null; };
export function historyRaceOrder(data: HistoryData, race: HistoryRace) {
  const season = data.seasons.find((entry) => entry.id === race.season_id);
  return (Date.parse(season?.start_date || season?.created_at || '') || 0) * 1000 + (Date.parse(race.race_date || race.race_start_at || '') || 0) + race.round_number;
}
export function completedHistory(data: HistoryData, seasonId = '') {
  const publishedIds = new Set(data.results.map((row) => row.race_id));
  return data.races.filter((race) => (!seasonId || race.season_id === seasonId) && (race.status === 'completed' || publishedIds.has(race.id))).sort((a, b) => historyRaceOrder(data, a) - historyRaceOrder(data, b));
}
export function historySnapshot(data: HistoryData, driverId: string, race: HistoryRace) {
  const driver = data.drivers.find((item) => item.id === driverId);
  const assignment = data.assignments.filter((row) => row.driver_id === driverId && row.season_id === race.season_id && (row.effective_round_number ?? 0) <= race.round_number).sort((a, b) => (a.effective_round_number ?? 0) - (b.effective_round_number ?? 0) || a.created_at.localeCompare(b.created_at)).at(-1);
  const published = data.results.find((row) => row.race_id === race.id && row.driver_id === driverId);
  // Published car snapshots preserve mid-season vehicle changes and historical races.
  return { ...driver, display_name: driver?.display_name || '—', car_name: published?.car_name_snapshot || assignment?.car_name || driver?.car_name || '', league_team: assignment?.team_name || (published && owner(published) === driverId ? published.points_team_name : '') || driver?.league_team || '' };
}
export function driverEntries(data: HistoryData, driverId: string, seasonId = '') {
  return completedHistory(data, seasonId).flatMap((race) => { const row = data.results.find((item) => item.race_id === race.id && item.driver_id === driverId); return row ? [{ race, row }] : []; });
}
function metrics(entries: ReturnType<typeof driverEntries>, data: HistoryData) {
  const finishes = entries.map(({ row }) => position(row.finish_position));
  return { starts: entries.length, wins: finishes.filter((n) => n === 1).length, podiums: finishes.filter((n) => n != null && n <= 3).length, poles: entries.filter(({ row }) => position(row.grid_position) === 1).length, fastestLaps: entries.filter(({ race, row }) => fastestLapDriver(data.results.filter((r) => r.race_id === race.id)) === row.driver_id).length, bestFinish: finishes.some((n) => n != null) ? Math.min(...finishes.filter((n): n is number => n != null)) : null };
}
export function driverStats(data: HistoryData, driverId: string, seasonId = '') {
  const entries = driverEntries(data, driverId, seasonId);
  const races = completedHistory(data, seasonId);
  const ids = new Set(races.map((race) => race.id));
  const owned = data.results.filter((row) => ids.has(row.race_id) && owner(row) === driverId);
  const gain = (row: HistoryResult) => { const start = position(row.grid_position), finish = position(row.finish_position); return start != null && finish != null ? start - finish : null; };
  const dnfs = entries.filter(({ row }) => position(row.finish_position) == null).length;
  const tracks = [...new Set(entries.map(({ race }) => race.circuit_name || race.grand_prix_name))].map((name) => { const selected = entries.filter(({ race }) => (race.circuit_name || race.grand_prix_name) === name); return { name, ...metrics(selected, data), points: selected.reduce((sum, { row }) => sum + (owner(row) === driverId ? points(row) : 0), 0) }; }).sort((a, b) => b.wins - a.wins || b.podiums - a.podiums || b.points - a.points || a.name.localeCompare(b.name)).slice(0, 8);
  const teams = new Map<string, { team: string; car: string; starts: number }>();
  entries.forEach(({ race }) => { const snapshot = historySnapshot(data, driverId, race); const team = snapshot.league_team || snapshot.car_name || '—', car = snapshot.car_name; const key = `${team}::${car}`; const value = teams.get(key) || { team, car, starts: 0 }; value.starts++; teams.set(key, value); });
  const seasons = [...new Set(races.map((race) => race.season_id))].map((id) => ({ seasonId: id, seasonName: data.seasons.find((season) => season.id === id)?.name || '—', ...metrics(entries.filter(({ race }) => race.season_id === id), data), points: owned.filter((row) => data.races.find((race) => race.id === row.race_id)?.season_id === id).reduce((sum, row) => sum + points(row), 0) })).filter((value) => value.starts || value.points).reverse();
  return { ...metrics(entries, data), points: owned.reduce((sum, row) => sum + points(row), 0), dnfs, avgStart: average(entries.map(({ row }) => position(row.grid_position))), avgFinish: average(entries.map(({ row }) => position(row.finish_position))), positionsGained: entries.reduce((sum, { row }) => sum + (gain(row) ?? 0), 0), finishRate: entries.length ? (entries.length - dnfs) / entries.length : null, recent: entries.slice(-5).reverse().map((entry) => ({ ...entry, gain: gain(entry.row), points: owner(entry.row) === driverId ? points(entry.row) : 0 })), seasons, tracks, teams: [...teams.values()], snapshot: entries.length ? historySnapshot(data, driverId, entries.at(-1)!.race) : data.drivers.find((driver) => driver.id === driverId) };
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));
export function driverPerformance(data: HistoryData, driverId: string, seasonId = '') {
  const scored = driverEntries(data, driverId, seasonId).map((entry) => {
    const rows = data.results.filter((row) => row.race_id === entry.race.id);
    const size = Math.max(rows.length, 1), finish = position(entry.row.finish_position), grid = position(entry.row.grid_position);
    const percentile = (n: number) => size === 1 ? 1 : clamp(1 - (n - 1) / (size - 1));
    const max = Math.max(0, ...rows.map(points));
    const components = { finish: finish == null ? 0 : percentile(finish), qualifying: grid == null ? null : percentile(grid), points: max > 0 ? clamp(points(entry.row) / max) : null, racecraft: grid != null && finish != null ? clamp(.5 + (grid - finish) / (Math.max(5, size / 2) * 2)) : null, reliability: finish == null ? 0 : 1 };
    const weights = { finish: .4, qualifying: .2, points: .2, racecraft: .1, reliability: .1 };
    const keys = (Object.keys(components) as (keyof typeof components)[]).filter((key) => components[key] != null);
    return { ...entry, components, score: keys.reduce((sum, key) => sum + components[key]! * weights[key], 0) / keys.reduce((sum, key) => sum + weights[key], 0) * 100 };
  });
  const weighted = (entries: typeof scored, key?: keyof typeof scored[number]['components']) => {
    let total = 0, weight = 0;
    [...entries].reverse().forEach((entry, index) => { const value = key ? entry.components[key] : entry.score; if (value == null) return; const w = Math.max(.6, 1 - index * .1); total += value * w * (key ? 100 : 1); weight += w; });
    return weight ? Math.round(total / weight) : null;
  };
  const current = scored.slice(-5), previous = scored.slice(-10, -5), score = weighted(current), old = weighted(previous);
  return { score, sampleSize: current.length, previousSampleSize: previous.length, trend: score != null && old != null ? score - old : null, components: { finish: weighted(current, 'finish'), qualifying: weighted(current, 'qualifying'), points: weighted(current, 'points'), racecraft: weighted(current, 'racecraft'), reliability: weighted(current, 'reliability') } };
}

const norm = (name: string) => name.trim().toLocaleLowerCase('de');
const actualTeam = (data: HistoryData, row: HistoryResult, race: HistoryRace) => { const snapshot = historySnapshot(data, row.driver_id, race); return snapshot.league_team || snapshot.car_name || row.points_team_name || ''; };
export function teamNames(data: HistoryData, seasonId = '') {
  const names = new Map<string, string>();
  const add = (name: string) => { if (norm(name) && !names.has(norm(name))) names.set(norm(name), name); };
  for (const race of completedHistory(data, seasonId)) for (const row of data.results.filter((r) => r.race_id === race.id)) { add(actualTeam(data, row, race)); add(row.points_team_name || actualTeam(data, row, race)); }
  data.assignments.filter((row) => !seasonId || row.season_id === seasonId).forEach((row) => add(row.team_name || row.car_name || ''));
  if (!names.size) data.drivers.forEach((row) => add(row.league_team || row.car_name || ''));
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'de'));
}
export function teamStats(data: HistoryData, name: string, seasonId = '') {
  const drivers = new Map<string, { driverId: string; name: string; starts: number; wins: number; podiums: number; points: number }>();
  const cars = new Map<string, number>();
  const races = completedHistory(data, seasonId).flatMap((race) => {
    const rows = data.results.filter((row) => row.race_id === race.id);
    const actual = rows.filter((row) => norm(actualTeam(data, row, race)) === norm(name));
    const owned = rows.filter((row) => norm(row.points_team_name || actualTeam(data, row, race)) === norm(name));
    if (!actual.length && !owned.length) return [];
    const entries = actual.map((row) => ({ race, row }));
    for (const row of actual) {
      const snapshot = historySnapshot(data, row.driver_id, race), finish = position(row.finish_position);
      const value = drivers.get(row.driver_id) || { driverId: row.driver_id, name: snapshot.display_name, starts: 0, wins: 0, podiums: 0, points: 0 };
      value.starts++; value.wins += finish === 1 ? 1 : 0; value.podiums += finish != null && finish <= 3 ? 1 : 0; drivers.set(row.driver_id, value);
      if (snapshot.car_name) cars.set(snapshot.car_name, (cars.get(snapshot.car_name) || 0) + 1);
    }
    for (const row of owned) { const value = drivers.get(owner(row)); if (value) value.points += points(row); }
    return [{ race, ...metrics(entries, data), drivers: actual.map((row) => ({ driverId: row.driver_id, name: historySnapshot(data, row.driver_id, race).display_name })), points: owned.reduce((sum, row) => sum + points(row), 0) }];
  });
  const sum = (subset: typeof races) => ({ races: subset.length, starts: subset.reduce((n, r) => n + r.starts, 0), wins: subset.reduce((n, r) => n + r.wins, 0), podiums: subset.reduce((n, r) => n + r.podiums, 0), poles: subset.reduce((n, r) => n + r.poles, 0), fastestLaps: subset.reduce((n, r) => n + r.fastestLaps, 0), points: subset.reduce((n, r) => n + r.points, 0), bestFinish: subset.some((r) => r.bestFinish != null) ? Math.min(...subset.flatMap((r) => r.bestFinish == null ? [] : [r.bestFinish])) : null });
  return { ...sum(races), drivers: [...drivers.values()].sort((a, b) => b.starts - a.starts || b.points - a.points || a.name.localeCompare(b.name)), cars: [...cars].map(([name, starts]) => ({ name, starts })).sort((a, b) => b.starts - a.starts), recent: races.slice(-5).reverse(), seasons: [...new Set(races.map((r) => r.race.season_id))].map((id) => ({ seasonId: id, seasonName: data.seasons.find((season) => season.id === id)?.name || '—', ...sum(races.filter((r) => r.race.season_id === id)) })).reverse() };
}
