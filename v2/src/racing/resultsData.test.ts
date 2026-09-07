import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from '../types/database';
import { buildResultsMatrix, currentResults, fastestLapDriver, loadResults, loadResultsOwnDriver, resultSeries, resultsFocusIds, type PublishedResult, type ResultsData } from './resultsData';
import { resultsMessages } from './resultsMessages';

const drivers = ['seat', 'historical', 'unused'].map((id) => ({ id, display_name: id, gamertag: null, car_name: 'Car', league_team: 'Team', is_active: true }));
const races = [1, 2].map((round) => ({ id: `race-${round}`, season_id: 'season', round_number: round, grand_prix_name: `Race ${round}`, country_code: 'DE', status: 'completed', current_result_version_id: `version-${round}` }));
const result = (values: Partial<PublishedResult> = {}): PublishedResult => ({ id: 'result', race_id: 'race-1', result_version_id: 'version-1', driver_id: 'seat', points_owner_driver_id: null, awarded_points: 25, participation_status: 'HUMAN', fastest_lap_time_ms: 80000, fastest_lap_ms: null, fastest_lap_time: null, points_car_name: null, car_name_snapshot: 'Published car', ...values });
const data = (results = [result()]): ResultsData => ({ season: { id: 'season', name: 'Season' }, drivers, races, results, assignments: [{ driver_id: 'seat', car_name: 'Current car', created_at: '' }] });

describe('native result calculations', () => {
  it('preserves authoritative scores, substitutes, BOT markers and historical owners', () => {
    const matrix = buildResultsMatrix(data([result({ driver_id: 'sub', points_owner_driver_id: 'historical', awarded_points: 24, participation_status: 'BOT', points_car_name: 'Historical car' }), result({ id: 'human', driver_id: 'seat', awarded_points: 18, fastest_lap_time_ms: 81000 })]));
    expect(matrix.rows.map((row) => row.driver.id)).toEqual(['historical', 'seat']);
    expect(matrix.rows[0].total).toBe(24);
    expect(matrix.rows[0].raceCells[1]).toEqual({ points: 24, isBot: true, hasFastestLap: true, carName: 'Historical car' });
    expect(matrix.rows[1].raceCells[1].isBot).toBe(false);
    expect(matrix.rows[0].raceCells[0]).toMatchObject({ points: 0, isBot: false, hasFastestLap: false });
  });
  it('ignores superseded, draft and mismatched race/version pairs', () => {
    const rows = [result(), result({ id: 'old', result_version_id: 'old', awarded_points: 999 }), result({ id: 'other', race_id: 'race-2', result_version_id: 'version-1' })];
    expect(currentResults(races, rows)).toEqual([rows[0]]);
    expect(buildResultsMatrix(data(rows)).rows[0].total).toBe(25);
  });
  it('finds fastest laps using canonical milliseconds, compatibility values and text without inventing a winner', () => {
    expect(fastestLapDriver([result({ fastest_lap_time_ms: null, fastest_lap_time: '1:20,001' }), result({ driver_id: 'second', fastest_lap_time_ms: 79999 })])).toBe('second');
    expect(fastestLapDriver([result({ fastest_lap_time_ms: 0, fastest_lap_ms: 80000 })])).toBe('seat');
    expect(fastestLapDriver([result({ fastest_lap_time_ms: null, fastest_lap_time: 'invalid' })])).toBeNull();
    expect(fastestLapDriver([result(), result({ driver_id: 'tied' })])).toBe('seat');
  });
  it('matches the incumbent matrix for versioned scores including a steward deduction', () => {
    const context: Record<string, any> = { window: {}, document: { addEventListener() {} } };
    for (const path of ['services/rcc-data.js', 'services/rcc-result-data-compat.js', 'pages/results.js']) runInNewContext(readFileSync(`../assets/js/${path}`, 'utf8'), context);
    const input = data([result({ awarded_points: 24 }), result({ id: 'r2', race_id: 'race-2', result_version_id: 'version-2', awarded_points: 26, participation_status: 'BOT' })]);
    const resolver = { resolveDriverSnapshot: () => ({ car_name: 'Published car' }) };
    const legacy = context.buildMatrixData(input.drivers, input.races, input.results, resolver, { enabled: true, points: 1, maxFinishPosition: 10 }, input.assignments);
    expect(JSON.parse(JSON.stringify(legacy))).toEqual(buildResultsMatrix(input));
  });
  it('preserves chronological totals and gap against all drivers, not just those selected', () => {
    const matrix = buildResultsMatrix(data([result(), result({ id: 'r2', race_id: 'race-2', result_version_id: 'version-2', awarded_points: 18 })]));
    expect(resultSeries(matrix).series[0].values).toEqual([25, 43]);
    expect(resultSeries(matrix).leaders).toEqual([25, 43]);
    const rows = Array.from({ length: 8 }, (_, index) => ({ ...matrix.rows[0], driver: { ...drivers[0], id: String(index) } }));
    expect(resultsFocusIds(rows, 'leaders', '7', [], true)).toEqual(['0', '1', '2', '7']);
    expect(resultsFocusIds(rows, 'compare', '7', ['3', '3'], false)).toEqual(['7', '3']);
    expect(resultsFocusIds(rows, 'own', '7', [], false)).toEqual(['7']);
    expect(resultsFocusIds(rows, 'own', 'missing', [], false)).toEqual(['0', '1', '2', '3', '4']);
  });
  it('covers every message in all app languages', () => {
    for (const copy of Object.values(resultsMessages)) expect(Object.keys(copy).sort()).toEqual(Object.keys(resultsMessages.de).sort());
  });
});

