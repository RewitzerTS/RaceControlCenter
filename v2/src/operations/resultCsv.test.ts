import { describe, expect, it } from 'vitest';
import { parseFastestLapToMs, parseResultCsv } from './resultCsv';
import type { LeagueDriver } from './operations';

describe('result CSV import', () => {
  const aaron = { id: 'aaron', display_name: 'Aaron', gamertag: 'Darkqz', gamertag_aliases: ['D4RK', 'Fabiylolboi'] } as LeagueDriver;

  it('resolves alternate platform names to the existing driver ID', () => {
    for (const name of ['Darkqz', 'D4RK', 'Fabiylolboi']) {
      const [row] = parseResultCsv(`driver;position;points\n${name};1;25`, [aaron]);
      expect(row).toMatchObject({ driver_id: 'aaron', driver_name: name });
    }
  });

  it('rejects ambiguous and merely similar names instead of assigning statistics', () => {
    const duplicate = { ...aaron, id: 'duplicate' };
    expect(() => parseResultCsv('driver;position;points\nD4RK;1;25', [aaron, duplicate])).toThrow(/nicht eindeutig/);
    expect(() => parseResultCsv('driver;position;points\nFabiylolbo1;1;25', [aaron])).toThrow(/nicht eindeutig/);
    expect(() => parseResultCsv('driver;position;points\nNobody;1;25', [aaron])).toThrow(/nicht eindeutig/);
  });

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

  it('keeps stops and the visible race time from an import', () => {
    const [row] = parseResultCsv('driver;position;points;pit_stops;race_time\nPlayer;1;25;2;DNF');
    expect(row).toEqual(expect.objectContaining({ pit_stops: 2, race_time: 'DNF' }));
  });

  it('rejects malformed fastest laps', () => {
    expect(() => parseResultCsv('driver;position;points;fastest_lap_time\nPlayer;1;25;fast')).toThrow(/schnellste Runde/);
  });

  it('converts supported lap-time formats', () => {
    expect(parseFastestLapToMs('1:20.250')).toBe(80_250);
    expect(parseFastestLapToMs('59,9')).toBe(59_900);
  });
});
