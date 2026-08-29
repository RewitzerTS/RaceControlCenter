import { describe, expect, it } from 'vitest';
import type { AdminSnapshot, LeagueRace, RaceAdminWorkspace, SeasonCalendarEntry, SeasonSetupWorkspace } from './operations';
import { selectAdminNextAction } from './AdminWorkspacePage';

const snapshot: AdminSnapshot = {
  counts: { failed_jobs: 0, open_steward_cases: 0, pending_jobs: 0, races: 0 },
  league: { id: 'league-1', name: 'Test League', slug: 'test-league', status: 'active' },
  recent_audit: [],
};

function setup(calendar: SeasonCalendarEntry[]): SeasonSetupWorkspace {
  return {
    active_season: { calendar, calendar_can_configure: true, end_date: null, game_key: 'f1_25', game_label: 'F1 25', id: 'season-1', name: 'Season 1', slug: 'season-1', start_date: null },
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

describe('admin next action', () => {
  it('starts with season setup when no season is active', () => {
    expect(selectAdminNextAction(snapshot, { active_season: null, games: [], league: snapshot.league }, null).to).toBe('/admin/season/setup');
  });

  it('prioritizes open steward cases after the calendar exists', () => {
    const withCases = { ...snapshot, counts: { ...snapshot.counts, open_steward_cases: 2 } };
    expect(selectAdminNextAction(withCases, setup([{ date: '2026-09-10', has_sprint: false, time: '20:00', track_key: 'spa', weather: 'dynamisch' }]), races([race({ race_date: '2026-09-10', status: 'upcoming' })]), new Date(2026, 7, 29)).to).toBe('/stewarding');
  });

  it('points to result import once a race day has arrived', () => {
    expect(selectAdminNextAction(snapshot, setup([{ date: '2026-08-29', has_sprint: false, time: '20:00', track_key: 'spa', weather: 'klar' }]), races([race()]), new Date(2026, 7, 29)).to).toBe('/admin/results/import');
  });

  it('points to race planning before the first race', () => {
    expect(selectAdminNextAction(snapshot, setup([{ date: '2026-09-10', has_sprint: false, time: '20:00', track_key: 'spa', weather: 'regen' }]), races([race({ race_date: '2026-09-10', status: 'upcoming' })]), new Date(2026, 7, 29)).to).toBe('/admin/races');
  });

  it('offers season completion after every race has an official result', () => {
    const action = selectAdminNextAction(snapshot, setup([{ date: '2026-08-29', has_sprint: false, time: '20:00', track_key: 'spa', weather: 'klar' }]), races([race({ result_status: 'active' })]), new Date(2026, 7, 30));
    expect(action.titleKey).toBe('admin.nextCompleteTitle');
  });
});
