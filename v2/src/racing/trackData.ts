import { calendarTrack } from './calendarData';
import { completedHistory, historySnapshot, owner, points, position, type HistoryData, type HistoryRace, type HistoryResult } from './profileData';
import { fastestLapDriver } from './resultsData';
import facts from './trackFacts.json';

export const normalizeTrack = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export function trackMeta(race: HistoryRace, data: HistoryData) {
  const track = calendarTrack(race, data.seasons.find((s) => s.id === race.season_id)?.game_key || '');
  return { key: track?.key || normalizeTrack(race.circuit_name || race.grand_prix_name), name: track?.grandPrixName || race.grand_prix_name, circuit: race.circuit_name || track?.circuitName || '', country: track?.countryCode || race.country_code || '', track };
}
export function listHistoryTracks(data: HistoryData, season = '') {
  const map = new Map<string, ReturnType<typeof trackMeta>>();
  for (const race of completedHistory(data, season)) { const meta = trackMeta(race, data); if (meta.key && !map.has(meta.key)) map.set(meta.key, meta); }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
export function trackFacts(meta: ReturnType<typeof trackMeta>) {
  return facts.find((entry) => entry.id === meta.key) || facts.find((entry) => [entry.officialName, ...entry.aliases].some((alias) => normalizeTrack(alias) === normalizeTrack(meta.circuit))) || null;
}
export function lapMilliseconds(row: HistoryResult) {
  const numeric = [row.fastest_lap_time_ms, row.fastest_lap_ms].find((n) => n != null && Number.isFinite(n) && n > 0);
  if (numeric != null) return numeric;
  const text = row.fastest_lap_time?.trim().replace(',', '.');
  if (!text || !/^\d+(?::\d+){0,2}(?:\.\d+)?$/.test(text)) return null;
  const parts = text.split(':').map(Number); const value = parts.reduce((n, part) => n * 60 + part, 0) * 1000;
  return value > 0 && Number.isFinite(value) ? Math.round(value) : null;
}
export function formatLap(ms: number | null) { return ms == null ? '—' : `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(3).padStart(6, '0')}`; }
interface Lap { ms: number; text: string; race: HistoryRace; driverId: string; name: string }
interface TrackDriver { driverId: string; name: string; starts: number; wins: number; podiums: number; poles: number; fastestLaps: number; points: number; bestFinish: number | null; bestLap: Lap | null }
export function trackStats(data: HistoryData, key: string, season = '') {
  const races = completedHistory(data, season).filter((race) => trackMeta(race, data).key === key);
  if (!races.length) return null;
  const drivers = new Map<string, TrackDriver>(); let starts = 0; let bestLap: Lap | null = null;
  const history = races.map((race) => {
    const rows = data.results.filter((row) => row.race_id === race.id), fastest = fastestLapDriver(rows);
    let winner: TrackDriver | null = null;
    for (const row of rows) {
      if (!row.driver_id) continue;
      const snapshot = historySnapshot(data, row.driver_id, race);
      const bucket = drivers.get(row.driver_id) || { driverId: row.driver_id, name: snapshot.display_name, starts: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, points: 0, bestFinish: null, bestLap: null };
      const finish = position(row.finish_position); bucket.starts++; starts++;
      if (finish === 1) { bucket.wins++; winner = bucket; }
      if (finish != null && finish <= 3) bucket.podiums++;
      if (position(row.grid_position) === 1) bucket.poles++;
      if (row.driver_id === fastest) bucket.fastestLaps++;
      if (finish != null) bucket.bestFinish = Math.min(bucket.bestFinish ?? finish, finish);
      if (owner(row) === row.driver_id) bucket.points += points(row);
      const ms = lapMilliseconds(row);
      if (ms != null) { const lap = { ms, text: row.fastest_lap_time || formatLap(ms), race, driverId: row.driver_id, name: bucket.name }; if (!bucket.bestLap || ms < bucket.bestLap.ms) bucket.bestLap = lap; if (!bestLap || ms < bestLap.ms) bestLap = lap; }
      drivers.set(row.driver_id, bucket);
    }
    const fastestRow = rows.find((row) => row.driver_id === fastest);
    return { race, winner, fastest: fastestRow ? { driverId: fastestRow.driver_id, name: historySnapshot(data, fastestRow.driver_id, race).display_name, text: fastestRow.fastest_lap_time || formatLap(lapMilliseconds(fastestRow)) } : null };
  });
  const records = [...drivers.values()].sort((a, b) => b.wins - a.wins || b.podiums - a.podiums || b.points - a.points || a.name.localeCompare(b.name, 'de'));
  const leader = (field: 'wins' | 'podiums' | 'poles' | 'fastestLaps' | 'points' | 'starts', tie: 'wins' | 'points') => [...records].sort((a, b) => b[field] - a[field] || b[tie] - a[tie])[0] || null;
  return { meta: trackMeta(races.at(-1)!, data), races: races.length, starts, uniqueDrivers: drivers.size, bestLap: bestLap as Lap | null, records, history: history.reverse(), leaders: { wins: leader('wins', 'points'), podiums: leader('podiums', 'wins'), poles: leader('poles', 'wins'), fastestLaps: leader('fastestLaps', 'wins'), points: leader('points', 'wins'), starts: leader('starts', 'points') } };
}
