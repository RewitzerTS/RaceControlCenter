import { describe, expect, it } from 'vitest';
import { nextRaceDay, type UpcomingRace } from './driverHome';
const race = (id: string, day: string, round: number, time = '20:00'): UpcomingRace => ({ id, race_date: day, race_time: time, race_start_at: null, round_number: round, season_id: 's', circuit_name: 'Suzuka', grand_prix_name: 'Japan GP' });
describe('next race day', () => {
  it('includes every race of the first day and excludes later days without mutating the source', () => {
    const rows = [race('later', '2026-10-12', 4), race('third', '2026-10-05', 3, '22:00'), race('first', '2026-10-05', 1), race('second', '2026-10-05', 2, '21:00')];
    expect(nextRaceDay(rows).map(r => r.id)).toEqual(['first', 'second', 'third']);
    expect(rows[0].id).toBe('later');
  });
  it('uses round order when races share a starting time', () => expect(nextRaceDay([race('b','2026-10-05',2),race('a','2026-10-05',1)]).map(r=>r.id)).toEqual(['a','b']));
  it('handles an empty calendar and skips missing dates', () => {
    expect(nextRaceDay([])).toEqual([]);
    expect(nextRaceDay([{ ...race('a','2026-10-05',1), race_date: null }])).toEqual([]);
  });
});
