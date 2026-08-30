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

interface LeagueMembershipRow {
  league_id: string;
  role: string | null;
}

interface LeagueScopeRow {
  id: string;
  slug: string;
}

export function membershipRoleForLeague(
  memberships: ReadonlyArray<LeagueMembershipRow>,
  leagues: ReadonlyArray<LeagueScopeRow>,
  leagueSlug: string,
): AppRole | null {
  const league = leagues.find((item) => item.slug === leagueSlug);
  if (!league) return null;
  return mapLegacyLeagueRole(memberships.find((item) => item.league_id === league.id)?.role);
}

async function resolveRole(
  client: LeagueSupabaseClient,
  leagueSlug: string,
  userId: string,
): Promise<AppRole | null> {
  const response = await client.rpc('current_app_role');
  if (response.error) throw response.error;
  if (mapLegacyLeagueRole(response.data) === 'platform_owner') return 'platform_owner';

  // Do not trust a legacy identity-based "driver" fallback here. A league role
  // is only valid after the user's own membership and its league were proven.
  const { data: memberships, error: membershipError } = await client
    .from('league_members')
    .select('league_id, role')
    .eq('user_id', userId);
  if (membershipError) throw membershipError;
  if (!memberships?.length) return null;

  const { data: leagues, error: leagueError } = await client
    .from('leagues')
    .select('id, slug')
    .in('id', memberships.map((membership) => membership.league_id))
    .eq('status', 'active');
  if (leagueError) throw leagueError;

  return membershipRoleForLeague(memberships, leagues ?? [], leagueSlug);
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
    void resolveRole(client, leagueSlug, userId)
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
