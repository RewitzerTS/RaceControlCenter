import { useCallback, useEffect, useState } from 'react';
import type { LeagueSupabaseClient } from '../lib/supabase';
import type { Database } from '../types/database';

type CareerStats = Database['public']['Tables']['driver_career_stats']['Row'];
type Progression = Database['public']['Tables']['driver_progression']['Row'];
type Wallet = Database['public']['Tables']['driver_wallets']['Row'];
type ChallengeDefinition = Pick<
  Database['public']['Tables']['challenge_definitions']['Row'],
  'code' | 'metric' | 'reward_vc' | 'sort_order' | 'target_value'
>;
type ChallengeProjection = Pick<
  Database['public']['Tables']['driver_challenges']['Row'],
  'challenge_code' | 'progress' | 'status'
>;
type UpcomingRace = Pick<
  Database['public']['Tables']['races']['Row'],
  'grand_prix_name' | 'id' | 'race_date' | 'race_start_at' | 'race_time'
>;

export interface DriverChallenge {
  code: string;
  metric: string;
  progress: number;
  rewardVc: number;
  status: string;
  target: number;
}

export interface DriverHomeSnapshot {
  achievementCount: number;
  career: CareerStats | null;
  challenges: DriverChallenge[];
  nextRace: UpcomingRace | null;
  progression: Progression | null;
  wallet: Wallet | null;
}

export type DriverHeroKind = 'career' | 'next-race' | 'result';

export function selectDriverHero(snapshot: DriverHomeSnapshot): DriverHeroKind {
  if (snapshot.career?.last_race_date) return 'result';
  if (snapshot.nextRace) return 'next-race';
  return 'career';
}

export function levelProgress(progression: Progression | null): number {
  if (!progression) return 0;
  if (progression.level >= 100) return 100;
  const levelWindow = progression.xp_into_level + progression.xp_to_next_level;
  if (levelWindow <= 0) return 0;
  return Math.max(0, Math.min(100, (progression.xp_into_level / levelWindow) * 100));
}

const EMPTY_SNAPSHOT: DriverHomeSnapshot = {
  achievementCount: 0,
  career: null,
  challenges: [],
  nextRace: null,
  progression: null,
  wallet: null,
};

async function loadSnapshot(
  client: LeagueSupabaseClient,
  driverIdentityId: string,
): Promise<DriverHomeSnapshot> {
  const today = new Date().toISOString().slice(0, 10);
  const [
    career,
    progression,
    wallet,
    achievements,
    challengeDefinitions,
    challengeProgress,
    nextRace,
  ] = await Promise.all([
    client.from('driver_career_stats').select('*').eq('driver_identity_id', driverIdentityId).maybeSingle(),
    client.from('driver_progression').select('*').eq('driver_identity_id', driverIdentityId).maybeSingle(),
    client.from('driver_wallets').select('*').eq('driver_identity_id', driverIdentityId).maybeSingle(),
    client
      .from('driver_achievements')
      .select('achievement_code', { count: 'exact', head: true })
      .eq('driver_identity_id', driverIdentityId)
      .eq('status', 'unlocked'),
    client
      .from('challenge_definitions')
      .select('code, metric, reward_vc, sort_order, target_value')
      .eq('is_active', true)
      .lte('active_from', new Date().toISOString())
      .order('sort_order'),
    client
      .from('driver_challenges')
      .select('challenge_code, progress, status')
      .eq('driver_identity_id', driverIdentityId),
    client
      .from('races')
      .select('grand_prix_name, id, race_date, race_start_at, race_time')
      .gte('race_date', today)
      .order('race_date')
      .limit(1)
      .maybeSingle(),
  ]);

  const responses = [
    career,
    progression,
    wallet,
    achievements,
    challengeDefinitions,
    challengeProgress,
    nextRace,
  ];
  const failed = responses.find((response) => response.error);
  if (failed?.error) throw failed.error;

  const progressByCode = new Map(
    (challengeProgress.data as ChallengeProjection[] | null)?.map((item) => [item.challenge_code, item]),
  );
  const challenges = ((challengeDefinitions.data ?? []) as ChallengeDefinition[]).map((definition) => {
    const current = progressByCode.get(definition.code);
    return {
      code: definition.code,
      metric: definition.metric,
      progress: current?.progress ?? 0,
      rewardVc: definition.reward_vc,
      status: current?.status ?? 'active',
      target: definition.target_value,
    };
  });

  return {
    achievementCount: achievements.count ?? 0,
    career: career.data,
    challenges,
    nextRace: nextRace.data,
    progression: progression.data,
    wallet: wallet.data,
  };
}

export function useDriverHome(
  client: LeagueSupabaseClient,
  driverIdentityId: string | null,
) {
  const [snapshot, setSnapshot] = useState<DriverHomeSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(Boolean(driverIdentityId));
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setError(null);

    if (!driverIdentityId) {
      setSnapshot(EMPTY_SNAPSHOT);
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    void loadSnapshot(client, driverIdentityId)
      .then((nextSnapshot) => {
        if (active) setSnapshot(nextSnapshot);
      })
      .catch(() => {
        if (active) setError('driver-home-load-failed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [client, driverIdentityId, reloadKey]);

  return { error, loading, reload, snapshot };
}
