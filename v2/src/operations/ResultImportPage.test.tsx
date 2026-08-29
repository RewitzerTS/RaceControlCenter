import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { ResultImportPage } from './ResultImportPage';

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
    expect(screen.queryByRole('heading', { name: 'CSV-Datei auswählen' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'CSV-Daten prüfen' })).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: /CSV-Datei/ }));

    expect(screen.getByRole('heading', { name: 'CSV-Datei auswählen' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ergebnisbilder auswählen' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'CSV-Daten prüfen' })).toBeTruthy();
  });
});
