import { buildStandings, type StandingsData } from '../racing/standingsData';
import type { PublishedResult } from '../racing/resultsData';
import type { LeagueSupabaseClient } from '../lib/supabase';

export interface ReverseGridSnapshot {
  generatedAt: string;
  data: StandingsData | null;
  seats: { driverId: string; aiName: string | null; gamertag: string | null; isAi: boolean }[];
  drafts: { raceId: string; raceName: string; round: number; versionId: string; versionNumber: number; rows: PublishedResult[] }[];
}
export async function loadReverseGrid(client: LeagueSupabaseClient, includeDrafts: boolean, signal: AbortSignal) {
  const response = await client.rpc('get_reverse_grid_workspace', { p_include_drafts: includeDrafts }).abortSignal(signal);
  signal.throwIfAborted();
  if (response.error) throw response.error;
  const snapshot = response.data as unknown as ReverseGridSnapshot;
  if (!snapshot || !Array.isArray(snapshot.seats) || !Array.isArray(snapshot.drafts)
    || (!includeDrafts && snapshot.drafts.length)) throw new Error('REVERSE_GRID_INVALID_RESPONSE');
  return snapshot;
}
export function buildReverseGrid(snapshot: ReverseGridSnapshot) {
  if (!snapshot.data) return [];
  const overrides = new Map(snapshot.drafts.map(draft => [draft.raceId, draft]));
  if (overrides.size !== snapshot.drafts.length) throw new Error('REVERSE_GRID_DUPLICATE_DRAFT');
  for (const draft of snapshot.drafts) {
    if (!snapshot.data.races.some(race => race.id === draft.raceId && race.status !== 'cancelled')
      || draft.rows.some(row => row.race_id !== draft.raceId || row.result_version_id !== draft.versionId)) throw new Error('REVERSE_GRID_INVALID_DRAFT');
  }
  const data: StandingsData = { ...snapshot.data,
    races: snapshot.data.races.map(race => overrides.has(race.id) ? { ...race, status: 'completed', current_result_version_id: overrides.get(race.id)!.versionId } : race),
    results: [...snapshot.data.results.filter(row => !overrides.has(row.race_id)), ...snapshot.drafts.flatMap(draft => draft.rows)],
  };
  return buildStandings(data).driverStandings.map((driver, index) => {
    const seat = snapshot.seats.find(seat => seat.driverId === driver.driverId);
    return { ...driver, championshipPosition: index + 1, aiName: seat?.aiName ?? null,
      gamertag: seat?.gamertag || data.drivers.find(item => item.id === driver.driverId)?.gamertag || null,
      isAi: seat?.isAi ?? false };
  }).reverse().map((driver, index) => ({ ...driver, gridPosition: index + 1 }));
}
