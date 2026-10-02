import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { describe, expect, it } from 'vitest';
import { buildStandings, loadStandings, standingSnapshot, standingTrend, type StandingsData } from './standingsData';
import { currentResults, type PublishedResult, type ResultsData } from './resultsData';
import { standingsMessages } from './standingsMessages';

const drivers = ['Änne', 'Béla', 'Sub', 'Unused'].map((name, index) => ({ id: String(index), display_name: name, gamertag: null, is_active: index !== 3, car_name: 'Old car', league_team: 'Old team' }));
const races = [1, 2].map((round) => ({ id: `r${round}`, season_id: 's', round_number: round, grand_prix_name: 'Race', country_code: 'DE', status: 'completed', current_result_version_id: `v${round}` }));
const result = (patch: Partial<PublishedResult> = {}): PublishedResult => ({ id: 'result', race_id: 'r1', result_version_id: 'v1', driver_id: '0', points_owner_driver_id: null, awarded_points: 26, finish_position: 1, participation_status: 'HUMAN', fastest_lap_time_ms: 80000, fastest_lap_ms: null, fastest_lap_time: null, points_car_name: 'Published car', points_team_name: 'Team A', car_name_snapshot: 'Published car', ...patch });
const fixture = (): ResultsData => ({ season: { id: 's', name: 'Season' }, drivers, races, assignments: drivers.slice(0, 2).map((driver) => ({ driver_id: driver.id, team_name: 'Team A', car_name: 'Car A', created_at: '' })), results: [result(), result({ id: 'second', driver_id: '1', awarded_points: 18, finish_position: 2, fastest_lap_time_ms: 81000 }), result({ id: 'sub', race_id: 'r2', result_version_id: 'v2', driver_id: '2', points_owner_driver_id: '1', awarded_points: 26 })] });

