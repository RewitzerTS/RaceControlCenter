import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';
import type { RuntimeEnvironment } from '../config/environment';
import { createLeagueClient } from '../lib/supabase';

interface LeagueContextValue {
  leagueSlug: string;
  setLeagueSlug: (slug: string) => void;
  client: SupabaseClient;
}

const LeagueContext = createContext<LeagueContextValue | null>(null);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function initialSlug(fallback: string): string {
  const urlSlug = new URLSearchParams(window.location.search).get('league')?.toLowerCase();
  return urlSlug && SLUG_PATTERN.test(urlSlug) ? urlSlug : fallback;
}

export function LeagueProvider({ environment, children }: PropsWithChildren<{ environment: RuntimeEnvironment }>) {
  const [leagueSlug, setLeagueSlugState] = useState(() => initialSlug(environment.defaultLeagueSlug));
  const client = useMemo(() => createLeagueClient(environment, leagueSlug), [environment, leagueSlug]);

  function setLeagueSlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    if (!SLUG_PATTERN.test(normalized)) throw new Error('Invalid league slug.');
    setLeagueSlugState(normalized);
  }

  const value = useMemo(() => ({ leagueSlug, setLeagueSlug, client }), [client, leagueSlug]);
  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeague(): LeagueContextValue {
  const context = useContext(LeagueContext);
  if (!context) throw new Error('useLeague must be used inside LeagueProvider.');
  return context;
}
