import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { ResultImportPage, resultScoringRulesForRace } from './ResultImportPage';

const loadRaceAdminWorkspace = vi.fn();
const loadDriverAdminWorkspace = vi.fn();
const loadConfigurationWorkspace = vi.fn();

vi.mock('../league/LeagueProvider', () => ({
  useLeague: () => ({ client: {}, leagueSlug: 'testliga' }),
}));

vi.mock('../roles/RoleProvider', () => ({
  useRole: () => ({ role: 'league_admin' }),
}));

vi.mock('./operations', async (importOriginal) => ({
  ...await importOriginal<typeof import('./operations')>(),
  loadRaceAdminWorkspace: (...args: unknown[]) => loadRaceAdminWorkspace(...args),
  loadDriverAdminWorkspace: (...args: unknown[]) => loadDriverAdminWorkspace(...args),
  loadConfigurationWorkspace: (...args: unknown[]) => loadConfigurationWorkspace(...args),
}));

describe('ResultImportPage', () => {
  beforeEach(() => {
    globalThis.localStorage.setItem('racevora.locale', 'de');
    const league = { id: 'league-1', name: 'Testliga', slug: 'testliga', status: 'active' };
    loadRaceAdminWorkspace.mockResolvedValue({
      league,
      seasons: [{ id: 'season-1', name: 'Saison 2026', slug: 'saison-2026', is_active: true, game_label: 'F1 25', start_date: null, end_date: null }],
      races: [],
      driver_standings: [],
      team_standings: [],
    });
    loadDriverAdminWorkspace.mockResolvedValue({ league, counts: { total: 0, active: 0, linked: 0 }, drivers: [] });
    loadConfigurationWorkspace.mockResolvedValue({ league, rules: {}, faqs: [], audit: [], result_drafts: [] });
  });

  it('shows only the selected import method', async () => {
    render(<I18nProvider><MemoryRouter><ResultImportPage /></MemoryRouter></I18nProvider>);

    expect(await screen.findByRole('heading', { name: 'Ergebnisbilder auswählen' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /Änderungsgrund/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'CSV-Datei auswählen' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'CSV-Daten prüfen' })).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: /CSV-Datei/ }));

    expect(screen.getByRole('heading', { name: 'CSV-Datei auswählen' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ergebnisbilder auswählen' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'CSV-Daten prüfen' })).toBeTruthy();
  });

  it('uses the selected race season rule for automatic points in every league', () => {
    expect(resultScoringRulesForRace({
      league: { id: 'league-1', name: 'Testliga', slug: 'testliga', status: 'active' },
      scoring_points: [10, 6, 4],
      seasons: [{ id: 'season-1', name: 'Saison', slug: 'saison', is_active: true, game_label: 'F1 25', start_date: null, end_date: null, fastest_lap_bonus_enabled: true, fastest_lap_bonus_points: 1, fastest_lap_bonus_max_finish_position: 10 }],
      races: [{ id: 'race-1', season_id: 'season-1', season_name: 'Saison', round_number: 1, grand_prix_name: 'Test GP', circuit_name: null, country_code: null, race_date: null, race_start_at: null, status: 'upcoming', has_sprint: false, result_count: 0, result_version: null, result_status: null, result_activated_at: null }],
      driver_standings: [],
      team_standings: [],
    }, 'race-1')).toEqual({
      points: [10, 6, 4],
      fastestLapBonusEnabled: true,
      fastestLapBonusPoints: 1,
      fastestLapBonusMaxFinishPosition: 10,
    });
  });
});