describe('native championship', () => {
  it('matches the incumbent driver and team values including substitution and tie-breaks', () => {
    const context: Record<string, any> = { window: {} };
    for (const path of ['rcc-data.js', 'rcc-result-data-compat.js', 'rcc-driver-context.js']) runInNewContext(readFileSync(`../assets/js/services/${path}`, 'utf8'), context);
    for (const source of [fixture(), { ...fixture(), results: [] }, { ...fixture(), assignments: [] }, { ...fixture(), results: [...fixture().results, result({ id: 'tie', race_id: 'r2', result_version_id: 'v2', awarded_points: 18, finish_position: 2, fastest_lap_time_ms: 85000 })] }]) {
      const resolver = context.window.RCCDriverContext.createAssignmentResolver({ drivers: source.drivers, races: source.races, assignments: source.assignments.map((row) => ({ ...row, season_id: 's' })) });
      const legacy = context.window.RCCData.buildStandings({ drivers: source.drivers, races: source.races, raceResults: currentResults(source.races, source.results), resolver, eligibleDriverIds: source.assignments.length ? source.assignments.map((row) => row.driver_id) : source.drivers.filter((row) => row.is_active).map((row) => row.id), includeZeroPointDrivers: true });
      const native = buildStandings(source);
      expect(native.driverStandings.map(({ trend: _trend, ...row }) => row)).toEqual(JSON.parse(JSON.stringify(legacy.driverStandings.map(({ normalizedName: _name, ...row }: any) => row))));
      expect(native.teamStandings.map((row) => ({ teamName: row.teamName, points: row.points, driver1: row.drivers[0]?.name || '—', car1: row.drivers[0]?.car || '—', driver2: row.drivers[1]?.name || '—', car2: row.drivers[1]?.car || '—' }))).toEqual(JSON.parse(JSON.stringify(legacy.teamStandings)));
    }
  });
  it('uses official points once and credits wins, podiums and fastest laps to the represented driver', () => {
    const table = buildStandings(fixture());
    expect(table.driverStandings[0]).toMatchObject({ driverId: '1', points: 44, wins: 1, podiums: 2, fastestLaps: 1, trend: 'up' });
    expect(table.driverStandings[1]).toMatchObject({ driverId: '0', points: 26, trend: 'down' });
    expect(table.teamStandings[0].points).toBe(70);
  });
  it('excludes superseded results and their wins and fastest laps', () => {
    const data = fixture();
    data.results.push(result({ result_version_id: 'old', awarded_points: 999, fastest_lap_time_ms: 1 }));
    expect(buildStandings(data)).toEqual(buildStandings(fixture()));
  });
  it('preserves measured fastest laps outside the top ten without adding a bonus', () => {
    const data = fixture(); data.results = [result({ awarded_points: 0, finish_position: 15 })];
    expect(buildStandings(data).driverStandings[0]).toMatchObject({ driverId: '0', points: 0, fastestLaps: 1, wins: 0, podiums: 0 });
  });
  it('keeps historical team points separate across a mid-season team change', () => {
    const data = fixture(); data.results = [result(), result({ id: 'new-team', race_id: 'r2', result_version_id: 'v2', points_team_name: 'Team B', awarded_points: 18, finish_position: 2 })];
    expect(buildStandings(data).teamStandings.map((row) => [row.teamName, row.points, row.trend])).toEqual([['Team A', 26, 'flat'], ['Team B', 18, 'new']]);
    expect(buildStandings(data).driverStandings[0].points).toBe(44);
  });
  it('resolves anonymous published car snapshots at the appropriate round', () => {
    const data = fixture();
    data.assignments = [{ driver_id: '0', team_name: 'Team A', car_name: 'Car A', effective_round_number: 1, created_at: '' }, { driver_id: '0', team_name: 'Team B', car_name: 'Car B', effective_round_number: 2, created_at: '' }];
    expect(standingSnapshot(data, '0', races[0])?.car_name).toBe('Car A');
    expect(standingSnapshot(data, '0', races[1])?.car_name).toBe('Car B');
  });
  it('keeps all assigned zero-point drivers and neutral trends before the second race', () => {
    const data = fixture(); data.races = races.slice(0, 1); data.results = [];
    expect(buildStandings(data).driverStandings.map((row) => [row.driverId, row.points, row.trend])).toEqual([['0', 0, 'flat'], ['1', 0, 'flat']]);
    expect(buildStandings(data).teamStandings).toEqual([]);
    expect(standingTrend(0, -1, false)).toBe('flat');
  });
  it('covers all app languages', () => {
    for (const copy of Object.values(standingsMessages)) expect(Object.keys(copy).sort()).toEqual(Object.keys(standingsMessages.de).sort());
  });
  it('shows all three effective teams before the first race despite empty initial team assignments', () => {
    const source: StandingsData = {
      season: { id: 's', name: 'Season 15' },
      races: races.map(race => ({ ...race, status: 'upcoming', current_result_version_id: null })), results: [],
      drivers: Array.from({ length: 6 }, (_, i) => ({ ...drivers[0], id: String(i), display_name: `Driver ${i}`, league_team: 'Previous season team' })),
      assignments: Array.from({ length: 6 }, (_, i) => ({ driver_id: String(i), car_name: 'Car A', team_name: i < 2 ? 'Ice Team' : '', created_at: '' })),
      currentRoster: Array.from({ length: 6 }, (_, i) => ({ driver_id: String(i), team_name: ['Ice Team', 'Black Team', 'Stars Team'][Math.floor(i / 2)], car_name: 'Current car' })),
    };
    const table = buildStandings(source);
    expect(table.driverStandings.map(row => row.leagueTeam)).toEqual(['Ice Team', 'Ice Team', 'Black Team', 'Black Team', 'Stars Team', 'Stars Team']);
    expect(table.driverStandings.every(row => row.points === 0 && row.trend === 'flat')).toBe(true);
    expect(source.assignments[2].team_name).toBe('');
  });
  it('uses the current team and car only for display, preserving published historical team points', () => {
    const original = buildStandings(fixture());
    const current = buildStandings({ ...fixture(), currentRoster: [
      { driver_id: '0', team_name: 'Next Team', car_name: 'Next Car' },
      { driver_id: '1', team_name: null, car_name: 'Other Car' },
    ] });
    expect(current.driverStandings.find(row => row.driverId === '0')).toMatchObject({ leagueTeam: 'Next Team', carName: 'Next Car', points: 26 });
    expect(current.driverStandings.find(row => row.driverId === '1')).toMatchObject({ leagueTeam: 'Ohne Team', points: 44 });
    expect(current.teamStandings).toEqual(original.teamStandings);
    expect(current.driverStandings.map(({ leagueTeam: _team, carName: _car, ...row }) => row))
      .toEqual(original.driverStandings.map(({ leagueTeam: _team, carName: _car, ...row }) => row));
  });
  it('includes newly assigned drivers and keeps departed point owners without reviving old season profiles', () => {
    const table = buildStandings({ ...fixture(), currentRoster: [{ driver_id: '3', team_name: 'New Team', car_name: 'Car' }] });
    expect(table.driverStandings.map(row => row.driverId)).toEqual(['1', '0', '3']);
    expect(table.driverStandings.at(-1)).toMatchObject({ points: 0, leagueTeam: 'New Team' });
    expect(buildStandings({ ...fixture(), results: [], currentRoster: [] }).driverStandings).toEqual([]);
  });
});

