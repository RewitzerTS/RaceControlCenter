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
  userId: User['id'],
): Promise<DriverIdentitySummary | null> {
  const identityResponse = await client
    .from('driver_identities')
    .select('id, profile_number, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (identityResponse.error) throw identityResponse.error;
  if (!identityResponse.data) return null;

  const linksResponse = await client
    .from('driver_identity_links')
    .select('driver_id')
    .eq('driver_identity_id', identityResponse.data.id);

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

export function DriverIdentityProvider({ client, user, children }: PropsWithChildren<{
  client: LeagueSupabaseClient;
  user: User | null;
}>) {
  const [identity, setIdentity] = useState<DriverIdentitySummary | null>(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id ?? null;
  const activeUserIdRef = useRef<string | null>(userId);

  useEffect(() => {
    let active = true;
    setError(null);

    if (!userId) {
      setIdentity(null);
      activeUserIdRef.current = null;
      setLoading(false);
      return () => { active = false; };
    }

    if (activeUserIdRef.current !== userId) setIdentity(null);
    activeUserIdRef.current = userId;
    setLoading(true);
    void resolveDriverIdentity(client, userId)
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
  }, [client, userId]);

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
