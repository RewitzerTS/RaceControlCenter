import { describe, expect, it } from 'vitest';
import { journeyForRole, USER_JOURNEYS } from './userJourneys';

describe('User Journey E2E acceptance matrix', () => {
  it('covers signed-out and every exact application role once', () => {
    expect(USER_JOURNEYS.map((journey) => journey.role)).toEqual([
      null, 'driver', 'steward', 'league_admin', 'platform_owner',
    ]);
    expect(new Set(USER_JOURNEYS.map((journey) => journey.id)).size).toBe(USER_JOURNEYS.length);
  });

  it('keeps privileged entry points separate', () => {
    expect(journeyForRole('steward').entry).toBe('/stewarding');
    expect(journeyForRole('league_admin').entry).toBe('/admin');
    expect(journeyForRole('platform_owner').entry).toBe('/owner');
  });

  it('requires the owner journey to cross operations, Stewarding and Graphics in Demo context', () => {
    expect(journeyForRole('platform_owner').checkpoints).toEqual(
      expect.arrayContaining(['/owner/demo', '/stewarding', '/admin/graphics']),
    );
    expect(journeyForRole('platform_owner').invariant).toContain('never contributes');
  });
});
