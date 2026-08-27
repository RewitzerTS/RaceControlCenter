import { describe, expect, it } from 'vitest';
import { parseFastestLapToMs, parseResultCsv } from './resultCsv';

describe('result CSV import', () => {
  it('parses fastest laps and quoted values', () => {
    const rows = parseResultCsv([
      'driver;finish_position;grid_position;points;team_name;car_name;fastest_lap_time',
      'AI Driver;1;2;25;"Team; One";F1 26;1:18,671',
    ].join('\n'));

    expect(rows).toEqual([expect.objectContaining({
      driver_name: 'AI Driver',
      team_name: 'Team; One',
      fastest_lap_time: '1:18,671',
      fastest_lap_time_ms: 78_671,
    })]);
  });

  it('accepts an explicit millisecond column', () => {
    const [row] = parseResultCsv('driver,position,points,fastest_lap_time_ms\nPlayer,2,18,79999');
    expect(row.fastest_lap_time_ms).toBe(79_999);
  });

  it('rejects malformed fastest laps', () => {
    expect(() => parseResultCsv('driver;position;points;fastest_lap_time\nPlayer;1;25;fast')).toThrow(/schnellste Runde/);
  });

  it('converts supported lap-time formats', () => {
    expect(parseFastestLapToMs('1:20.250')).toBe(80_250);
    expect(parseFastestLapToMs('59,9')).toBe(59_900);
  });
});
