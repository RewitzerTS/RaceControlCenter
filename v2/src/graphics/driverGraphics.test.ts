import { describe, expect, it } from 'vitest';
import { buildDriverGraphic, driverGraphicCopy } from './driverGraphics';
import type { HistoryData } from '../racing/profileData';
import { paginateGraphicModel } from './graphics';

const fixture = (): HistoryData => ({
  leagueId: 'league', profileNumbers: {}, assignments: [],
  seasons: [{ id: 'season', name: 'F1 26', is_active: true, start_date: null, created_at: '' }],
  drivers: Array.from({ length: 22 }, (_, index) => ({ id: `d${index}`, display_name: `Driver ${index}`, gamertag: `Gamer ${index}`, car_name: null, league_team: null, is_active: true })),
  races: [{ id: 'race', season_id: 'season', round_number: 1, grand_prix_name: 'Monaco', circuit_name: 'Monaco', country_code: 'MC', status: 'completed', current_result_version_id: 'v1', race_date: null, race_start_at: null, race_time: null, weather: null }],
  results: Array.from({ length: 22 }, (_, index) => ({ id: `r${index}`, race_id: 'race', result_version_id: 'v1', driver_id: `d${index}`, points_owner_driver_id: null, awarded_points: 22 - index, participation_status: 'PLAYER', fastest_lap_time_ms: null, fastest_lap_ms: null, fastest_lap_time: null, points_car_name: null, car_name_snapshot: null, finish_position: index + 1, grid_position: index + 1, race_time: null })),
});
describe('driver graphics', () => {
  it('keeps all 22 drivers across pages', () => {
    for (const kind of ['race_result', 'driver_standings'] as const) {
      const model = buildDriverGraphic(fixture(), kind, 'season', 'race', 'd0', 'RCC', driverGraphicCopy.en)!;
      expect(model.rows).toHaveLength(22);
      expect(paginateGraphicModel(model, 10).flatMap((page) => page.model.rows)).toEqual(model.rows);
    }
  });
  it('ignores superseded results and other seasons', () => {
    const data = fixture();
    data.results.push({ ...data.results[0], id: 'old', result_version_id: 'old', awarded_points: 999 });
    expect(buildDriverGraphic(data, 'driver_standings', 'season', '', '', 'RCC', driverGraphicCopy.en)?.rows[0].value).toBe('22 Points');
    expect(buildDriverGraphic(data, 'race_result', 'other', 'race', '', 'RCC', driverGraphicCopy.en)).toBeNull();
  });
  it('requires an actual linked driver for personal stats', () => {
    expect(buildDriverGraphic(fixture(), 'statistics', 'season', '', '', 'RCC', driverGraphicCopy.en)).toBeNull();
    const model = buildDriverGraphic(fixture(), 'statistics', 'season', '', 'd1', 'RCC', driverGraphicCopy.en)!;
    expect(model.title).toBe('Gamer 1');
    expect(model.rows.map((row) => row.value)).toEqual(['1', '0', '1', '21']);
  });
  it('does not fabricate empty results', () => {
    const data = { ...fixture(), results: [] };
    expect(buildDriverGraphic(data, 'race_result', 'season', 'race', '', 'RCC', driverGraphicCopy.en)).toBeNull();
  });
  it('preserves recorded race times and retirement labels', () => {
    const data = fixture();
    data.results[0].race_time = '1:30:00';
    data.results[0].race_time_ms = 5400000;
    data.results[1].race_time_ms = 5401250;
    data.results[2].race_time = 'DNF';
    const model = buildDriverGraphic(data, 'race_result', 'season', 'race', '', 'RCC', driverGraphicCopy.en)!;
    expect(model.rows.map((row) => row.detail).slice(0, 3)).toEqual(['1:30:00', '+00:01.250', 'DNF']);
  });
});
