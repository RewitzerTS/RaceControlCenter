import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createClient } from '@supabase/supabase-js';
import { describe, it, expect, vi } from 'vitest';
import type { Database } from '../types/database';
import { completedHistory, type HistoryData } from './profileData';
import { fastestLapDriver } from './resultsData';
import { calendarTrack } from './calendarData';
import { trackStats, listHistoryTracks, lapMilliseconds, formatLap, trackMeta, trackFacts } from './trackData';
import { calculateRecords, championTotals, normalizeChampions, loadHistoricChampions } from './recordData';
import { normalizeRules, loadRules } from './RacingRules';
import { historyMessages } from './historyMessages';
import facts from './trackFacts.json';

function fixture(): HistoryData {
  const seasons = [{ id: 's1', name: 'Old season', created_at: '2025-01-01', start_date: '2025-01-01', is_active: false }, { id: 's2', name: 'Season two', created_at: '2026-01-01', start_date: '2026-01-01', is_active: true }];
  const drivers = [0, 1, 2].map((n) => ({ id: `d${n}`, display_name: `Driver ${n}`, gamertag: null, car_name: 'Car', league_team: 'Team', is_active: true }));
  const races = Array.from({ length: 7 }, (_, n) => ({ id: `r${n}`, season_id: n < 2 ? 's1' : 's2', round_number: n + 1, grand_prix_name: 'Japan GP', circuit_name: 'Suzuka International Racing Course', race_date: `2026-01-${String(n + 1).padStart(2, '0')}`, race_start_at: null, race_time: null, weather: 'dynamic', country_code: 'JP', status: 'completed', current_result_version_id: `v${n}` }));
  const results = races.flatMap((race, n) => drivers.slice(0, 2).map((driver, i) => ({ id: `${race.id}-${i}`, race_id: race.id, result_version_id: race.current_result_version_id, driver_id: driver.id, points_owner_driver_id: n === 6 && i === 0 ? 'd2' : null, awarded_points: i ? 18 : 26, finish_position: n === 3 ? null : i + 1, grid_position: 2 - i, participation_status: 'PLAYER', fastest_lap_time_ms: null, fastest_lap_ms: null, fastest_lap_time: i ? '1:31.000' : '1:30.000', race_time: '1:00:00', points_car_name: 'Car', car_name_snapshot: 'Car', points_team_name: 'Team' })));
  return { leagueId: 'l', seasons, drivers, races, results, assignments: [], profileNumbers: {} };
}
function legacy(data: HistoryData) {
  const context: Record<string, any> = { window: {} };
  for (const path of ['rcc-data.js', 'rcc-result-data-compat.js', 'rcc-driver-context.js', 'rcc-driver-stats.js', 'rcc-team-stats.js', 'rcc-track-stats.js', 'rcc-records.js']) runInNewContext(readFileSync(`../assets/js/services/${path}`, 'utf8'), context);
  context.window.getRaceTrackMeta = (race: HistoryData['races'][number]) => ({ track: calendarTrack(race) });
  const history = { seasons: data.seasons, drivers: data.drivers, assignments: [], races: data.races, completedRaces: completedHistory(data), raceResults: data.results, seasonsById: new Map(data.seasons.map((s) => [s.id, s])), driversById: new Map(data.drivers.map((d) => [d.id, d])), resultsByRace: new Map(data.races.map((r) => [r.id, data.results.filter((row) => row.race_id === r.id)])), fastestByRace: new Map(data.races.map((r) => [r.id, fastestLapDriver(data.results.filter((row) => row.race_id === r.id))])), resolver: context.window.RCCDriverContext.createAssignmentResolver({ drivers: data.drivers, races: data.races, assignments: [] }) };
  return { api: context.window, history };
}
describe('native track and record parity', () => {
  it.each(['', 's1', 's2'])('preserves track records and leaders for %s', (season) => {
    const data = fixture(), old = legacy(data), expected = old.api.RCCTrackStats.calculateTrackStats('japan', old.history, { seasonId: season }), actual = trackStats(data, 'japan', season)!;
    for (const key of ['races', 'starts', 'uniqueDrivers'] as const) expect(actual[key]).toEqual(expected[key]);
    const fields = (rows: any[]) => rows.map(({ driverId, name, starts, wins, podiums, poles, fastestLaps, points, bestFinish }) => ({ driverId, name, starts, wins, podiums, poles, fastestLaps, points, bestFinish }));
    expect(fields(actual.records)).toEqual(fields(expected.driverRecords));
    for (const field of ['wins', 'podiums', 'poles', 'fastestLaps', 'points', 'starts'] as const) expect(actual.leaders[field]?.driverId).toBe(expected.leaders[field]?.driverId);
    expect(actual.bestLap?.ms).toBe(expected.bestLap.ms);
    expect(actual.history.map((r) => r.race.id)).toEqual(expected.raceHistory.map((r: any) => r.race.id));
  });
  it.each(['', 's1', 's2'])('preserves record leaderboards and special calculations for %s', (season) => {
    const data = fixture(), old = legacy(data), expected = old.api.RCCRecords.calculate(old.history, { seasonId: season }), actual = calculateRecords(data, season);
    expect(actual.raceCount).toBe(expected.raceCount);
    for (const field of ['wins', 'points', 'poles', 'podiums'] as const) {
      expect(actual.topDrivers(field).map((d) => [d.driver.id, d[field]])).toEqual(expected.leaderboards.drivers[field].map((d: any) => [d.driver.id, d[field]]));
      expect(actual.topTeams(field).map((d) => [d.teamName, d[field]])).toEqual(expected.leaderboards.teams[field].map((d: any) => [d.teamName, d[field]]));
    }
    for (const field of ['winStreak', 'podiumStreak', 'pointsStreak'] as const) expect(actual.specials[field]?.value ?? null).toBe(expected.specials[field]?.value ?? null);
    expect(actual.specials.comeback?.gain).toBe(expected.specials.comeback?.gain);
    expect(actual.specials.specialist?.wins).toBe(expected.specials.specialist?.wins);
    expect(actual.specials.avgFinish?.avgFinish ?? null).toBe(expected.specials.avgFinish?.avgFinish ?? null);
    expect(actual.specials.finishRate?.finishRate ?? null).toBe(expected.specials.finishRate?.finishRate ?? null);
  });
  it('does not invent tracks, laps or special records for empty or unknown selections', () => {
    const data = fixture(); expect(trackStats(data, 'missing')).toBeNull(); expect(listHistoryTracks(data, 'missing')).toEqual([]);
    const empty = calculateRecords({ ...data, races: [], results: [] }); expect(empty.raceCount).toBe(0); expect(Object.values(empty.specials)).toEqual(Array(8).fill(null));
    expect(formatLap(null)).toBe('—'); expect(lapMilliseconds({ ...data.results[0], fastest_lap_time: 'DNF' })).toBeNull();
  });
  it('uses canonical lap milliseconds, game-aware tracks and the unchanged facts catalogue', () => {
    const data = fixture(); data.results[0].fastest_lap_time = 'invalid';
    expect(lapMilliseconds({ ...data.results[0], fastest_lap_time_ms: 89999 })).toBe(89999); expect(formatLap(89999)).toBe('1:29.999');
    data.seasons[0].game_key = 'f1_26';
    expect(trackMeta({ ...data.races[0], grand_prix_name: 'Spanien GP' }, data).key).toBe('madrid');
    const context = { window: {} as { TRACK_INFOS?: typeof facts } }; runInNewContext(readFileSync('../assets/js/data/track-info.js', 'utf8'), context); expect(facts).toEqual(context.window.TRACK_INFOS);
    expect(trackFacts(trackMeta(data.races[0], data))?.id).toBe('japan');
  });
  it('removes Racing embedding while retaining Career compatibility', () => {
    const source = readFileSync('src/driver/RacingPage.tsx', 'utf8'); expect(source).not.toMatch(/LegacyLeagueView|<iframe/);
    expect(readFileSync('src/driver/CareerPage.tsx', 'utf8')).toContain('LegacyLeagueView');
    expect(readFileSync('src/components/LegacyLeagueView.tsx', 'utf8')).not.toMatch(/integrated-standings-switcher|mapDialog|page === 'regeln-faq'/);
  });
});
describe('rules and confirmed historical data', () => {
  it('preserves configured FAQ text, explicit false and zero without rendering markup', () => {
    const data = normalizeRules({ rules: { fastest_lap_point: false, ai_strength: 0 }, faqs: [{ question: '<b>Q</b>', answer: 'A\nB' }, { question: '', answer: 'invalid' }] });
    expect(data.rules.fastest_lap_point).toBe('false'); expect(data.rules.ai_strength).toBe('0'); expect(data.faqs).toEqual([{ question: '<b>Q</b>', answer: 'A\nB' }]);
    expect(normalizeRules({}).faqs).toHaveLength(5);
  });
  it('scopes the rules read explicitly and propagates an unavailable endpoint', async () => {
    const urls: URL[] = []; let failure = false;
    const client = createClient<Database>('https://rules-test.supabase.co', 'test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input) => { urls.push(new URL(String(input))); return new Response(JSON.stringify(failure ? { message: 'No access' } : { settings: { rules: { ai_strength: '80' } } }), { status: failure ? 403 : 200, headers: { 'Content-Type': 'application/json' } }); } } });
    expect((await loadRules(client, 'qa', new AbortController().signal)).rules.ai_strength).toBe('80'); expect(urls[0].searchParams.get('slug')).toBe('eq.qa');
    failure = true; await expect(loadRules(client, 'qa', new AbortController().signal)).rejects.toBeTruthy();
  });
  it('never requests or shows rcc historical champions for another league', async () => {
    const request = vi.fn(); expect(await loadHistoricChampions('qa', new AbortController().signal, request)).toEqual([]); expect(request).not.toHaveBeenCalled();
    const payload = JSON.parse(readFileSync('../data/hall-of-fame-fallback.json', 'utf8'));
    request.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })); const records = await loadHistoricChampions('rcc', new AbortController().signal, request);
    expect(records).toHaveLength(13); expect(records[0].season_name).toBe('13'); expect(championTotals(records).teams[0].name).toBe('Team RusIta');
    expect(normalizeChampions({ history: [{ season_name: '999' }] })).toEqual([]);
    request.mockResolvedValue(new Response('', { status: 503 })); await expect(loadHistoricChampions('rcc', new AbortController().signal, request)).rejects.toBeTruthy();
  });
  it('has complete labels in all four app languages', () => { for (const copy of Object.values(historyMessages)) expect(Object.keys(copy).sort()).toEqual(Object.keys(historyMessages.de).sort()); });
});
