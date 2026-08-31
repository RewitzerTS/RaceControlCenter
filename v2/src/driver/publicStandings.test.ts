// @ts-nocheck -- Vitest executes this browser-script contract in Node without shipping Node types to the client build.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

type BrowserContext = {
  window: {
    RCCData?: {
      buildStandings: (input: Record<string, unknown>) => {
        driverStandings: Array<Record<string, unknown>>;
        teamStandings: Array<Record<string, unknown>>;
      };
    };
    RCCDriverContext?: {
      createAssignmentResolver: (input: Record<string, unknown>) => {
        resolveDriverSnapshot: (driverId: string, raceId: string) => Record<string, unknown> | null;
      };
    };
  };
};

function runBrowserScript(relativePath: string, context: BrowserContext) {
  const source = readFileSync(resolve(process.cwd(), '..', relativePath), 'utf8');
  vm.runInNewContext(source, context, { filename: relativePath });
}

describe('public championship data', () => {
  it('resolves current season team and car assignments', () => {
    const context: BrowserContext = { window: {} };
    runBrowserScript('assets/js/services/rcc-driver-context.js', context);
    const resolver = context.window.RCCDriverContext!.createAssignmentResolver({
      drivers: [{ id: 'driver-1', display_name: 'Testfahrer', league_team: 'Alt', car_name: 'Alt' }],
      races: [{ id: 'race-1', season_id: 'season-1', round_number: 1 }],
      assignments: [{ id: 'assignment-1', driver_id: 'driver-1', season_id: 'season-1', team_name: 'Mercedes', car_name: 'Mercedes W17' }],
    });

    expect(resolver.resolveDriverSnapshot('driver-1', 'race-1')).toEqual(expect.objectContaining({
      league_team: 'Mercedes',
      car_name: 'Mercedes W17',
    }));
  });

  it('builds driver and team standings from official result rows', () => {
    const context: BrowserContext = { window: {} };
    runBrowserScript('assets/js/services/rcc-data.js', context);
    const drivers = [
      { id: 'driver-1', display_name: 'Player', league_team: 'Mercedes', car_name: 'Mercedes W17' },
      { id: 'driver-2', display_name: 'Bot', league_team: 'Ferrari', car_name: 'Ferrari SF-26' },
    ];
    const races = [{ id: 'race-1', season_id: 'season-1', round_number: 1 }];
    const raceResults = [
      { race_id: 'race-1', driver_id: 'driver-1', finish_position: 1, awarded_points: 26, points: 26, fastest_lap_time_ms: 80_000, participation_status: 'PLAYER' },
      { race_id: 'race-1', driver_id: 'driver-2', finish_position: 2, awarded_points: 18, points: 18, fastest_lap_time_ms: 81_000, participation_status: 'BOT' },
    ];
    const resolver = { resolveDriverSnapshot: (driverId: string) => drivers.find((driver) => driver.id === driverId) };

    const standings = context.window.RCCData!.buildStandings({ drivers, races, raceResults, resolver });
    expect(standings.driverStandings[0]).toEqual(expect.objectContaining({ driverName: 'Player', points: 26, wins: 1, fastestLaps: 1 }));
    expect(standings.teamStandings[0]).toEqual(expect.objectContaining({ teamName: 'Mercedes', points: 26 }));
  });

  it('treats published points as final instead of adding the fastest-lap bonus twice', () => {
    const context: BrowserContext = { window: {} };
    runBrowserScript('assets/js/services/rcc-data.js', context);
    const drivers = [{ id: 'driver-1', display_name: 'Winner', league_team: 'Mercedes', car_name: 'Mercedes W17' }];
    const races = [{ id: 'race-1', season_id: 'season-1', round_number: 1 }];
    const raceResults = [{
      race_id: 'race-1',
      driver_id: 'driver-1',
      finish_position: 1,
      awarded_points: 26,
      points: 26,
      fastest_lap_time_ms: 80_000,
      participation_status: 'PLAYER',
    }];
    const resolver = { resolveDriverSnapshot: () => drivers[0] };

    const standings = context.window.RCCData!.buildStandings({ drivers, races, raceResults, resolver });
    expect(standings.driverStandings[0]).toEqual(expect.objectContaining({ points: 26, fastestLaps: 1 }));
    expect(standings.teamStandings[0]).toEqual(expect.objectContaining({ points: 26 }));
  });
});
