import { useCallback, useEffect, useState } from 'react';
import type { LeagueSupabaseClient } from '../lib/supabase';
import type { Database } from '../types/database';

type CareerStats = Database['public']['Tables']['driver_career_stats']['Row'];
type Progression = Database['public']['Tables']['driver_progression']['Row'];
type Wallet = Database['public']['Tables']['driver_wallets']['Row'];
type AchievementDefinition = Pick<
  Database['public']['Tables']['achievement_definitions']['Row'],
  'code' | 'description_key' | 'metric' | 'reward_vc' | 'sort_order' | 'threshold' | 'title_key'
>;
type AchievementProjection = Pick<
  Database['public']['Tables']['driver_achievements']['Row'],
  'achievement_code' | 'current_value' | 'status' | 'unlocked_at'
>;
type ChallengeDefinition = Pick<
  Database['public']['Tables']['challenge_definitions']['Row'],
  'active_from' | 'active_until' | 'code' | 'metric' | 'reward_vc' | 'sort_order' | 'target_value'
>;
type ChallengeProjection = Pick<
  Database['public']['Tables']['driver_challenges']['Row'],
  'challenge_code' | 'progress' | 'status'
>;
type UpcomingRace = Pick<
  Database['public']['Tables']['races']['Row'],
  'grand_prix_name' | 'id' | 'race_date' | 'race_start_at' | 'race_time'
>;
type SeasonRow = Pick<
  Database['public']['Tables']['seasons']['Row'],
  'archived_at' | 'id' | 'is_active' | 'name'
>;

export interface DriverSeasonSummary {
  archivedAt: string | null;
  id: string;
  name: string;
}

export interface DriverChallenge {
  activeFrom: string;
  activeUntil: string | null;
  code: string;
  metric: string;
  progress: number;
  rewardVc: number;
  status: string;
  target: number;
}

export interface DriverAchievement {
  code: string;
  currentValue: number;
  descriptionKey: string;
  metric: string;
  rewardVc: number;
  threshold: number;
  titleKey: string;
  unlockedAt: string | null;
}

export interface DriverHomeSnapshot {
  activeSeason: DriverSeasonSummary | null;
  achievementCount: number;
  achievementTotal: number;
  achievements: DriverAchievement[];
  latestAchievement: string | null;
  latestArchivedSeason: DriverSeasonSummary | null;
  career: CareerStats | null;
  challenges: DriverChallenge[];
  nextRace: UpcomingRace | null;
  progression: Progression | null;
  wallet: Wallet | null;
}

export type DriverHeroKind = 'career' | 'next-race' | 'result' | 'season-complete';

