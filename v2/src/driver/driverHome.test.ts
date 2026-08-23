import { describe, expect, it } from 'vitest';
import { levelProgress, selectDriverHero, type DriverHomeSnapshot } from './driverHome';

const emptySnapshot: DriverHomeSnapshot = {
  achievementCount: 0,
  career: null,
  challenges: [],
  latestAchievement: null,
  nextRace: null,
  progression: null,
  wallet: null,
};

describe('Driver Home rules', () => {
  it('prioritizes a current result over an upcoming race', () => {
    expect(selectDriverHero({
      ...emptySnapshot,
      career: {
        average_finish: 2,
        best_finish: 1,
        classified_finishes: 1,
        dnfs: 0,
        dns: 0,
        driver_identity_id: 'driver-1',
        dsqs: 0,
        fastest_laps: 0,
        last_race_date: '2026-08-20',
        leagues_competed: 1,
        podiums: 1,
        poles: 0,
        seasons_competed: 1,
        starts: 1,
        total_points: 25,
        updated_at: '2026-08-20',
        wins: 1,
      },
      nextRace: {
        grand_prix_name: 'Monza',
        id: 'race-1',
        race_date: '2026-08-27',
        race_start_at: null,
        race_time: null,
      },
    })).toBe('result');
  });

  it('uses the next race when no result exists', () => {
    expect(selectDriverHero({
      ...emptySnapshot,
      nextRace: {
        grand_prix_name: 'Monza',
        id: 'race-1',
        race_date: '2026-08-27',
        race_start_at: null,
        race_time: null,
      },
    })).toBe('next-race');
  });

  it('falls back to a career moment for a new driver', () => {
    expect(selectDriverHero(emptySnapshot)).toBe('career');
  });

  it('calculates bounded level progress and completes Level 100', () => {
    expect(levelProgress({
      driver_identity_id: 'driver-1',
      last_ledger_entry_id: null,
      level: 2,
      lifetime_xp: 1250,
      rank: 'Rookie',
      updated_at: '2026-08-20',
      xp_into_level: 250,
      xp_to_next_level: 750,
    })).toBe(25);
    expect(levelProgress({
      driver_identity_id: 'driver-1',
      last_ledger_entry_id: null,
      level: 100,
      lifetime_xp: 99000,
      rank: 'Immortal',
      updated_at: '2026-08-20',
      xp_into_level: 0,
      xp_to_next_level: 0,
    })).toBe(100);
  });
});
