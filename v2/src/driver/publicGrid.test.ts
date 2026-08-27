// @ts-nocheck -- Vitest executes this browser-script contract in Node without shipping Node types to the client build.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadGridRoster() {
  const context = { window: {} };
  const source = readFileSync(resolve(process.cwd(), '..', 'assets/js/services/rcc-grid-roster.js'), 'utf8');
  vm.runInNewContext(source, context, { filename: 'rcc-grid-roster.js' });
  return context.window.RCCGridRoster;
}

describe('public season grid', () => {
  it('uses the season seats instead of unrelated league drivers', () => {
    const roster = loadGridRoster();
    const grid = roster.buildSeasonGrid({
      drivers: [
        { id: 'player-1', display_name: 'Liga-Spieler', gamertag: 'Racer_1', number: 99 },
        { id: 'unassigned', display_name: 'Nicht im Grid' },
        { id: 'bot-1', display_name: 'Alter Botname' },
      ],
      assignments: [
        { id: 'seat-1', driver_id: 'player-1', seat_code: 'mclaren-1', team_name: 'McLaren', car_name: 'MCL40', ai_driver_name: 'Lando Norris', participant_type: 'PLAYER', gamertag_snapshot: 'Racer_1', number: 4 },
        { id: 'seat-2', driver_id: 'bot-1', seat_code: 'mclaren-2', team_name: 'McLaren', car_name: 'MCL40', ai_driver_name: 'Oscar Piastri', participant_type: 'BOT', number: 81 },
      ],
    });

    expect(grid).toHaveLength(2);
    expect(grid.map((seat) => seat.display_name)).toEqual(['Liga-Spieler', 'Oscar Piastri']);
    expect(grid[0]).toEqual(expect.objectContaining({ number: 4, participant_type: 'PLAYER', ai_driver_name: 'Lando Norris' }));
    expect(grid.some((seat) => seat.id === 'unassigned')).toBe(false);
  });

  it('summarizes all 22 F1 26 seats as players and bots', () => {
    const roster = loadGridRoster();
    const assignments = Array.from({ length: 22 }, (_, index) => ({
      id: `seat-${index}`,
      seat_code: `seat-${index}`,
      team_name: `Team ${Math.floor(index / 2) + 1}`,
      ai_driver_name: `Fahrer ${index + 1}`,
      participant_type: index < 3 ? 'PLAYER' : 'BOT',
      number: index,
    }));

    const grid = roster.buildSeasonGrid({ assignments, drivers: [] });
    expect(roster.summarizeSeasonGrid(grid)).toEqual({ seats: 22, players: 3, bots: 19 });
  });
});
