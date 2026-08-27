import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { RuntimeEnvironment } from '../config/environment';
import { createLeagueClient, type LeagueSupabaseClient } from '../lib/supabase';
import { fallbackLeagueBranding, loadLeagueBrandingRuntime, type LeagueBrandingRuntime } from './leagueBranding';

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
export const ACTIVE_LEAGUE_STORAGE_KEY = 'racevora.activeLeague';
export const LEGACY_ACTIVE_LEAGUE_STORAGE_KEY = 'rcc.activeLeagueSlug.v1';
export const LEGACY_TENANT_STORAGE_KEY = 'rcc.lastTenantSlug.v1';

function removeSessionValuesByPrefix(prefix: string): void {
  const matchingKeys: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(prefix)) matchingKeys.push(key);
  }
  matchingKeys.forEach((key) => window.sessionStorage.removeItem(key));
}

export function persistActiveLeagueSlug(slug: string): void {
  window.localStorage.setItem(ACTIVE_LEAGUE_STORAGE_KEY, slug);
  window.sessionStorage.setItem(LEGACY_ACTIVE_LEAGUE_STORAGE_KEY, slug);
  window.sessionStorage.setItem(LEGACY_TENANT_STORAGE_KEY, slug);
  window.sessionStorage.removeItem('rcc.calendar.activeSection');
  window.sessionStorage.removeItem('rcc.calendar.archiveSeason');
  removeSessionValuesByPrefix('rcc.standings.view.v1:');
}

export function resolveInitialLeagueSlug(search: string, storedSlug: string | null, fallback: string): string {
  const urlSlug = new URLSearchParams(search).get('league')?.toLowerCase();
  if (urlSlug && SLUG_PATTERN.test(urlSlug)) return urlSlug;
  const normalizedStoredSlug = storedSlug?.trim().toLowerCase();
  return normalizedStoredSlug && SLUG_PATTERN.test(normalizedStoredSlug) ? normalizedStoredSlug : fallback;
}

function initialSlug(fallback: string): string {
  let storedSlug: string | null = null;
  try {
    storedSlug = window.localStorage.getItem(ACTIVE_LEAGUE_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
  return resolveInitialLeagueSlug(window.location.search, storedSlug, fallback);
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
    } catch (reason) {
      const fallback = fallbackLeagueBranding(leagueSlug);
      setBranding(fallback);
      console.warn('Liga-Branding konnte nicht geladen werden.', reason);
    } finally {
      setBrandingLoading(false);
    }
  }, [client, leagueSlug]);

  useEffect(() => { void refreshBranding(); }, [refreshBranding]);

  const setLeagueSlug = useCallback((slug: string) => {
    const normalized = slug.trim().toLowerCase();
    if (!SLUG_PATTERN.test(normalized)) throw new Error('Invalid league slug.');
    try {
      persistActiveLeagueSlug(normalized);
    } catch {
      // The in-memory selection still works when persistent storage is blocked.
    }
    setLeagueSlugState(normalized);
  }, []);

  const value = useMemo(() => ({ leagueSlug, setLeagueSlug, client, branding, brandingLoading, refreshBranding }), [branding, brandingLoading, client, leagueSlug, refreshBranding, setLeagueSlug]);
  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeague(): LeagueContextValue {
  const context = useContext(LeagueContext);
  if (!context) throw new Error('useLeague must be used inside LeagueProvider.');
  return context;
}