function fixture(options: { noSeason?: boolean; fail?: string; paged?: boolean; onSeason?: () => void } = {}) {
  const requests: URL[] = [];
  const client = createClient<Database>('https://results-test.supabase.co', 'test-publishable-key', { auth: { persistSession: false, autoRefreshToken: false, storageKey: crypto.randomUUID() }, global: { fetch: async (input) => {
    const url = new URL(String(input)); requests.push(url);
    const table = url.pathname.split('/').pop();
    if (options.fail === table) return new Response(JSON.stringify({ message: 'Test failure' }), { status: 403 });
    if (table === 'seasons') options.onSeason?.();
    const body = table === 'leagues' ? { id: 'league' } : table === 'seasons' ? options.noSeason ? null : { id: 'season', name: 'Season' } : table === 'drivers' ? drivers : table === 'races' ? races : table === 'race_results' ? options.paged && url.searchParams.get('offset') === '0' ? Array.from({ length: 1000 }, (_, i) => result({ id: String(i) })) : [result()] : table === 'driver_identities' ? { id: 'identity' } : table === 'driver_identity_links' ? [{ driver_id: 'unrelated' }, { driver_id: 'seat' }] : data().assignments;
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  } } });
  return { client, requests };
}
describe('native result queries', () => {
  it('scopes data to league/season and published versions; anonymous users never request the roster', async () => {
    const { client, requests } = fixture();
    const loaded = await loadResults(client, 'qa-league', false, new AbortController().signal);
    expect(loaded.results).toHaveLength(1);
    expect(requests[0].searchParams.get('slug')).toBe('eq.qa-league');
    expect(requests.find((url) => url.pathname.endsWith('/seasons'))?.searchParams.get('league_id')).toBe('eq.league');
    expect(requests.find((url) => url.pathname.endsWith('/drivers'))?.searchParams.get('league_id')).toBe('eq.league');
    expect(requests.find((url) => url.pathname.endsWith('/races'))?.searchParams.get('season_id')).toBe('eq.season');
    expect(requests.find((url) => url.pathname.endsWith('/race_results'))?.searchParams.get('result_version_id')).toContain('version-1');
    expect(requests.some((url) => url.pathname.endsWith('/season_driver_assignments'))).toBe(false);
  });
  it('reads the scoped private roster only for an authenticated view', async () => {
    const { client, requests } = fixture();
    await loadResults(client, 'qa-league', true, new AbortController().signal);
    expect(requests.find((url) => url.pathname.endsWith('/season_driver_assignments'))?.searchParams.get('season_id')).toBe('eq.season');
  });
  it('paginates instead of silently truncating season totals', async () => {
    const { client, requests } = fixture({ paged: true });
    expect((await loadResults(client, 'qa', false, new AbortController().signal)).results).toHaveLength(1001);
    expect(requests.filter((url) => url.pathname.endsWith('/race_results'))).toHaveLength(2);
  });
  it('does not fall back to another season and surfaces core query failures', async () => {
    const empty = fixture({ noSeason: true });
    expect((await loadResults(empty.client, 'qa', false, new AbortController().signal)).season).toBeNull();
    expect(empty.requests).toHaveLength(2);
    const failed = fixture({ fail: 'race_results' });
    await expect(loadResults(failed.client, 'qa', false, new AbortController().signal)).rejects.toBeTruthy();
  });
  it('stops a stale league load before further queries', async () => {
    const controller = new AbortController();
    const { client, requests } = fixture({ onSeason: () => controller.abort() });
    await expect(loadResults(client, 'qa', false, controller.signal)).rejects.toBeTruthy();
    expect(requests).toHaveLength(2);
  });
  it('resolves only the signed-in identity and a driver present in this league', async () => {
    const { client, requests } = fixture();
    expect(await loadResultsOwnDriver(client, 'user', drivers, new AbortController().signal)).toBe('seat');
    expect(requests[0].searchParams.get('user_id')).toBe('eq.user');
    expect(requests[1].searchParams.get('driver_identity_id')).toBe('eq.identity');
  });
});
