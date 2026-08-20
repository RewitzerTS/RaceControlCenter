import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RuntimeEnvironment } from '../config/environment';

export function createLeagueClient(environment: RuntimeEnvironment, leagueSlug: string): SupabaseClient {
  return createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: `racevora-v2:${environment.supabaseProjectRef}:auth`,
    },
    global: {
      headers: {
        'x-racevora-league': leagueSlug,
        'x-racevora-client': 'v2-staging',
      },
    },
  });
}
