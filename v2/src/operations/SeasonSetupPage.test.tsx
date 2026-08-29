import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeasonSetupPage } from './SeasonSetupPage';

const loadSeasonSetupWorkspace = vi.fn();

vi.mock('../league/LeagueProvider', () => ({
  useLeague: () => ({ client: {} }),
}));

vi.mock('./operations', async (importOriginal) => ({
  ...await importOriginal<typeof import('./operations')>(),
  loadSeasonSetupWorkspace: (...args: unknown[]) => loadSeasonSetupWorkspace(...args),
}));

describe('SeasonSetupPage', () => {
  beforeEach(() => {
    loadSeasonSetupWorkspace.mockResolvedValue({
      league: { id: 'league-1', name: 'Testliga', slug: 'testliga', status: 'active' },
      games: [{
        key: 'f1_25',
        label: 'F1 25',
        roster: [],
        tracks: [
          { key: 'bahrain', grand_prix_name: 'Bahrain GP', circuit_name: 'Sakhir', country_code: 'BH' },
          { key: 'belgium', grand_prix_name: 'Belgien GP', circuit_name: 'Spa', country_code: 'BE' },
        ],
      }],
      active_season: {
        id: 'season-1',
        name: 'Saison 2026',
        slug: 'saison-2026',
        game_key: 'f1_25',
        game_label: 'F1 25',
        start_date: '2026-03-01',
        end_date: null,
        calendar_can_configure: true,
        calendar: [
          { track_key: 'bahrain', date: '2026-03-01', time: '20:00', weather: 'klar', has_sprint: false },
          { track_key: 'belgium', date: '2026-03-08', time: '20:00', weather: 'regen', has_sprint: true },
        ],
      },
    });
  });

  it('edits one selected race at a time while retaining the full calendar', async () => {
    render(<MemoryRouter><SeasonSetupPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Rennkalender planen' })).toBeTruthy();
    expect(screen.getAllByLabelText('Datum')).toHaveLength(1);

    const roundSelect = screen.getByLabelText('Rennen auswählen');
    expect(roundSelect.querySelectorAll('option')).toHaveLength(2);
    fireEvent.change(roundSelect, { target: { value: '1' } });

    expect((screen.getByLabelText('Strecke') as HTMLSelectElement).value).toBe('belgium');
    expect(screen.getByText('Rennen 2 von 2')).toBeTruthy();
  });
});
