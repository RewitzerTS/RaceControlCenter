import { describe, expect, it, vi } from 'vitest';
import type { AdminSnapshot, LeagueRace, RaceAdminWorkspace, SeasonCalendarEntry, SeasonSetupWorkspace } from './operations';
import { copyLeagueIdToClipboard } from './AdminWorkspacePage';
import { deriveOverview, type OverviewData } from './adminOverview';

const snapshot: AdminSnapshot = {
  counts: { failed_jobs: 0, open_steward_cases: 0, pending_jobs: 0, races: 0 },
  league: { id: 'league-1', name: 'Test League', slug: 'test-league', status: 'active' },
  recent_audit: [],
};

function setup(calendar: SeasonCalendarEntry[]): SeasonSetupWorkspace {
  return {
    active_season: { calendar, calendar_can_configure: true, end_date: null, fastest_lap_bonus_enabled: false, fastest_lap_bonus_max_finish_position: 10, fastest_lap_bonus_points: 1, game_key: 'f1_25', game_label: 'F1 25', id: 'season-1', name: 'Season 1', slug: 'season-1', start_date: null },
    games: [],
    league: snapshot.league,
  };
}

function race(overrides: Partial<LeagueRace> = {}): LeagueRace {
  return { circuit_name: 'Spa', country_code: 'BE', grand_prix_name: 'Belgien GP', has_sprint: false, id: 'race-1', race_date: '2026-08-29', race_start_at: null, result_activated_at: null, result_count: 0, result_status: null, result_version: null, round_number: 1, season_id: 'season-1', season_name: 'Season 1', status: 'completed', ...overrides };
}

function races(items: LeagueRace[]): RaceAdminWorkspace {
  return { driver_standings: [], league: snapshot.league, races: items, seasons: [{ end_date: null, game_label: 'F1 25', id: 'season-1', is_active: true, name: 'Season 1', slug: 'season-1', start_date: null }], team_standings: [] };
}

const now = new Date(2026, 7, 29, 12);
function overview(items: LeagueRace[] = [race({ result_status: 'active', race_date: '2026-08-28' })]): OverviewData {
  return {
    setup: setup(items.map(r => ({ date: r.race_date!, time: '20:00', track_key: 'spa', weather: 'klar', has_sprint: false }))),
    races: races(items), members: { league: snapshot.league, members: [], join_requests: [] },
    config: { league: snapshot.league, rules: {}, faqs: [], audit: [], result_drafts: [] },
    roster: { mode: 'current', season: { id: 'season-1', name: 'Season 1' }, view_round: 1, revision: 'test', profiles: [], teams: [], races: [] },
    raceCount: items.length, cases: 0,
  };
}

describe('league overview priorities', () => {
  it('shows both races of the next race day, even if its first race is already official', () => {
    const first = race({ result_status: 'active', race_date: '2026-08-29' });
    const second = race({ id: 'race-2', round_number: 2, status: 'upcoming', race_date: '2026-08-29', race_start_at: '2026-08-29T21:00:00Z' });
    const view = deriveOverview(overview([first, second, race({ id: 'later', race_date: '2026-09-05', status: 'upcoming' })]), now);
    expect(view.raceDay.map(r => r.id)).toEqual(['race-1', 'race-2']);
    expect(view.ready).toBe(false);
    expect(view.tasks).toEqual([]);
  });
  it('shows missing results separately from existing drafts and ignores previous seasons', () => {
    const data = overview([race(), race({ id: 'race-2' })]);
    data.races!.races.push(race({ id: 'old', season_id: 'old-season' }));
    data.config!.result_drafts = [
      { id: 'draft', race_id: 'race-1', race_name: 'Spa', version_number: 1, status: 'draft', change_reason: '', created_at: '', row_count: 20 },
      { id: 'old-draft', race_id: 'old', race_name: 'Old', version_number: 1, status: 'draft', change_reason: '', created_at: '', row_count: 20 },
    ];
    expect(deriveOverview(data, now).tasks).toEqual([
      { key: 'drafts', count: 1, to: '/admin/results/import#result-draft-heading' },
      { key: 'missing', count: 1, to: '/admin/results/import' },
    ]);
  });
  it('suggests closure only with a complete calendar, no drafts and no open current-season cases', () => {
    expect(deriveOverview(overview(), now).ready).toBe(true);
    const open = overview(); open.cases = 1;
    expect(deriveOverview(open, now).ready).toBe(false);
    const draft = overview(); draft.config!.result_drafts = [{ id: 'd', race_id: 'race-1', race_name: 'Spa', version_number: 2, status: 'validated', change_reason: '', created_at: '', row_count: 20 }];
    expect(deriveOverview(draft, now).ready).toBe(false);
  });
  it.each(['setup', 'races', 'members', 'config', 'roster', 'raceCount', 'cases'] as const)('fails closed when %s could not be loaded', key => {
    const data = overview(); data[key] = null;
    const view = deriveOverview(data, now);
    expect(view.incomplete).toBe(true); expect(view.ready).toBe(false);
  });
  it('does not close a season based on a partial calendar or mismatched active season', () => {
    const partial = overview(); partial.raceCount = 24;
    expect(deriveOverview(partial, now).ready).toBe(false);
    expect(deriveOverview(partial, now).incomplete).toBe(true);
    const mismatch = overview(); mismatch.races!.seasons[0].id = 'another-season';
    expect(deriveOverview(mismatch, now).scopeKnown).toBe(false);
    expect(deriveOverview(mismatch, now).ready).toBe(false);
  });
  it('never offers closure for upcoming races, undated races or an empty season', () => {
    for (const items of [[race({ status: 'upcoming', result_status: 'active', race_date: '2026-09-10' })], [race({ status: 'upcoming', race_date: null })], []]) {
      expect(deriveOverview(overview(items), now).ready).toBe(false);
    }
  });
  it('offers setup only when no active season was successfully verified', () => {
    const data = overview([]); data.setup!.active_season = null; data.races!.seasons = []; data.roster!.season = null;
    const view = deriveOverview(data, now);
    expect(view.scopeKnown).toBe(true); expect(view.season).toBeNull(); expect(view.incomplete).toBe(false);
  });
});

describe('league ID access', () => {
  it('copies the complete league ID for join requests', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyLeagueIdToClipboard({ writeText }, snapshot.league.id)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('league-1');
  });

  it('keeps the league ID selectable when clipboard access is unavailable', async () => {
    await expect(copyLeagueIdToClipboard(undefined, snapshot.league.id)).resolves.toBe(false);
  });
});
