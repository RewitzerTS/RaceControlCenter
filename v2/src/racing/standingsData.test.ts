import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildStandings, standingSnapshot, standingTrend } from './standingsData';
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
});