describe('championship roster loading', () => {
  function clientFixture(options: { fail?: boolean; empty?: boolean; noSeason?: boolean; abort?: AbortController } = {}) {
    const requests: { url: URL; body: string }[] = [];
    const source = fixture();
    const client = createClient<Database>('https://standings-test.supabase.co', 'test-publishable-key', {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: crypto.randomUUID() },
      global: { fetch: async (input, init) => {
        const url = new URL(String(input)); requests.push({ url, body: String(init?.body ?? '') });
        const name = url.pathname.split('/').pop();
        if (name === 'get_season_championship_roster') {
          options.abort?.abort();
          return new Response(JSON.stringify(options.fail ? { message: 'No access' } : options.empty ? [] : [{ driver_id: '0', team_name: 'Current Team', car_name: 'Current Car' }]), { status: options.fail ? 403 : 200, headers: { 'Content-Type': 'application/json' } });
        }
        const tables: Record<string, unknown> = { leagues: { id: 'league' }, seasons: options.noSeason ? null : source.season, drivers: source.drivers, races: source.races, race_results: source.results, season_driver_assignments: source.assignments };
        return new Response(JSON.stringify(tables[name!] ?? []), { headers: { 'Content-Type': 'application/json' } });
      } },
    });
    return { client, requests };
  }
  it('reads the selected season roster and preserves result snapshots', async () => {
    const { client, requests } = clientFixture();
    const data = await loadStandings(client, 'league', true, new AbortController().signal);
    expect(JSON.parse(requests.at(-1)!.body)).toEqual({ p_season_id: 's' });
    expect(data.currentRoster?.[0].team_name).toBe('Current Team');
    expect(data.assignments[0].team_name).toBe('Team A');
    expect(data.results).toEqual(fixture().results);
  });
  it('never requests private roster data for guests or when no season exists', async () => {
    for (const authenticated of [false, true]) {
      const { client, requests } = clientFixture({ noSeason: authenticated });
      await loadStandings(client, 'league', authenticated, new AbortController().signal);
      expect(requests.some(({ url }) => url.pathname.includes('get_season_championship_roster'))).toBe(false);
    }
  });
  it('distinguishes an empty roster from a denied or stale request', async () => {
    const empty = clientFixture({ empty: true });
    expect((await loadStandings(empty.client, 'league', true, new AbortController().signal)).currentRoster).toEqual([]);
    const failed = clientFixture({ fail: true });
    await expect(loadStandings(failed.client, 'league', true, new AbortController().signal)).rejects.toBeTruthy();
    const abort = new AbortController();
    const stale = clientFixture({ abort });
    await expect(loadStandings(stale.client, 'league', true, abort.signal)).rejects.toBeTruthy();
  });
});
