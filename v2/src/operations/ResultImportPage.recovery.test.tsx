import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
const mocks = vi.hoisted(() => ({ create: vi.fn(), publish: vi.fn(), analyze: vi.fn(), drafts: [] as Array<Record<string, unknown>> }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../league/LeagueProvider', () => ({ useLeague: () => ({ client: {}, leagueSlug: 'qa' }) }));
vi.mock('../roles/RoleProvider', () => ({ useRole: () => ({ role: 'league_admin' }) }));
vi.mock('./imageResultImport', () => ({ prepareRaceResultImages: async () => [], analyzeRaceResultImages: mocks.analyze }));
vi.mock('./operations', () => ({
  loadRaceAdminWorkspace: async () => ({ seasons: [{ id: 'season', is_active: true }], races: [{ id: 'r1', season_id: 'season', round_number: 1, grand_prix_name: 'Monaco' }, { id: 'r2', season_id: 'season', round_number: 2, grand_prix_name: 'Spa' }] }),
  loadDriverAdminWorkspace: async () => ({ drivers: [{ id: 'carlos', display_name: 'Carlos Sainz', league_team: 'Williams', is_active: true }] }),
  loadConfigurationWorkspace: async () => ({ result_drafts: mocks.drafts }), createLeagueResultDraft: mocks.create, publishLeagueResultDraft: mocks.publish,
}));
import { ResultImportPage } from './ResultImportPage';
describe('sequential image imports', () => {
  it('saves a second OCR-variant import and reports missing assignments without trapping the user', async () => {
    localStorage.setItem('racevora.locale', 'de');
    mocks.create.mockImplementation(async () => { mocks.drafts = [{ id: 'draft', race_name: 'Monaco', version_number: 1, row_count: 1, status: 'draft' }]; });
    mocks.publish.mockImplementation(async () => { mocks.drafts = []; });
    const analysis = (driver: string) => ({ rows: [{ driver, position: 1, confidence: 0.5 }], warnings: ['Fahrer nicht sicher erkannt'] });
    mocks.analyze.mockResolvedValueOnce(analysis('Carlos Sainz')).mockResolvedValueOnce(analysis('Carlos Sain2')).mockResolvedValueOnce(analysis('Unknown Racer'));
    render(<MemoryRouter><I18nProvider><ResultImportPage/></I18nProvider></MemoryRouter>);
    await screen.findByText('Monaco', { exact: false });
    const race = screen.getAllByRole('combobox')[0];
    const fileInput = document.querySelector('input[type=file]')!;
    const save = () => screen.getByRole('button', { name: 'Entwurf speichern' });
    async function analyze(raceId: string) {
      fireEvent.change(race, { target: { value: raceId } });
      fireEvent.change(fileInput, { target: { files: [new File(['image'], 'result.png', { type: 'image/png' })] } });
      fireEvent.click(screen.getByRole('button', { name: 'Bilder auslesen' }));
      await screen.findByText('Fahrer nicht sicher erkannt');
    }
    await analyze('r1'); fireEvent.click(save());
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(save()).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt offiziell freigeben' }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(save()).not.toBeDisabled());
    await analyze('r2'); await waitFor(() => expect(save()).not.toBeDisabled()); fireEvent.click(save());
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[1][1]).toBe('r2');
    expect(mocks.create.mock.calls[1][2][0].driver_id).toBe('carlos');
    await waitFor(() => expect(save()).not.toBeDisabled());
    await analyze('r2'); await waitFor(() => expect(save()).toBeDisabled());
    expect(document.getElementById('result-save-blocker')?.textContent).toContain('Unknown Racer');
    fireEvent.change(screen.getByLabelText('Fahrer Zeile 1'), { target: { value: 'carlos' } });
    expect(save()).not.toBeDisabled();
  });
});
