import type { LeagueSupabaseClient } from '../lib/supabase';
import { loadConfigurationWorkspace, loadMemberAdminWorkspace, loadRaceAdminWorkspace, loadSeasonSetupWorkspace, type ConfigurationWorkspace, type MemberAdminWorkspace, type RaceAdminWorkspace, type SeasonSetupWorkspace, type LeagueRace } from './operations';
import { loadTeamManager, type TeamManager } from './teamManager';
import { vehicleChangeRounds } from './roster';

export type OverviewData = {
  setup: SeasonSetupWorkspace | null; races: RaceAdminWorkspace | null;
  members: MemberAdminWorkspace | null; config: ConfigurationWorkspace | null;
  roster: TeamManager | null; raceCount: number | null; cases: number | null;
};
export type TaskKey = 'requests' | 'unlinked' | 'seats' | 'teams' | 'drafts' | 'missing' | 'cases';

// Independent failures must not turn into zero counts or a completion recommendation.
export async function loadOverview(client: LeagueSupabaseClient): Promise<OverviewData> {
  const optional = async <T,>(work: Promise<T>): Promise<T | null> => work.catch(() => null);
  const [setup, races, members, config, roster] = await Promise.all([
    optional(loadSeasonSetupWorkspace(client)), optional(loadRaceAdminWorkspace(client)),
    optional(loadMemberAdminWorkspace(client)), optional(loadConfigurationWorkspace(client)),
    optional((async () => {
      const initial = await loadTeamManager(client, 'current', null);
      const next = vehicleChangeRounds(initial.races)[0];
      return next ? loadTeamManager(client, 'current', next.round) : initial;
    })()),
  ]);
  const seasonId = setup?.active_season?.id;
  const count = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
    try { const result = await query; return result.error ? null : result.count; } catch { return null; }
  };
  const [raceCount, cases] = seasonId ? await Promise.all([
    count(client.from('races').select('id', { count: 'exact', head: true }).eq('season_id', seasonId)),
    count(client.from('steward_cases').select('id,races!inner(season_id)', { count: 'exact', head: true }).eq('races.season_id', seasonId).neq('status', 'closed').is('deleted_at', null)),
  ]) : [null, null];
  return { setup, races, members, config, roster, raceCount, cases };
}

export function localDay(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function isCancelled(race: LeagueRace) { return ['cancelled', 'canceled'].includes(race.status); }
export function raceIsDue(race: LeagueRace, now: Date) {
  if (race.status === 'completed') return true;
  if (race.race_start_at) return new Date(race.race_start_at).getTime() <= now.getTime();
  // Without a start time, don't call a race overdue before its day has ended.
  return Boolean(race.race_date && race.race_date < localDay(now));
}

export function deriveOverview(data: OverviewData, now = new Date()) {
  const season = data.setup?.active_season ?? null;
  const active = data.races?.seasons.filter(s => s.is_active) ?? [];
  const scopeKnown = Boolean(data.setup && data.races && (season ? active.length === 1 && active[0].id === season.id : active.length === 0));
  const races = season && scopeKnown ? (data.races?.races ?? []).filter(r => r.season_id === season.id).sort((a, b) => (a.race_date ?? '9999').localeCompare(b.race_date ?? '9999') || (a.race_start_at ?? '').localeCompare(b.race_start_at ?? '') || a.round_number - b.round_number) : [];
  const completeCalendar = Boolean(scopeKnown && season && data.raceCount !== null && data.raceCount === races.length && new Set(races.map(r => r.id)).size === races.length && season.calendar.length === races.length);
  const ids = new Set(races.map(r => r.id));
  const drafts = data.config?.result_drafts.filter(d => ids.has(d.race_id) && ['draft', 'validated'].includes(d.status)) ?? [];
  const drafted = new Set(drafts.map(d => d.race_id));
  const unfinished = races.filter(r => !isCancelled(r) && r.result_status !== 'active');
  const missing = unfinished.filter(r => raceIsDue(r, now) && !drafted.has(r.id));
  const rosterKnown = Boolean(data.roster && scopeKnown && (data.roster.season?.id ?? null) === (season?.id ?? null));
  const humans = rosterKnown ? data.roster!.profiles.filter(p => p.is_active && !p.is_ai) : [];
  const tasks: { key: TaskKey; count: number; to: string }[] = [];
  const add = (key: TaskKey, count: number, to: string) => { if (count > 0) tasks.push({ key, count, to }); };
  if (data.members) {
    add('requests', data.members.join_requests.filter(r => r.status === 'pending').length, '/admin/users');
    add('unlinked', data.members.members.filter(m => m.role === 'driver' && !m.driver_id).length, '/admin/users');
  }
  if (season && rosterKnown) {
    add('seats', humans.filter(p => !p.car_name || !p.ai_driver_id).length, '/admin/drivers');
    add('teams', humans.filter(p => p.car_name && p.ai_driver_id && !p.team_name).length, '/admin/drivers');
  }
  if (scopeKnown && data.config) add('drafts', drafts.length, '/admin/results/import#result-draft-heading');
  if (scopeKnown && data.config) add('missing', missing.length, '/admin/results/import');
  if (scopeKnown && data.cases !== null) add('cases', data.cases, '/stewarding');
  const incomplete = !scopeKnown || !data.members || !data.config || !rosterKnown || Boolean(season && (!completeCalendar || data.cases === null));
  const today = localDay(now);
  const next = unfinished.find(r => r.race_date && r.race_date >= today);
  const backlog = unfinished.filter(r => r.race_date && r.race_date < today).at(-1);
  const day = next?.race_date ?? backlog?.race_date;
  const raceDay = day ? races.filter(r => r.race_date === day && !isCancelled(r)) : unfinished.filter(r => !r.race_date);
  const ready = !incomplete && races.length > 0 && unfinished.length === 0 && drafts.length === 0 && data.cases === 0 && races.every(r => isCancelled(r) || (r.status === 'completed' && raceIsDue(r, now)));
  return { season, scopeKnown, races, tasks, drafts, incomplete, ready, raceDay, isBacklog: !next && Boolean(backlog), emptyCalendar: completeCalendar && races.length === 0 };
}
