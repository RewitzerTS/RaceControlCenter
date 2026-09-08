import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { completedHistory, driverStats, driverPerformance, historySnapshot, loadHistory, readHistoryPages, teamStats, type HistoryData } from './profileData';
import { fastestLapDriver } from './resultsData';

export function fixture(): HistoryData {
  const seasons = [{ id: 's1', name: 'Season one', start_date: '2025-01-01', created_at: '2025-01-01', is_active: false }, { id: 's2', name: 'Season two', start_date: '2026-01-01', created_at: '2026-01-01', is_active: true }];
  const drivers = [0, 1, 2].map((n) => ({ id: `d${n}`, display_name: `Driver ${n}`, gamertag: null, car_name: 'Car', league_team: 'Team', is_active: true }));
  const races = Array.from({ length: 9 }, (_, n) => ({ id: `r${n}`, season_id: n < 3 ? 's1' : 's2', round_number: n + 1, grand_prix_name: 'Japan GP', circuit_name: 'Suzuka', race_date: `2026-01-${String(n + 1).padStart(2, '0')}`, race_start_at: null, race_time: null, weather: 'dynamic', country_code: 'JP', status: 'completed', current_result_version_id: `v${n}` }));
  const results = races.flatMap((race, index) => drivers.slice(0, 2).map((driver, i) => ({ id: `${race.id}-${i}`, race_id: race.id, result_version_id: race.current_result_version_id, driver_id: driver.id, points_owner_driver_id: index === 8 && i === 0 ? 'd2' : null, awarded_points: i === 0 ? 26 : 18, finish_position: index === 5 ? null : i + 1, grid_position: index === 4 ? null : 2 - i, participation_status: 'HUMAN', fastest_lap_time_ms: 90000 + i * 1000, fastest_lap_ms: null, fastest_lap_time: null, race_time: '1:00:00', points_car_name: 'Car', car_name_snapshot: 'Car', points_team_name: 'Team' })));
  return { leagueId: 'l', seasons, drivers, races, results, assignments: [], profileNumbers: {} };
}
function legacy(data: HistoryData) {
  const context: Record<string, any> = { window: {} };
  for (const path of ['rcc-data.js', 'rcc-result-data-compat.js', 'rcc-driver-context.js', 'rcc-driver-stats.js', 'rcc-driver-performance.js', 'rcc-team-stats.js']) runInNewContext(readFileSync(`../assets/js/services/${path}`, 'utf8'), context);
  const history = { seasons: data.seasons, drivers: data.drivers, assignments: data.assignments, races: data.races, completedRaces: completedHistory(data), raceResults: data.results, seasonsById: new Map(data.seasons.map((s) => [s.id, s])), driversById: new Map(data.drivers.map((d) => [d.id, d])), resultsByRace: new Map(data.races.map((r) => [r.id, data.results.filter((row) => row.race_id === r.id)])), fastestByRace: new Map(data.races.map((r) => [r.id, fastestLapDriver(data.results.filter((row) => row.race_id === r.id))])), resolver: context.window.RCCDriverContext.createAssignmentResolver({ drivers: data.drivers, races: data.races, assignments: data.assignments }) };
  return { api: context.window, history };
}
describe('native racing profile calculations', () => {
  it.each(['', 's1', 's2'])('retains driver and performance calculations for scope %s', (scope) => {
    const data = fixture(), old = legacy(data);
    for (const driver of data.drivers) {
      const expected = old.api.RCCDriverStats.calculateDriverStats(driver.id, old.history, { seasonId: scope });
      const actual = driverStats(data, driver.id, scope);
      for (const key of ['starts', 'wins', 'podiums', 'poles', 'fastestLaps', 'points', 'avgStart', 'avgFinish', 'positionsGained', 'dnfs', 'finishRate', 'bestFinish'] as const) expect(actual[key], key).toEqual(expected[key]);
      expect(actual.seasons).toEqual(expected.seasonBreakdown);
      const performance = driverPerformance(data, driver.id, scope);
      const oldPerformance = old.api.RCCDriverPerformance.calculate(driver.id, old.history, { seasonId: scope });
      for (const key of ['score', 'trend', 'sampleSize', 'previousSampleSize', 'components'] as const) expect(performance[key], key).toEqual(oldPerformance[key]);
    }
  });
  it('retains team totals, car history and driver statistics', () => {
    const data = fixture(), old = legacy(data);
    for (const scope of ['', 's1', 's2']) {
      const expected = old.api.RCCTeamStats.calculateTeamStats('Team', old.history, { seasonId: scope });
      const actual = teamStats(data, 'Team', scope);
      for (const key of ['races', 'starts', 'wins', 'podiums', 'poles', 'fastestLaps', 'points', 'bestFinish', 'drivers', 'cars'] as const) expect(actual[key], key).toEqual(expected[key]);
    }
  });
  it('separates substitute starts from represented driver points', () => {
    const stats = driverStats(fixture(), 'd2');
    expect(stats.starts).toBe(0); expect(stats.points).toBe(26); expect(stats.wins).toBe(0);
  });
  it('uses the published vehicle and never an assignment from another season', () => {
    const data = fixture();
    data.assignments = [{ driver_id: 'd0', season_id: 'other', car_name: 'Wrong', team_name: 'Wrong', created_at: '2030-01-01' }];
    expect(historySnapshot(data, 'd0', data.races[0])).toMatchObject({ car_name: 'Car', league_team: 'Team' });
    data.results[0].car_name_snapshot = 'Historical car';
    expect(historySnapshot(data, 'd0', data.races[0]).car_name).toBe('Historical car');
  });
  it('empty history produces no invented rating or starts', () => {
    const data = { ...fixture(), races: [], results: [] };
    expect(driverPerformance(data, 'd0').score).toBeNull();
    expect(driverStats(data, 'd0').finishRate).toBeNull();
    expect(teamStats(data, 'Team').races).toBe(0);
  });
  it('paginates beyond the API cap and refuses a failed later page', async () => {
    const signal = new AbortController().signal;
    expect(await readHistoryPages(async (from) => ({ data: from === 0 ? Array(1000).fill(1) : [2], error: null }), signal)).toHaveLength(1001);
    await expect(readHistoryPages(async (from) => ({ data: from === 0 ? Array(1000).fill(1) : null, error: from ? new Error('Failed page') : null }), signal)).rejects.toThrow('Failed page');
  });
  it('aborts without sending another request', async () => {
    const controller = new AbortController(); controller.abort();
    let called = false;
    await expect(readHistoryPages(async () => { called = true; return { data: [], error: null }; }, controller.signal)).rejects.toThrow();
    expect(called).toBe(false);
  });
});

