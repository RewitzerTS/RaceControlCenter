import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeasonSetupPage, shuffledTracks, generateRaceDates } from './SeasonSetupPage';

vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'season-tester' } }) }));
const loadSeasonSetupWorkspace = vi.fn();
const loadTeamDirectory = vi.fn();
const leagueClient = vi.hoisted(() => ({}));

vi.mock('../league/LeagueProvider', () => ({
  useLeague: () => ({ client: leagueClient }),
}));

vi.mock('./operations', async (importOriginal) => ({
  ...await importOriginal<typeof import('./operations')>(),
  loadSeasonSetupWorkspace: (...args: unknown[]) => loadSeasonSetupWorkspace(...args),
}));
vi.mock('./leagueTeams', async (importOriginal) => ({
  ...await importOriginal<typeof import('./leagueTeams')>(),
  loadTeamDirectory: (...args: unknown[]) => loadTeamDirectory(...args),
}));

describe('SeasonSetupPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    loadTeamDirectory.mockResolvedValue({ teams: [], profiles: [], preferences: [] });
    sessionStorage.clear();
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() });
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
        fastest_lap_bonus_enabled: true,
        fastest_lap_bonus_points: 1,
        fastest_lap_bonus_max_finish_position: 10,
        calendar_can_configure: true,
        calendar: [
          { track_key: 'bahrain', date: '2026-03-01', time: '20:00', weather: 'klar', has_sprint: false },
          { track_key: 'belgium', date: '2026-03-08', time: '20:00', weather: 'regen', has_sprint: true },
        ],
      },
    });
  });

  it('shows and edits the complete calendar in one table', async () => {
    render(<MemoryRouter><SeasonSetupPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Rennkalender planen' })).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getAllByLabelText(/Datum Rennen/)).toHaveLength(2);
    expect((screen.getByLabelText('Strecke Rennen 2') as HTMLSelectElement).value).toBe('belgium');
    expect(screen.queryByLabelText('Rennen auswählen')).toBeNull();
  });

  it('can regenerate the tracks in a random order', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<MemoryRouter><SeasonSetupPage /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Rennkalender planen' });
    fireEvent.click(screen.getByRole('radio', { name: /Zufällige Reihenfolge/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Kalender erstellen / neu mischen' }));

    expect((screen.getByLabelText('Strecke Rennen 1') as HTMLSelectElement).value).toBe('belgium');
    expect((screen.getByLabelText('Strecke Rennen 2') as HTMLSelectElement).value).toBe('bahrain');
    random.mockRestore();
  });

  it('offers exactly the requested weather modes and explains the fastest-lap rule', async () => {
    render(<MemoryRouter><SeasonSetupPage /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Rennkalender planen' });
    const weather = screen.getByLabelText('Wettervorgabe') as HTMLSelectElement;
    expect([...weather.options].map((option) => option.textContent)).toEqual(['Wechselhaft', 'Trocken', 'Regen']);
    expect(screen.getByRole('radio', { name: /Ja, \+1 Punkt/ })).toBeChecked();
    expect(screen.getByText(/schnellsten Runde und einer Platzierung von P10 oder besser/)).toBeTruthy();
  });

  it('updates the calendar table immediately when the race count changes', async () => {
    render(<MemoryRouter><SeasonSetupPage /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Rennkalender planen' });
    fireEvent.change(screen.getByLabelText(/Anzahl Rennen/), { target: { value: '1' } });
    expect(screen.getAllByLabelText(/Strecke Rennen/)).toHaveLength(1);

    fireEvent.change(screen.getByLabelText(/Anzahl Rennen/), { target: { value: '2' } });
    expect(screen.getAllByLabelText(/Strecke Rennen/)).toHaveLength(2);
  });

  it('includes the selected fastest-lap rule in the final review', async () => {
    render(<MemoryRouter><SeasonSetupPage /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Rennkalender planen' });
    fireEvent.click(screen.getByRole('radio', { name: /^Nein/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Kalender prüfen' }));

    expect(await screen.findByRole('heading', { name: 'Kalender prüfen und speichern' })).toBeTruthy();
    expect(screen.getByText('Kein Extra-Punkt')).toBeTruthy();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
  });
});

describe('shuffledTracks', () => {
  it('schedules two races on each Monday without advancing the date between them', () => {
    expect(generateRaceDates(5, '2026-09-28', [1], 2)).toEqual(['2026-09-28', '2026-09-28', '2026-10-05', '2026-10-05', '2026-10-12']);
  });
  it('supports multiple weekdays and defaults to one race per day', () => {
    expect(generateRaceDates(5, '2026-09-29', [1, 3], 2)).toEqual(['2026-09-30', '2026-09-30', '2026-10-05', '2026-10-05', '2026-10-07']);
    expect(generateRaceDates(2, '2026-09-28', [1])).toEqual(['2026-09-28', '2026-10-05']);
  });
  it('uses Fisher-Yates without mutating the preset order', () => {
    const tracks = ['a', 'b', 'c'];

    expect(shuffledTracks(tracks, () => 0)).toEqual(['b', 'c', 'a']);
    expect(tracks).toEqual(['a', 'b', 'c']);
  });
});
