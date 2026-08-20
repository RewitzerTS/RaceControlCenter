import type { LeagueSupabaseClient } from '../lib/supabase';

export const DEMO_LEAGUE_SLUG = 'demo';

export const DEMO_COVERAGE_KEYS = [
  'dns', 'dnf', 'dsq', 'substitute', 'team_change', 'steward_case',
  'penalty', 'revised_result', 'achievements', 'challenges', 'xp',
  'credits', 'cosmetics',
] as const;

export type DemoCoverageKey = (typeof DEMO_COVERAGE_KEYS)[number];
export type DemoTeamHistory = { team: string; rounds: string; role?: string };
export type DemoProgression = {
  xp: number;
  level: number;
  rank: string;
  credits: number;
  achievements: string[];
  challenges: string[];
  cosmetics: string[];
};
export type DemoDriver = {
  name: string;
  gamertag: string;
  number: number;
  substitute: boolean;
  team_history: DemoTeamHistory[];
  progression: DemoProgression;
};
export type DemoCalendarItem = {
  id: string;
  round: number;
  name: string;
  circuit: string;
  date: string;
  status: string;
  result_version: number | null;
};
export type DemoSnapshot = {
  league: { id: string; name: string; slug: string; owner_only: boolean; progression_scope: string };
  counts: { registered_drivers: number; teams: number; races: number; result_versions: number; steward_cases: number };
  coverage: Record<DemoCoverageKey, boolean>;
  drivers: DemoDriver[];
  calendar: DemoCalendarItem[];
  steward: { case_number: string; title: string; status: string; penalty: string; result_version: number } | null;
};

function isSnapshot(value: unknown): value is DemoSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DemoSnapshot>;
  return candidate.league?.slug === DEMO_LEAGUE_SLUG
    && Array.isArray(candidate.drivers)
    && Array.isArray(candidate.calendar)
    && DEMO_COVERAGE_KEYS.every((key) => typeof candidate.coverage?.[key] === 'boolean');
}

export async function loadDemoSnapshot(client: LeagueSupabaseClient): Promise<DemoSnapshot> {
  const response = await client.rpc('get_demo_full_e2e_snapshot');
  if (response.error) throw response.error;
  if (!isSnapshot(response.data)) throw new Error('Unexpected Demo Full E2E payload.');
  return response.data;
}

export function completeCoverage(snapshot: DemoSnapshot): number {
  return DEMO_COVERAGE_KEYS.filter((key) => snapshot.coverage[key]).length;
}
