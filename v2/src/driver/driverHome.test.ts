import { describe, expect, it } from 'vitest';
import { highestAchievementTiers, levelProgress, nextChallengeRotation, selectDriverHero, type DriverAchievement, type DriverHomeSnapshot } from './driverHome';

const emptySnapshot: DriverHomeSnapshot = {
  activeSeason: null,
  achievementCount: 0,
  achievementTotal: 0,
  achievements: [],
  career: null,
  challenges: [],
  latestAchievement: null,
  latestArchivedSeason: null,
  nextRace: null,
  progression: null,
  wallet: null,
};

describe('Driver Home rules', () => {
  it('prioritizes a completed season over old career results', () => {
    expect(selectDriverHero({
      ...emptySnapshot,
      latestArchivedSeason: {
        archivedAt: '2026-08-25T18:00:00Z',
        id: 'season-1',
        name: 'Season 1',
      },
    })).toBe('season-complete');
  });

  it('prioritizes a current result over an upcoming race', () => {
    expect(selectDriverHero({
      ...emptySnapshot,
      activeSeason: { archivedAt: null, id: 'season-1', name: 'Season 1' },
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
      activeSeason: { archivedAt: null, id: 'season-1', name: 'Season 1' },
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

  it('selects the highest unlocked Achievement tier for every metric', () => {
    const achievement = (metric: string, threshold: number): DriverAchievement => ({
      code: `${metric}_${threshold}`,
      currentValue: threshold,
      descriptionKey: 'achievement.description',
      metric,
      rewardVc: 100,
      threshold,
      titleKey: 'achievement.title',
      unlockedAt: null,
    });

    expect(highestAchievementTiers([
      achievement('wins', 1),
      achievement('starts', 10),
      achievement('wins', 5),
      achievement('starts', 1),
      achievement('perfect_weekends', 1),
      achievement('wins_after_dnf', 1),
      achievement('first_race_wins', 1),
    ]).map(({ code }) => code)).toEqual([
      'starts_10',
      'first_race_wins_1',
      'wins_5',
      'wins_after_dnf_1',
      'perfect_weekends_1',
    ]);
  });

  it('uses the scheduled Challenge end as the next rotation', () => {
    const now = Date.parse('2026-08-23T12:00:00Z');
    expect(nextChallengeRotation([{
      activeFrom: '2026-08-20T12:00:00Z',
      activeUntil: '2026-08-25T18:00:00Z',
      code: 'clean_finish',
      metric: 'classified_finishes',
      progress: 1,
      rewardVc: 100,
      status: 'active',
      target: 3,
    }], now)).toBe(Date.parse('2026-08-25T18:00:00Z'));
  });

  it('falls back to the next weekly Challenge cycle when no end is configured', () => {
    const now = Date.parse('2026-08-23T12:00:00Z');
    expect(nextChallengeRotation([{
      activeFrom: '2026-08-20T12:00:00Z',
      activeUntil: null,
      code: 'clean_finish',
      metric: 'classified_finishes',
      progress: 1,
      rewardVc: 100,
      status: 'active',
      target: 3,
    }], now)).toBe(Date.parse('2026-08-27T12:00:00Z'));
  });
});
