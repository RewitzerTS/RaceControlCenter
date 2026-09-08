import { describe, expect, it } from 'vitest';
import { buildGrid } from './gridData';
import type { ResultsData } from './resultsData';

function fixture(count: number): ResultsData {
  const drivers = Array.from({ length: count }, (_, i) => ({ id: String(i), display_name: `Driver ${i}`, gamertag: null, car_name: 'Car', league_team: `Team ${Math.floor(i / 2)}`, is_active: true }));
  return { season: { id: 'season', name: 'Season' }, drivers, assignments: [], races: [], results: [] };
}
describe('native grid', () => {
  it.each([20, 22])('retains every seat for a %i-driver season', (count) => {
    expect(buildGrid(fixture(count)).seats).toHaveLength(count);
    expect(buildGrid(fixture(count)).groups).toHaveLength(count / 2);
  });
  it('never interprets an unknown participant type as BOT', () => {
    expect(buildGrid(fixture(2)).seats.every((seat) => seat.type === 'unknown')).toBe(true);
  });
  it('uses season assignments and deduplicates seats', () => {
    const data = fixture(3);
    data.assignments = [{ driver_id: '0', car_name: 'Current car', team_name: 'Current team', created_at: '', seat_code: 'a', participant_type: 'PLAYER', gamertag_snapshot: 'Current tag' }, { driver_id: '1', car_name: '', created_at: '', seat_code: 'b', participant_type: 'BOT', ai_driver_name: 'AI name' }];
    data.assignments.push(data.assignments[0]);
    const grid = buildGrid(data);
    expect(grid.seats).toHaveLength(2);
    expect(grid.seats.find((seat) => seat.driverId === '0')).toMatchObject({ type: 'player', team: 'Current team', car: 'Current car', gamertag: 'Current tag' });
    expect(grid.seats.find((seat) => seat.driverId === '1')).toMatchObject({ type: 'bot', name: 'AI name' });
  });
});
