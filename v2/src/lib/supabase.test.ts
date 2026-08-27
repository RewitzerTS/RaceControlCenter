import { describe, expect, it } from 'vitest';
import type { RuntimeEnvironment } from '../config/environment';
import { createAuthStorageKey, createLeagueClient, createLeagueRequestHeaders } from './supabase';

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

describe('createAuthStorageKey', () => {
  it('uses one deterministic browser session per Supabase project', () => {
    expect(createAuthStorageKey('znnkwjogtvzwfkwnmawp')).toBe('racevora-v2:znnkwjogtvzwfkwnmawp:auth');
  });
});

describe('createLeagueClient', () => {
  it('reuses the authenticated client when the active league changes', () => {
    const environment = {
      appEnvironment: 'staging',
      supabaseUrl: 'https://test-session-sharing.supabase.co',
      supabasePublishableKey: 'sb_publishable_test',
      supabaseProjectRef: 'test-session-sharing',
      defaultLeagueSlug: 'rcc',
      authCaptcha: { enabled: false, turnstileSiteKey: null },
      features: {
        stewardWorkspace: true,
        leagueAdmin: true,
        ownerControl: true,
        notificationsV2: true,
        socialGraphics: true,
      },
    } satisfies RuntimeEnvironment;

    expect(createLeagueClient(environment, 'private-league')).toBe(createLeagueClient(environment, 'rcc'));
  });
});
