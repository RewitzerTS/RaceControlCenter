import type { User } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { LeagueSupabaseClient } from '../lib/supabase';

interface DriverIdentitySummary {
  driverId: string | null;
  id: string;
  profileNumber: number;
  status: string;
  linkedDriverCount: number;
}

interface DriverIdentityContextValue {
  identity: DriverIdentitySummary | null;
  loading: boolean;
  error: string | null;
}

const DriverIdentityContext = createContext<DriverIdentityContextValue | null>(null);

async function resolveDriverIdentity(
  client: LeagueSupabaseClient,
  leagueSlug: string,
  userId: User['id'],
): Promise<DriverIdentitySummary | null> {
  const identityResponse = await client
    .from('driver_identities')
    .select('id, profile_number, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (identityResponse.error) throw identityResponse.error;
  if (!identityResponse.data) return null;

  const leagueResponse = await client
    .from('leagues')
    .select('id')
    .eq('slug', leagueSlug)
    .maybeSingle();

  if (leagueResponse.error) throw leagueResponse.error;

  if (!leagueResponse.data) {
    return {
      driverId: null,
      id: identityResponse.data.id,
      profileNumber: identityResponse.data.profile_number,
      status: identityResponse.data.status,
      linkedDriverCount: 0,
    };
  }

  const linksResponse = await client
    .from('driver_identity_links')
    .select('driver_id, driver:drivers!inner(league_id)')
    .eq('driver_identity_id', identityResponse.data.id)
    .eq('driver.league_id', leagueResponse.data.id);

  if (linksResponse.error) throw linksResponse.error;

  const links = linksResponse.data ?? [];
  return {
    driverId: links[0]?.driver_id ?? null,
    id: identityResponse.data.id,
    profileNumber: identityResponse.data.profile_number,
    status: identityResponse.data.status,
    linkedDriverCount: links.length,
  };
}

export function DriverIdentityProvider({ client, leagueSlug, user, children }: PropsWithChildren<{
  client: LeagueSupabaseClient;
  leagueSlug: string;
  user: User | null;
}>) {
  const [identity, setIdentity] = useState<DriverIdentitySummary | null>(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id ?? null;
  const identityScope = userId ? `${userId}:${leagueSlug}` : null;
  const activeIdentityScopeRef = useRef<string | null>(identityScope);

  useEffect(() => {
    let active = true;
    setError(null);

    if (!userId) {
      setIdentity(null);
      activeIdentityScopeRef.current = null;
      setLoading(false);
      return () => { active = false; };
    }

    if (activeIdentityScopeRef.current !== identityScope) setIdentity(null);
    activeIdentityScopeRef.current = identityScope;
    setLoading(true);
    void resolveDriverIdentity(client, leagueSlug, userId)
      .then((nextIdentity) => {
        if (active) setIdentity(nextIdentity);
      })
      .catch(() => {
        if (active) setError('Die globale Fahreridentität konnte nicht sicher geprüft werden.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [client, identityScope, leagueSlug, userId]);

  const value = useMemo(
    () => ({ identity, loading, error }),
    [error, identity, loading],
  );

  return <DriverIdentityContext.Provider value={value}>{children}</DriverIdentityContext.Provider>;
}

export function useDriverIdentity(): DriverIdentityContextValue {
  const context = useContext(DriverIdentityContext);
  if (!context) throw new Error('useDriverIdentity must be used inside DriverIdentityProvider.');
  return context;
}
