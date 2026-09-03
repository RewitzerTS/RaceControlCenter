import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RosterWorkflowPanel } from './RosterWorkflowPanel';
import { isHumanDriver, vehicleChangeRounds, type RosterWorkspace } from './roster';
import type { DriverAdminWorkspace } from './operations';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
const client = { rpc };
vi.mock('../league/LeagueProvider', () => ({ useLeague: () => ({ client }) }));
vi.mock('../i18n/I18nProvider', () => ({ useI18n: () => ({ language: 'de' }) }));
const drivers = {
  drivers: [
    { id: 'human', display_name: 'Stammfahrer', ai_driver_reference: 'Lance Stroll', league_team: 'Team Alt', car_name: 'Auto Alt' },
    { id: 'sub', display_name: 'Ersatzperson', ai_driver_reference: null },
    { id: 'ai', display_name: 'Computerfahrer', ai_driver_reference: 'f1_25:mercedes-one' },
  ],
  ai_drivers: [{ id: 'ai', display_name: 'Computerfahrer', league_team: 'Team Neu', car_name: 'Auto Neu' }],
} as DriverAdminWorkspace;
const workspace: RosterWorkspace = {
  season_id: 'season', substitutions: [], vehicles: [],
  races: [{ id: 'r1', round: 1, name: 'Abgeschlossen', locked: true }, { id: 'r2', round: 2, name: 'Monza', locked: false }],
};
describe('roster workflow', () => {
  afterEach(cleanup);
  beforeEach(() => { rpc.mockReset(); rpc.mockImplementation(async (name: string) => ({ data: name === 'get_league_roster_workspace' ? workspace : { id: 'saved' }, error: null })); });
  it('keeps legacy named profiles human without offering dedicated AI substitutes', async () => {
    expect(isHumanDriver({ ai_driver_reference: 'Lance Stroll' })).toBe(true);
    expect(isHumanDriver({ ai_driver_reference: 'f1_25:mercedes-one' })).toBe(false);
    render(<RosterWorkflowPanel drivers={drivers} onSaved={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Rennen'), { target: { value: 'r2' } });
    fireEvent.change(screen.getByLabelText(/Vertretener Fahrer/), { target: { value: 'human' } });
    expect(screen.queryByRole('option', { name: 'Computerfahrer' })).toBeNull();
    fireEvent.change(screen.getByLabelText(/Ersatzfahrer ·/), { target: { value: 'sub' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ersatzfahrer speichern' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('set_race_substitution', { p_race_id: 'r2', p_primary_driver_id: 'human', p_substitute_driver_id: 'sub' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Änderung gespeichert');
  });
  it('disables substitution editing for a completed race', async () => {
    render(<RosterWorkflowPanel drivers={drivers} onSaved={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Rennen'), { target: { value: 'r1' } });
    expect(screen.getByLabelText(/Vertretener Fahrer/)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ersatzfahrer speichern' })).toBeDisabled();
    expect(screen.getByText(/Gesperrt: Rennen/)).toBeTruthy();
  });
  it('saves a future vehicle with explicit round and seat and no historical rounds', async () => {
    render(<RosterWorkflowPanel drivers={drivers} onSaved={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fahrzeug wechseln' }));
    fireEvent.change(screen.getByLabelText('Fahrer'), { target: { value: 'human' } });
    fireEvent.change(screen.getByLabelText('Gültig ab Rennen'), { target: { value: '2' } });
    expect(screen.queryByRole('option', { name: /Abgeschlossen/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Neues Fahrzeug / F1-Sitz'), { target: { value: 'ai' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fahrzeugwechsel speichern' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('change_season_vehicle', { p_driver_id: 'human', p_effective_from_round: 2, p_team_name: 'Team Neu', p_car_name: 'Auto Neu', p_ai_driver_id: 'ai' }));
  });
  it('keeps user input and explains a concurrent result lock', async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === 'get_league_roster_workspace' ? workspace : null, error: name === 'set_race_substitution' ? { message: 'ROSTER_RACE_LOCKED' } : null }));
    render(<RosterWorkflowPanel drivers={drivers} onSaved={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Rennen'), { target: { value: 'r2' } });
    fireEvent.change(screen.getByLabelText(/Vertretener Fahrer/), { target: { value: 'human' } });
    fireEvent.change(screen.getByLabelText(/Ersatzfahrer ·/), { target: { value: 'sub' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ersatzfahrer speichern' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('bereits ein Ergebnis');
    expect(screen.getByLabelText(/Ersatzfahrer ·/)).toHaveValue('sub');
  });
  it('does not offer gaps before an already locked later race for vehicle changes', () => {
    expect(vehicleChangeRounds([{ id: '1', round: 1, name: '', locked: false }, { id: '2', round: 2, name: '', locked: true }, { id: '3', round: 3, name: '', locked: false }]).map((race) => race.round)).toEqual([3]);
  });
});
