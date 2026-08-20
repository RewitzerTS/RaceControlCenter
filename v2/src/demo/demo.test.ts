import { describe, expect, it } from 'vitest';
import { completeCoverage, DEMO_COVERAGE_KEYS, DEMO_LEAGUE_SLUG, type DemoSnapshot } from './demo';

const coverage = Object.fromEntries(DEMO_COVERAGE_KEYS.map((key) => [key, true])) as DemoSnapshot['coverage'];

const snapshot: DemoSnapshot = {
  league: { id: 'league', name: 'Demo', slug: DEMO_LEAGUE_SLUG, owner_only: true, progression_scope: 'demo_only' },
  counts: { registered_drivers: 6, teams: 3, races: 4, result_versions: 4, steward_cases: 1 },
  coverage,
  drivers: [], calendar: [], steward: null,
};

describe('Demo Full E2E', () => {
  it('keeps all required scenarios explicit and measurable', () => {
    expect(DEMO_COVERAGE_KEYS).toHaveLength(13);
    expect(completeCoverage(snapshot)).toBe(13);
  });

  it('declares owner-only, demo-only progression', () => {
    expect(snapshot.league).toMatchObject({ slug: 'demo', owner_only: true, progression_scope: 'demo_only' });
  });
});
