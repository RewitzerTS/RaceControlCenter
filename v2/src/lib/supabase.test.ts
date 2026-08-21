import { describe, expect, it } from 'vitest';
import { createLeagueRequestHeaders } from './supabase';

describe('createLeagueRequestHeaders', () => {
  it('uses the canonical V1 tenant header contract', () => {
    const headers = createLeagueRequestHeaders(' Demo-League ');

    expect(headers).toEqual({
      'x-rcc-league-slug': 'demo-league',
      'x-racevora-client': 'v2-staging',
    });
    expect(headers).not.toHaveProperty('x-racevora-league');
  });

  it('identifies production requests without changing the tenant header', () => {
    expect(createLeagueRequestHeaders('rcc', 'production')).toEqual({
      'x-rcc-league-slug': 'rcc',
      'x-racevora-client': 'v2-production',
    });
  });

  it.each(['', 'demo_league', 'demo/league', 'demo?league=other'])('rejects invalid tenant slugs: %s', (slug) => {
    expect(() => createLeagueRequestHeaders(slug)).toThrow(/invalid league slug/i);
  });
});
