import { describe, expect, it } from 'vitest';
import { buildDraftChampionship, draftChampionshipCopy, draftChampionshipError, type DraftChampionshipSnapshot } from './draftChampionship';
import type { PublishedResult } from '../racing/resultsData';

const result = (patch: Partial<PublishedResult> = {}): PublishedResult => ({ id: 'result', race_id: 'r1', result_version_id: 'v1', driver_id: '0',
  points_owner_driver_id: null, awarded_points: 25, finish_position: 1, participation_status: 'PLAYER', fastest_lap_time_ms: 80000,
  fastest_lap_ms: null, fastest_lap_time: null, points_car_name: null, points_team_name: null, car_name_snapshot: null, ...patch });
export function previewFixture(size = 22): DraftChampionshipSnapshot {
  const drivers = Array.from({ length: size }, (_, i) => ({ id: String(i), display_name: `Driver ${i}`, gamertag: `Tag ${i}`, is_active: true, league_team: '', car_name: 'Car' }));
  return { versionId: 'draft', versionNumber: 1, raceId: 'r2', raceName: 'Japan GP', generatedAt: '2026-10-12T16:00:00Z', pendingCorrections: 0, replacesPublished: false,
    draftRows: [result({ id: 'draft-row', race_id: 'r2', result_version_id: 'draft', driver_id: '1' })],
    data: { season: { id: 's', name: 'Season 15' }, drivers, assignments: [], currentRoster: drivers.map(d => ({ driver_id: d.id, team_name: null, car_name: 'Car' })),
      races: [1, 2].map(i => ({ id: `r${i}`, season_id: 's', round_number: i, grand_prix_name: `Race ${i}`, country_code: 'JP', status: i === 1 ? 'completed' : 'upcoming', current_result_version_id: i === 1 ? 'v1' : null })),
      results: [result(), result({ id: 'second', driver_id: '1', awarded_points: 18, finish_position: 2, fastest_lap_time_ms: 81000 })] } };
}
describe('draft championship', () => {
  it.each([20, 22])('adds saved draft points and retains the full %i-driver roster without mutation', size => {
    const input = previewFixture(size); const before = JSON.stringify(input);
    const rows = buildDraftChampionship(input);
    expect(rows).toHaveLength(size);
    expect(rows[0]).toMatchObject({ driverId: '1', position: 1, points: 43, officialPoints: 18, difference: 25 });
    expect(rows[1]).toMatchObject({ driverId: '0', position: 2, points: 25, difference: 0 });
    expect(JSON.stringify(input)).toBe(before);
  });
  it('replaces a published race rather than counting it twice, including negative point differences', () => {
    const input = previewFixture(); input.raceId = 'r1'; input.replacesPublished = true;
    input.draftRows = [result({ result_version_id: 'draft', driver_id: '1', awarded_points: 25 }), result({ result_version_id: 'draft', driver_id: '0', finish_position: 2, awarded_points: 18 })];
    const rows = buildDraftChampionship(input);
    expect(rows[0]).toMatchObject({ driverId: '1', points: 25, difference: 7 });
    expect(rows[1]).toMatchObject({ driverId: '0', points: 18, difference: -7, wins: 0 });
  });
  it('uses exactly the official tie-break rules and points attribution for an AI/substitute', () => {
    const input = previewFixture();
    input.draftRows = [result({ result_version_id: 'draft', race_id: 'r2', driver_id: '2', points_owner_driver_id: '1', awarded_points: 7 })];
    const rows = buildDraftChampionship(input);
    expect(rows[0]).toMatchObject({ driverId: '1', points: 25, wins: 1, podiums: 2 });
    expect(rows[1]).toMatchObject({ driverId: '0', points: 25, wins: 1, podiums: 1 });
    expect(rows.find(row => row.driverId === '2')?.points).toBe(0);
  });
  it('retains published points of departed drivers and counts only active result versions', () => {
    const input = previewFixture(); input.data.currentRoster = [{ driver_id: '1', team_name: null, car_name: 'Car' }];
    input.data.results.push(result({ result_version_id: 'superseded', awarded_points: 999 }));
    expect(buildDraftChampionship(input).map(row => [row.driverId, row.points])).toEqual([['1', 43], ['0', 25]]);
  });
  it('works before the first published race and has localized actionable errors', () => {
    const input = previewFixture(); input.data.results = [];
    expect(buildDraftChampionship(input)[0]).toMatchObject({ driverId: '1', points: 25, officialPoints: 0 });
    for (const language of ['de', 'en', 'fr', 'es']) {
      const copy = draftChampionshipCopy(language);
      expect(Object.keys(copy)).toEqual(Object.keys(draftChampionshipCopy('de')));
      expect(draftChampionshipError({ message: 'PREVIEW_STEWARD_TIMES_REQUIRED' }, language)).toBe(copy.times);
      expect(draftChampionshipError({ message: 'PREVIEW_DRAFT_STALE' }, language)).toBe(copy.stale);
    }
  });
});
