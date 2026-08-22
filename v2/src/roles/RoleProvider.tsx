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

async function resolveRole(client: LeagueSupabaseClient, _user: User): Promise<AppRole | null> {
  const response = await client.rpc('current_app_role');
  if (response.error) throw response.error;
  return mapLegacyLeagueRole(response.data);
}

export function RoleProvider({ client, user, children }: PropsWithChildren<{
  client: LeagueSupabaseClient;
  user: User | null;
}>) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRole(null);
    setResolvedUserId(null);
    setError(null);
    if (!user) {
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    void resolveRole(client, user)
      .then((nextRole) => {
        if (active) setRole(nextRole);
      })
      .catch(() => {
        if (active) setError('Die Berechtigung konnte nicht sicher bestätigt werden.');
      })
      .finally(() => {
        if (active) {
          setResolvedUserId(user.id);
          setLoading(false);
        }
      });

    return () => { active = false; };
  }, [client, user]);

  const safelyLoading = Boolean(user) && (loading || resolvedUserId !== user?.id);
  const value = useMemo(() => ({ role, loading: safelyLoading, error }), [error, role, safelyLoading]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) throw new Error('useRole must be used inside RoleProvider.');
  return context;
}
