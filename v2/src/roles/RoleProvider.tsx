import type { User } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { mapLegacyLeagueRole, type AppRole } from './roleMapping';

interface RoleContextValue {
  role: AppRole | null;
  loading: boolean;
  error: string | null;
}

const RoleContext = createContext<RoleContextValue | null>(null);

async function resolveRole(client: LeagueSupabaseClient, user: User, leagueSlug: string): Promise<AppRole | null> {
  const ownerResponse = await client.rpc('is_platform_owner');
  if (!ownerResponse.error && ownerResponse.data === true) return 'platform_owner';

  const leagueResponse = await client
    .from('leagues')
    .select('id')
    .eq('slug', leagueSlug)
    .maybeSingle();
  if (leagueResponse.error || !leagueResponse.data) return null;

  const membershipResponse = await client
    .from('league_members')
    .select('role')
    .eq('league_id', leagueResponse.data.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membershipResponse.error) return null;

  return mapLegacyLeagueRole(membershipResponse.data?.role);
}

export function RoleProvider({ client, user, leagueSlug, children }: PropsWithChildren<{
  client: LeagueSupabaseClient;
  user: User | null;
  leagueSlug: string;
}>) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRole(null);
    setError(null);
    if (!user) {
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    void resolveRole(client, user, leagueSlug)
      .then((nextRole) => {
        if (active) setRole(nextRole);
      })
      .catch(() => {
        if (active) setError('Die Berechtigung konnte nicht sicher bestätigt werden.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [client, leagueSlug, user]);

  const value = useMemo(() => ({ role, loading, error }), [error, loading, role]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) throw new Error('useRole must be used inside RoleProvider.');
  return context;
}
