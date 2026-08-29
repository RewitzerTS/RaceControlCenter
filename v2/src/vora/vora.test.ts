import { describe, expect, it } from 'vitest';
import { selectVoraCatalogInsight, type VoraSnapshot } from './vora';

function snapshot(overrides: Partial<VoraSnapshot> = {}): VoraSnapshot {
  return {
    source: 'deterministic_v1',
    generated_at: '2026-08-30T12:00:00Z',
    insight: {
      rule: 'career_consistency',
      title_key: 'vora.insight.consistency.title',
      body_key: 'vora.insight.consistency.body',
    },
    career: {
      starts: 23,
      wins: 3,
      podiums: 9,
      average_finish: 7.9,
      last_race_date: '2026-05-11',
    },
    progression: { level: 5, rank: 'Challenger', lifetime_xp: 4365, xp_to_next_level: 635 },
    recent_result: {
      finish_position: 19,
      grid_position: 19,
      classification_status: 'classified',
      race_date: '2026-05-11',
    },
    active_challenges: 0,
    context_fields: [],
    ...overrides,
  };
}

describe('Vora insight catalog selection', () => {
  it('selects the highest-priority matching direct-address catalog entry', () => {
    const insight = selectVoraCatalogInsight(snapshot());

    expect(insight?.id).toBe('vora.next_milestone.podiums_10');
    expect(insight?.title).toContain('Podium');
    expect(insight?.focus).toMatch(/^Dein nächster Fokus:/);
  });

  it('prefers a higher-priority race signature when its complete context exists', () => {
    const insight = selectVoraCatalogInsight(snapshot({
      recent_result: {
        finish_position: 12,
        grid_position: 12,
        classification_status: 'classified',
        race_date: '2026-05-11',
        awarded_points: 0,
        is_fastest_lap: true,
      },
    }));

    expect(insight?.id).toBe('vora.race_signature.fastest_zero_points');
  });
});