describe('native history queries', () => {
  function clientFixture(fail = '') {
    const data = fixture(), requests: URL[] = [];
    const tables: Record<string, unknown> = { leagues: { id: 'l' }, seasons: data.seasons, drivers: data.drivers, races: data.races, race_results: [...data.results, { ...data.results[0], id: 'stale', result_version_id: 'old', awarded_points: 999 }], season_driver_assignments: [], driver_identities: { id: 'identity', profile_number: 8 }, driver_identity_links: [{ driver_id: 'd0' }, { driver_id: 'outside-league' }] };
    const client = createClient<Database>('https://history-test.supabase.co', 'test-publishable-key', { auth: { persistSession: false, autoRefreshToken: false, storageKey: crypto.randomUUID() }, global: { fetch: async (input) => {
      const url = new URL(String(input)); requests.push(url);
      const table = url.pathname.split('/').pop()!;
      return new Response(JSON.stringify(table === fail ? { message: 'Test failure' } : tables[table] ?? []), { status: table === fail ? 403 : 200, headers: { 'Content-Type': 'application/json' } });
    } } });
    return { client, requests, data };
  }
  it('queries only league seasons and exact published results without requesting private public-user data', async () => {
    const { client, requests, data } = clientFixture();
    const loaded = await loadHistory(client, 'qa', '', new AbortController().signal);
    expect(loaded.results).toHaveLength(data.results.length);
    expect(requests[0].searchParams.get('slug')).toBe('eq.qa');
    for (const table of ['seasons', 'drivers']) expect(requests.find((url) => url.pathname.endsWith(`/${table}`))?.searchParams.get('league_id')).toBe('eq.l');
    expect(requests.find((url) => url.pathname.endsWith('/races'))?.searchParams.get('season_id')).toContain('s1,s2');
    expect(requests.find((url) => url.pathname.endsWith('/race_results'))?.searchParams.get('result_version_id')).toContain('v0');
    expect(requests.some((url) => /season_driver_assignments|driver_identities|driver_identity_links/.test(url.pathname))).toBe(false);
  });
  it('scopes the authenticated roster and own identity explicitly', async () => {
    const { client, requests } = clientFixture();
    const loaded = await loadHistory(client, 'qa', 'signed-in-user', new AbortController().signal);
    expect(requests.find((url) => url.pathname.endsWith('/season_driver_assignments'))?.searchParams.get('season_id')).toContain('s1,s2');
    expect(requests.find((url) => url.pathname.endsWith('/driver_identities'))?.searchParams.get('user_id')).toBe('eq.signed-in-user');
    expect(loaded.profileNumbers).toEqual({ d0: 8 });
  });
  it('limits race details to the requested season and rejects unknown seasons without race queries', async () => {
    const selected = clientFixture();
    await loadHistory(selected.client, 'qa', '', new AbortController().signal, 's2');
    expect(selected.requests.find((url) => url.pathname.endsWith('/races'))?.searchParams.get('season_id')).toBe('in.(s2)');
    const unknown = clientFixture();
    const loaded = await loadHistory(unknown.client, 'qa', '', new AbortController().signal, 'missing');
    expect(loaded.races).toEqual([]);
    expect(unknown.requests.some((url) => url.pathname.endsWith('/races'))).toBe(false);
  });
  it('surfaces missing core history, but an unavailable optional own number does not hide results', async () => {
    await expect(loadHistory(clientFixture('race_results').client, 'qa', '', new AbortController().signal)).rejects.toBeTruthy();
    expect((await loadHistory(clientFixture('driver_identities').client, 'qa', 'user', new AbortController().signal)).results.length).toBeGreaterThan(0);
  });
});
