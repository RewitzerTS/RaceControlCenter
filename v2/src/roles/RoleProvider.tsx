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

async function resolveRole(client: LeagueSupabaseClient): Promise<AppRole | null> {
  const response = await client.rpc('current_app_role');
  if (response.error) throw response.error;
  return mapLegacyLeagueRole(response.data);
}

export function RoleProvider({ client, leagueSlug, user, children }: PropsWithChildren<{
  client: LeagueSupabaseClient;
  leagueSlug: string;
  user: User | null;
}>) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(Boolean(user));
  const userId = user?.id ?? null;
  const currentScope = userId ? `${userId}:${leagueSlug}` : null;
  const [resolvedScope, setResolvedScope] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRole(null);
    setResolvedScope(null);
    setError(null);
    if (!userId) {
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    void resolveRole(client)
      .then((nextRole) => {
        if (active) setRole(nextRole);
      })
      .catch(() => {
        if (active) setError('Die Berechtigung konnte nicht sicher bestätigt werden.');
      })
      .finally(() => {
        if (active) {
          setResolvedScope(`${userId}:${leagueSlug}`);
          setLoading(false);
        }
      });

    return () => { active = false; };
  }, [client, leagueSlug, userId]);

  const safelyLoading = Boolean(user) && (loading || resolvedScope !== currentScope);
  const value = useMemo(() => ({ role, loading: safelyLoading, error }), [error, role, safelyLoading]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) throw new Error('useRole must be used inside RoleProvider.');
  return context;
}
