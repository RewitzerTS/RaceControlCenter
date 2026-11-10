import { describe, expect, it } from 'vitest';
import { buildReverseGrid, type ReverseGridSnapshot } from './reverseGrid';
import { buildStandings } from '../racing/standingsData';
import type { PublishedResult } from '../racing/resultsData';

function fixture(size = 22): ReverseGridSnapshot {
  const drivers = Array.from({ length: size }, (_, i) => ({ id: String(i), display_name: `Driver ${i}`, gamertag: `Tag ${i}`, is_active: true, league_team: '', car_name: 'Car' }));
  const result = (id: string, points: number, position: number): PublishedResult => ({ id, driver_id: id, race_id: 'r1', result_version_id: 'v1', points_owner_driver_id: null, awarded_points: points, finish_position: position, participation_status: 'PLAYER', fastest_lap_time_ms: null, fastest_lap_ms: null, fastest_lap_time: null, points_car_name: null, points_team_name: null, car_name_snapshot: null });
  return { generatedAt: '2026-11-10T12:00:00Z', drafts: [], seats: drivers.map(d => ({ driverId: d.id, aiName: `AI ${d.id}`, gamertag: d.gamertag, isAi: false })),
    data: { season: { id: 's', name: 'Season' }, drivers, assignments: [], currentRoster: drivers.map(d => ({ driver_id: d.id, team_name: null, car_name: 'Car' })),
      races: [{ id: 'r1', season_id: 's', round_number: 1, grand_prix_name: 'Japan', country_code: 'JP', status: 'completed', current_result_version_id: 'v1' }], results: [result('0', 25, 1), result('1', 18, 2)] } };
}
describe('reverse grid', () => {
  it.each([20, 22])('reverses the exact championship order, including all %i drivers and ties, without mutation', size => {
    const input = fixture(size), before = JSON.stringify(input);
    const official = buildStandings(input.data!).driverStandings;
    const rows = buildReverseGrid(input);
    expect(rows.map(r => r.driverId)).toEqual(official.map(r => r.driverId).reverse());
    expect(rows.map(r => r.gridPosition)).toEqual(Array.from({ length: size }, (_, i) => i + 1));
    expect(rows.at(-1)).toMatchObject({ aiName: 'AI 0', gamertag: 'Tag 0', championshipPosition: 1, points: 25 });
    expect(JSON.stringify(input)).toBe(before);
  });
  it('replaces the published contribution with a draft, never double counting', () => {
    const input = fixture(2);
    input.drafts = [{ raceId: 'r1', raceName: 'Japan', round: 1, versionId: 'v2', versionNumber: 2, rows: input.data!.results.map(r => ({ ...r, result_version_id: 'v2', awarded_points: r.driver_id === '0' ? 10 : 25 })) }];
    expect(buildReverseGrid(input).map(r => [r.driverId, r.points])).toEqual([['0', 10], ['1', 25]]);
  });
  it('keeps inherited AI points on the human seat once, using the current gamertag', () => {
    const input = fixture(2);
    input.data!.currentRoster = [{ driver_id: '1', team_name: null, car_name: 'Car' }];
    input.data!.championshipAiAssignments = [{ ai_driver_id: '0', human_driver_id: '1', effective_from_round: 2, effective_to_round: null }];
    expect(buildReverseGrid(input)).toEqual([expect.objectContaining({ driverId: '1', points: 43, gamertag: 'Tag 1', gridPosition: 1 })]);
  });
  it('combines drafts from two races on the same day while replacing an existing result', () => {
    const input = fixture(2), first = input.data!.races[0];
    input.data!.races.push({ ...first, id: 'r2', round_number: 2, status: 'upcoming', current_result_version_id: null });
    input.drafts = [
      { raceId: 'r1', raceName: 'Japan', round: 1, versionId: 'v2', versionNumber: 2, rows: input.data!.results.map(row => ({ ...row, result_version_id: 'v2', awarded_points: 10 })) },
      { raceId: 'r2', raceName: 'China', round: 2, versionId: 'v3', versionNumber: 1, rows: [{ ...input.data!.results[1], race_id: 'r2', result_version_id: 'v3', awarded_points: 25 }] },
    ];
    expect(buildReverseGrid(input).map(row => [row.driverId, row.points])).toEqual([['0', 10], ['1', 35]]);
  });
  it('excludes annulled points and flags a missing AI rather than silently hiding a driver', () => {
    const input = fixture(2); input.data!.races[0].current_result_version_id = null; input.data!.races[0].status = 'cancelled'; input.seats = [];
    expect(buildReverseGrid(input).every(r => r.points === 0 && r.aiName === null)).toBe(true);
  });
  it('rejects cross-race, duplicate and cancelled draft sources', () => {
    const input = fixture(2), draft = { raceId: 'r1', raceName: 'Japan', round: 1, versionId: 'v1', versionNumber: 1, rows: input.data!.results };
    input.drafts = [draft, draft]; expect(() => buildReverseGrid(input)).toThrow('DUPLICATE_DRAFT');
    input.drafts = [{ ...draft, raceId: 'other' }]; expect(() => buildReverseGrid(input)).toThrow('INVALID_DRAFT');
    input.drafts = [draft]; input.data!.races[0].status = 'cancelled'; expect(() => buildReverseGrid(input)).toThrow('INVALID_DRAFT');
  });
});
