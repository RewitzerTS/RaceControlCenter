import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RuntimeEnvironment } from '../config/environment';

const LEAGUE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createLeagueRequestHeaders(leagueSlug: string): Record<string, string> {
  const normalizedSlug = leagueSlug.trim().toLowerCase();
  if (!LEAGUE_SLUG_PATTERN.test(normalizedSlug)) {
    throw new Error('Invalid league slug for the tenant request header.');
  }

  return {
    'x-rcc-league-slug': normalizedSlug,
    'x-racevora-client': 'v2-staging',
  };
}

export function createLeagueClient(environment: RuntimeEnvironment, leagueSlug: string): SupabaseClient {
  return createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: `racevora-v2:${environment.supabaseProjectRef}:auth`,
    },
    global: {
      headers: createLeagueRequestHeaders(leagueSlug),
    },
  });
}
