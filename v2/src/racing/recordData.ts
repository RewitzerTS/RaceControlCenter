import { completedHistory, driverEntries, driverStats, historySnapshot, owner, points, position, teamNames, teamStats, type HistoryData } from './profileData';

export function calculateRecords(data: HistoryData, season = '') {
  const drivers = data.drivers.map((driver) => ({ driver, ...driverStats(data, driver.id, season) })).filter((stat) => stat.starts > 0);
  const teams = teamNames(data, season).map((teamName) => ({ teamName, ...teamStats(data, teamName, season) })).filter((stat) => stat.races > 0);
  const topDrivers = (field: 'wins' | 'points' | 'poles' | 'podiums') => [...drivers].sort((a, b) => b[field] - a[field] || a.driver.display_name.localeCompare(b.driver.display_name, 'de')).slice(0, 5);
  const topTeams = (field: 'wins' | 'points' | 'poles' | 'podiums') => [...teams].sort((a, b) => b[field] - a[field] || a.teamName.localeCompare(b.teamName, 'de')).slice(0, 5);
  type Streak = { driver: HistoryData['drivers'][number]; value: number };
  const streak = (predicate: (entry: ReturnType<typeof driverEntries>[number]) => boolean) => {
    let best: Streak | null = null;
    for (const { driver } of drivers) { let current = 0, value = 0; for (const entry of driverEntries(data, driver.id, season)) { current = predicate(entry) ? current + 1 : 0; value = Math.max(value, current); } if (value > 0 && (!best || value > best.value || (value === best.value && driver.display_name.localeCompare(best.driver.display_name, 'de') < 0))) best = { driver, value }; }
    return best;
  };
  let comeback: { driverId: string; name: string; gain: number; grid: number; finish: number; race: HistoryData['races'][number] } | null = null;
  const specialists = new Map<string, { driverId: string; name: string; track: string; wins: number }>();
  for (const race of completedHistory(data, season)) for (const row of data.results.filter((r) => r.race_id === race.id)) {
    const grid = position(row.grid_position), finish = position(row.finish_position), snapshot = historySnapshot(data, row.driver_id, race);
    if (grid != null && finish != null && grid > finish && (!comeback || grid - finish > comeback.gain)) comeback = { driverId: row.driver_id, name: snapshot.display_name, gain: grid - finish, grid, finish, race };
    if (finish === 1) { const track = (race.circuit_name || race.grand_prix_name).trim(), key = `${row.driver_id}::${track.toLocaleLowerCase('de')}`; const value = specialists.get(key) || { driverId: row.driver_id, name: snapshot.display_name, track, wins: 0 }; value.wins++; specialists.set(key, value); }
  }
  const avgFinish = [...drivers].filter((d) => d.starts >= 3 && d.avgFinish != null).sort((a, b) => a.avgFinish! - b.avgFinish! || a.driver.display_name.localeCompare(b.driver.display_name, 'de'))[0] || null;
  const finishRate = [...drivers].filter((d) => d.starts >= 5 && d.finishRate != null).sort((a, b) => b.finishRate! - a.finishRate! || a.driver.display_name.localeCompare(b.driver.display_name, 'de'))[0] || null;
  const positionsGained = [...drivers].filter((d) => d.positionsGained > 0).sort((a, b) => b.positionsGained - a.positionsGained || a.driver.display_name.localeCompare(b.driver.display_name, 'de'))[0] || null;
  return { drivers, teams, raceCount: completedHistory(data, season).length, topDrivers, topTeams, specials: {
    comeback, winStreak: streak(({ row }) => position(row.finish_position) === 1), podiumStreak: streak(({ row }) => { const p = position(row.finish_position); return p != null && p <= 3; }), pointsStreak: streak(({ row }) => owner(row) === row.driver_id && points(row) > 0), specialist: [...specialists.values()].sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name, 'de'))[0] || null, avgFinish, finishRate, positionsGained,
  } };
}

export interface Champion { season_name: string; driver_champion: string; driver_champion_team: string; constructor_champion: string; constructor_champion_lineup: string }
export function normalizeChampions(value: unknown): Champion[] {
  if (!value || typeof value !== 'object' || !('history' in value) || !Array.isArray(value.history)) return [];
  return value.history.filter((item): item is Champion => item && typeof item === 'object' && ['season_name', 'driver_champion', 'driver_champion_team', 'constructor_champion', 'constructor_champion_lineup'].every((key) => typeof item[key] === 'string') && item.driver_champion.trim() && item.constructor_champion.trim()).sort((a, b) => Number(b.season_name.match(/\d+/)?.[0] || 0) - Number(a.season_name.match(/\d+/)?.[0] || 0));
}
export async function loadHistoricChampions(slug: string, signal: AbortSignal, request: typeof fetch = fetch) {
  // Owner-confirmed on 2026-09-08: this supplied archive belongs exclusively to rcc.
  if (slug !== 'rcc') return [];
  const response = await request('/v1-data/hall-of-fame-fallback.json', { signal });
  if (!response.ok) throw new Error('Champion archive unavailable');
  const result = normalizeChampions(await response.json()); signal.throwIfAborted(); return result;
}
export function championTotals(records: Champion[]) {
  const people = new Map<string, { name: string; driver: number; constructor: number }>(), teams = new Map<string, number>();
  const person = (name: string) => { if (!people.has(name)) people.set(name, { name, driver: 0, constructor: 0 }); return people.get(name)!; };
  for (const record of records) {
    person(record.driver_champion.trim()).driver++;
    teams.set(record.constructor_champion.trim(), (teams.get(record.constructor_champion.trim()) || 0) + 1);
    for (const raw of record.constructor_champion_lineup.split('&')) { const name = raw.trim().match(/^([^()]+)/)?.[1].trim(); if (name) person(name).constructor++; }
  }
  return { people: [...people.values()].sort((a, b) => (b.driver + b.constructor) - (a.driver + a.constructor) || b.driver - a.driver || a.name.localeCompare(b.name, 'de')), teams: [...teams].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'de')) };
}
