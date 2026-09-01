import { describe, expect, it } from 'vitest';
import { normalizeLeagueRules } from './leagueRules';

describe('normalizeLeagueRules', () => {
  it('uses the requested defaults only for missing values', () => {
    expect(normalizeLeagueRules({})).toMatchObject({
      ai_strength: '90',
      vehicle_performance: 'Realistische Leistung',
      damage: 'Standard',
      safety_car: 'Standard',
      red_flag: 'Standard',
      qualifying: 'Kurz',
    });
  });

  it('preserves valid existing rules and maps legacy spellings', () => {
    expect(normalizeLeagueRules({
      ai_strength: '85',
      race_distance: '50%',
      vehicle_performance: 'Reale Leistung',
      fastest_lap_point: 'nein',
      red_flag: 'erhöht',
      qualifying: 'keins',
      custom_rule: 'Bleibt erhalten',
    })).toMatchObject({
      ai_strength: '85',
      race_distance: '50%',
      vehicle_performance: 'Realistische Leistung',
      fastest_lap_point: 'nein',
      red_flag: 'Erhöht',
      qualifying: 'Aus',
      custom_rule: 'Bleibt erhalten',
    });
  });

  it('clamps the AI strength to the supported range', () => {
    expect(normalizeLeagueRules({ ai_strength: 140 }).ai_strength).toBe('110');
    expect(normalizeLeagueRules({ ai_strength: -5 }).ai_strength).toBe('0');
  });
});