export function selectDriverHero(snapshot: DriverHomeSnapshot): DriverHeroKind {
  if (!snapshot.activeSeason && snapshot.latestArchivedSeason) return 'season-complete';
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

const CHALLENGE_ROTATION_MS = 7 * 24 * 60 * 60 * 1000;

export function nextChallengeRotation(challenges: DriverChallenge[], now = Date.now()): number | null {
  if (!challenges.length) return null;
  const scheduledEnd = challenges
    .map((challenge) => challenge.activeUntil ? Date.parse(challenge.activeUntil) : Number.NaN)
    .filter((value) => Number.isFinite(value) && value > now)
    .sort((left, right) => left - right)[0];
  if (scheduledEnd) return scheduledEnd;

  const anchor = Math.min(...challenges.map((challenge) => Date.parse(challenge.activeFrom)).filter(Number.isFinite));
  if (!Number.isFinite(anchor)) return null;
  return anchor + (Math.floor((now - anchor) / CHALLENGE_ROTATION_MS) + 1) * CHALLENGE_ROTATION_MS;
}

const EMPTY_SNAPSHOT: DriverHomeSnapshot = {
  activeSeason: null,
  achievementCount: 0,
  achievementTotal: 0,
  achievements: [],
  latestAchievement: null,
  latestArchivedSeason: null,
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
  const seasons = await client
    .from('seasons')
    .select('archived_at, id, is_active, name');
  if (seasons.error) throw seasons.error;
  const seasonRows = (seasons.data ?? []) as SeasonRow[];
  const activeSeasonRow = seasonRows.find((season) => season.is_active) ?? null;
  const latestArchivedSeasonRow = seasonRows
    .filter((season) => !season.is_active && season.archived_at)
    .sort((left, right) => Date.parse(right.archived_at ?? '') - Date.parse(left.archived_at ?? ''))[0] ?? null;
  const [
    career,
    progression,
    wallet,
    achievementDefinitions,
    achievementProgress,
    challengeDefinitions,
    challengeProgress,
    nextRace,
  ] = await Promise.all([
    client.from('driver_career_stats').select('*').eq('driver_identity_id', driverIdentityId).maybeSingle(),
    client.from('driver_progression').select('*').eq('driver_identity_id', driverIdentityId).maybeSingle(),
    client.from('driver_wallets').select('*').eq('driver_identity_id', driverIdentityId).maybeSingle(),
    client
      .from('achievement_definitions')
      .select('code, description_key, metric, reward_vc, sort_order, threshold, title_key')
      .eq('is_active', true)
      .eq('is_core', true)
      .order('sort_order'),
    client
      .from('driver_achievements')
      .select('achievement_code, current_value, status, unlocked_at')
      .eq('driver_identity_id', driverIdentityId),
    client
      .from('challenge_definitions')
      .select('active_from, active_until, code, metric, reward_vc, sort_order, target_value')
      .eq('is_active', true)
      .lte('active_from', new Date().toISOString())
      .order('sort_order'),
    client
      .from('driver_challenges')
      .select('challenge_code, progress, status')
      .eq('driver_identity_id', driverIdentityId),
    activeSeasonRow
      ? client
          .from('races')
          .select('grand_prix_name, id, race_date, race_start_at, race_time')
          .eq('season_id', activeSeasonRow.id)
          .eq('status', 'upcoming')
          .gte('race_date', today)
          .order('race_date')
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const responses = [
    career,
    progression,
    wallet,
    achievementDefinitions,
    achievementProgress,
    challengeDefinitions,
    challengeProgress,
    nextRace,
  ];
  const failed = responses.find((response) => response.error);
  if (failed?.error) throw failed.error;

  const achievementProgressByCode = new Map(
    (achievementProgress.data as AchievementProjection[] | null)?.map((item) => [item.achievement_code, item]),
  );
  const achievements = ((achievementDefinitions.data ?? []) as AchievementDefinition[])
    .map((definition) => ({ definition, progress: achievementProgressByCode.get(definition.code) }))
    .filter(({ progress: item }) => item?.status === 'unlocked')
    .map(({ definition, progress: item }) => ({
      code: definition.code,
      currentValue: item?.current_value ?? definition.threshold,
      descriptionKey: definition.description_key,
      metric: definition.metric,
      rewardVc: definition.reward_vc,
      threshold: definition.threshold,
      titleKey: definition.title_key,
      unlockedAt: item?.unlocked_at ?? null,
    }))
    .sort((left, right) => (Date.parse(right.unlockedAt ?? '') || 0) - (Date.parse(left.unlockedAt ?? '') || 0));

  const progressByCode = new Map(
    (challengeProgress.data as ChallengeProjection[] | null)?.map((item) => [item.challenge_code, item]),
  );
  const challenges = ((challengeDefinitions.data ?? []) as ChallengeDefinition[]).map((definition) => {
    const current = progressByCode.get(definition.code);
    return {
      activeFrom: definition.active_from,
      activeUntil: definition.active_until,
      code: definition.code,
      metric: definition.metric,
      progress: current?.progress ?? 0,
      rewardVc: definition.reward_vc,
      status: current?.status ?? 'active',
      target: definition.target_value,
    };
  });

  return {
    activeSeason: activeSeasonRow ? {
      archivedAt: activeSeasonRow.archived_at,
      id: activeSeasonRow.id,
      name: activeSeasonRow.name,
    } : null,
    achievementCount: achievements.length,
    achievementTotal: (achievementDefinitions.data ?? []).length,
    achievements,
    latestAchievement: achievements[0]?.code ?? null,
    latestArchivedSeason: latestArchivedSeasonRow ? {
      archivedAt: latestArchivedSeasonRow.archived_at,
      id: latestArchivedSeasonRow.id,
      name: latestArchivedSeasonRow.name,
    } : null,
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
