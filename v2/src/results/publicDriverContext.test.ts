/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(resolve(process.cwd(), '../assets/js/services/rcc-driver-context.js'), 'utf8');
function setup(signedIn = false) {
  const from = vi.fn(() => { throw new Error('Private table must not be accessed by a visitor'); });
  const races = [{ id: 'race-a', season_id: 'season-a', round_number: 2, current_result_version_id: 'published' }];
  const results = [{ id: 'row-a', driver_id: 'driver-a', race_id: 'race-a', result_version_id: 'published', car_name_snapshot: 'Car A', points_team_name: 'Team A' },
    { id: 'private', driver_id: 'driver-a', race_id: 'race-a', result_version_id: 'draft' }];
  const window: any = { supabaseClient: { from, auth: { getSession: async () => ({ data: { session: signedIn ? { user: { id: 'a' } } : null } }) } },
    RCCData: { fetchRaces: vi.fn(async () => races), fetchRaceResults: vi.fn(async () => results) } };
  runInNewContext(source, { window });
  return { window, from, races, results };
}

describe('public driver snapshots', () => {
  it('uses only current published result rows and never queries the private season roster', async () => {
    const { window, from } = setup();
    const rows = await window.RCCDriverContext.fetchDriverSeasonAssignments({ seasonId: 'season-a' });
    expect(from).not.toHaveBeenCalled();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ driver_id: 'driver-a', season_id: 'season-a', car_name: 'Car A', effective_round_number: 2 });
    expect(window.RCCData.fetchRaces).toHaveBeenCalledWith({ seasonId: 'season-a' });
  });
  it('keeps authenticated roster errors visible instead of hiding them as an empty roster', async () => {
    const { window, from } = setup(true);
    await expect(window.RCCDriverContext.fetchDriverSeasonAssignments({ seasonId: 'season-a' })).rejects.toThrow();
    expect(from).toHaveBeenCalledWith('season_driver_assignments');
  });
  it('resolves vehicle snapshots by round without cross-season contamination', () => {
    const { window } = setup();
    const resolver = window.RCCDriverContext.createAssignmentResolver({
      drivers: [{ id: 'd', car_name: 'Base' }],
      races: [{ id: 'r1', season_id: 's1', round_number: 1 }, { id: 'r2', season_id: 's1', round_number: 2 }, { id: 'r3', season_id: 's2', round_number: 3 }],
      assignments: [{ driver_id: 'd', season_id: 's1', car_name: 'First', effective_round_number: 1 }, { driver_id: 'd', season_id: 's1', car_name: 'New', effective_round_number: 2 }],
    });
    expect(resolver.resolveDriverSnapshot('d', 'r1').car_name).toBe('First');
    expect(resolver.resolveDriverSnapshot('d', 'r2').car_name).toBe('New');
    expect(resolver.resolveDriverSnapshot('d', 'r3').car_name).toBe('Base');
  });
});
