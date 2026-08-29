import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import type { AiResultAnalysis } from './imageResultImport';
import type { LeagueDriver } from './operations';
import { buildResultReviewRows, ResultImportReviewTable, resultReviewRowsToImported } from './ResultImportReviewTable';

const drivers: LeagueDriver[] = [{
  id: 'driver-1',
  display_name: 'Esteban Ocon',
  gamertag: null,
  number: 31,
  nationality_code: 'FR',
  league_team: 'Haas',
  car_name: 'F1 25',
  is_active: true,
  identity_linked: false,
  result_count: 0,
}];

const analysis: AiResultAnalysis = {
  race_name: 'Belgien',
  warnings: [],
  rows: [{
    position: 1,
    driver: 'Esteban OCON',
    team: null,
    grid_position: 16,
    pit_stops: 1,
    fastest_lap: '1:46,645',
    race_time: '27:24,905',
    confidence: 0.97,
  }],
};

describe('result import review table', () => {
  beforeEach(() => {
    globalThis.localStorage.setItem('racevora.locale', 'de');
  });

  it('matches recognized names and retains every visible race value', () => {
    const [row] = buildResultReviewRows(analysis, drivers);
    expect(row).toMatchObject({
      driverId: 'driver-1',
      finishPosition: '1',
      gridPosition: '16',
      pitStops: '1',
      fastestLap: '1:46,645',
      raceTime: '27:24,905',
      confidence: 0.97,
      teamName: 'Haas',
    });
  });

  it('turns edited table values into a complete result draft row', () => {
    const rows = buildResultReviewRows(analysis, drivers).map((row) => ({ ...row, points: '25' }));
    expect(resultReviewRowsToImported(rows, drivers)).toEqual([expect.objectContaining({
      driver_id: 'driver-1',
      finish_position: 1,
      grid_position: 16,
      pit_stops: 1,
      fastest_lap_time: '1:46,645',
      fastest_lap_time_ms: 106_645,
      race_time: '27:24,905',
      points: 25,
    })]);
  });

  it('provides a compact per-driver editor for mobile layouts', () => {
    const rows = buildResultReviewRows(analysis, drivers);
    render(createElement(I18nProvider, null, createElement(ResultImportReviewTable, { drivers, onChange: vi.fn(), rows })));

    expect(screen.getByText('Punkte fehlen')).toBeTruthy();
    expect(screen.getAllByText('Erkannt: Esteban OCON')).toHaveLength(2);
    expect(screen.getByLabelText('Punkte Mobil Zeile 1')).toBeTruthy();
    expect(screen.getByLabelText('Fahrer Mobil Zeile 1')).toBeTruthy();
  });
});
