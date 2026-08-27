import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RuntimeEnvironment } from '../config/environment';
import type { Database } from '../types/database';

export type LeagueSupabaseClient = SupabaseClient<Database>;

const LEAGUE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface SharedLeagueClient {
  client: LeagueSupabaseClient;
  leagueSlug: string;
}

const sharedLeagueClients = new Map<string, SharedLeagueClient>();

export function createAuthStorageKey(projectRef: string): string {
  return `racevora-v2:${projectRef}:auth`;
}

export function createLeagueRequestHeaders(
  leagueSlug: string,
  appEnvironment: RuntimeEnvironment['appEnvironment'] = 'staging',
): Record<string, string> {
  const normalizedSlug = leagueSlug.trim().toLowerCase();
  if (!LEAGUE_SLUG_PATTERN.test(normalizedSlug)) {
    throw new Error('Invalid league slug for the tenant request header.');
  }

  return {
    'x-rcc-league-slug': normalizedSlug,
    'x-racevora-client': `v2-${appEnvironment}`,
  };
}

export function createLeagueClient(environment: RuntimeEnvironment, leagueSlug: string): LeagueSupabaseClient {
  const headers = createLeagueRequestHeaders(leagueSlug, environment.appEnvironment);
  const cacheKey = `${environment.supabaseUrl}|${environment.supabasePublishableKey}|${environment.appEnvironment}`;
  const existing = sharedLeagueClients.get(cacheKey);
  if (existing) {
    existing.leagueSlug = leagueSlug.trim().toLowerCase();
    return existing.client;
  }

  const shared: SharedLeagueClient = { client: null as unknown as LeagueSupabaseClient, leagueSlug: leagueSlug.trim().toLowerCase() };
  const tenantFetch: typeof fetch = (input, init) => {
    const requestHeaders = typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined;
    const nextHeaders = new Headers(requestHeaders);
    new Headers(init?.headers).forEach((value, key) => nextHeaders.set(key, value));
    nextHeaders.set('x-rcc-league-slug', shared.leagueSlug);
    nextHeaders.set('x-racevora-client', headers['x-racevora-client']);
    return fetch(input, { ...init, headers: nextHeaders });
  };

  shared.client = createClient<Database>(environment.supabaseUrl, environment.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: createAuthStorageKey(environment.supabaseProjectRef),
    },
    global: {
      fetch: tenantFetch,
    },
  });
  sharedLeagueClients.set(cacheKey, shared);
  return shared.client;
}
