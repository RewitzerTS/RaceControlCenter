import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { RuntimeEnvironment } from '../config/environment';
import { createLeagueClient, type LeagueSupabaseClient } from '../lib/supabase';
import { applyLeagueBranding, fallbackLeagueBranding, loadLeagueBrandingRuntime, type LeagueBrandingRuntime } from './leagueBranding';

interface LeagueContextValue {
  leagueSlug: string;
  setLeagueSlug: (slug: string) => void;
  client: LeagueSupabaseClient;
  branding: LeagueBrandingRuntime;
  brandingLoading: boolean;
  refreshBranding: () => Promise<void>;
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
  const [branding, setBranding] = useState<LeagueBrandingRuntime>(() => fallbackLeagueBranding(leagueSlug));
  const [brandingLoading, setBrandingLoading] = useState(true);

  const refreshBranding = useCallback(async () => {
    setBrandingLoading(true);
    try {
      const nextBranding = await loadLeagueBrandingRuntime(client, leagueSlug);
      setBranding(nextBranding);
      applyLeagueBranding(nextBranding);
    } catch (reason) {
      const fallback = fallbackLeagueBranding(leagueSlug);
      setBranding(fallback);
      applyLeagueBranding(fallback);
      console.warn('Liga-Branding konnte nicht geladen werden.', reason);
    } finally {
      setBrandingLoading(false);
    }
  }, [client, leagueSlug]);

  useEffect(() => { void refreshBranding(); }, [refreshBranding]);

  function setLeagueSlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    if (!SLUG_PATTERN.test(normalized)) throw new Error('Invalid league slug.');
    setLeagueSlugState(normalized);
  }

  const value = useMemo(() => ({ leagueSlug, setLeagueSlug, client, branding, brandingLoading, refreshBranding }), [branding, brandingLoading, client, leagueSlug, refreshBranding]);
  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeague(): LeagueContextValue {
  const context = useContext(LeagueContext);
  if (!context) throw new Error('useLeague must be used inside LeagueProvider.');
  return context;
}
