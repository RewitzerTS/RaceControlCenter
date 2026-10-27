import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../i18n/I18nProvider';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { confirmationCopy, hasConfirmedPublicName, isNameConfirmationExempt, PublicNameConfirmation, PublicNameGate } from './PublicNameGate';

const context = vi.hoisted(() => ({ auth: { user: null as null | { id: string }, loading: false, signOut: vi.fn() }, client: null as unknown }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => context.auth }));
vi.mock('../league/LeagueProvider', () => ({ useLeague: () => ({ client: context.client }) }));
afterEach(() => { cleanup(); localStorage.clear(); context.auth.user = null; context.auth.loading = false; });
const required = { name: 'Richard', gamertag: 'Racer', public_name_mode: null, needs_confirmation: true, revision: 'initial' };
const confirmed = { ...required, public_name_mode: 'gamertag', needs_confirmation: false };
function fixture(value: unknown = required) {
  localStorage.setItem('racevora.locale', 'de');
  const rpc = vi.fn().mockResolvedValue({ data: value, error: null });
  const refreshSession = vi.fn().mockRejectedValue(new Error('Temporary refresh failure'));
  const client = { rpc, auth: { refreshSession } } as unknown as LeagueSupabaseClient;
  const signOut = vi.fn().mockResolvedValue(undefined);
  const view = (current = client) => <MemoryRouter><I18nProvider><PublicNameConfirmation client={current} signOut={signOut}><div>Application</div></PublicNameConfirmation></I18nProvider></MemoryRouter>;
  return { rpc, client, signOut, view };
}

describe('one-time public name confirmation', () => {
  it('requires a complete server confirmation and keeps recovery/setup routes reachable', () => {
    expect(hasConfirmedPublicName(confirmed as never)).toBe(true);
    for (const state of [null, required, { ...confirmed, public_name_mode: null }, { ...confirmed, name: '' }]) expect(hasConfirmedPublicName(state as never)).toBe(false);
    for (const path of ['/auth/reset', '/auth/confirm', '/onboarding/', '/login', '/datenschutz.html']) expect(isNameConfirmationExempt(path)).toBe(true);
    for (const path of ['/home', '/profile', '/admin', '/racing/calendar', '/onboarding/other']) expect(isNameConfirmationExempt(path)).toBe(false);
    for (const copy of Object.values(confirmationCopy)) expect(Object.keys(copy)).toEqual(Object.keys(confirmationCopy.de));
  });
  it('does not mount the app while checking and passes an already confirmed account', async () => {
    const f = fixture(confirmed); render(f.view());
    expect(screen.queryByText('Application')).not.toBeInTheDocument();
    expect(await screen.findByText('Application')).toBeInTheDocument();
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith('get_my_name_settings');
  });
  it('requires an explicit selection, saves to the server and releases despite failed session refresh', async () => {
    const f = fixture(); render(f.view());
    const select = await screen.findByRole('combobox');
    expect(select).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Speichern und weiter' })).toBeDisabled();
    fireEvent.change(select, { target: { value: 'gamertag' } });
    f.rpc.mockResolvedValue({ data: confirmed, error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern und weiter' }));
    expect(await screen.findByText('Application')).toBeInTheDocument();
    expect(f.rpc).toHaveBeenLastCalledWith('save_my_name_settings', { p_name: 'Richard', p_public_name_mode: 'gamertag', p_revision: 'initial' });
  });
  it('stays gated on malformed or failed checks and can retry', async () => {
    const f = fixture({}); render(f.view());
    expect(await screen.findByRole('alert')).toHaveTextContent('nicht geladen');
    expect(screen.queryByText('Application')).not.toBeInTheDocument();
    f.rpc.mockResolvedValue({ data: confirmed, error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));
    expect(await screen.findByText('Application')).toBeInTheDocument();
  });
  it('preserves a stale draft and only releases after a fresh server-confirmed check', async () => {
    const f = fixture(); render(f.view());
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'name' } });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Richi' } });
    f.rpc.mockResolvedValue({ data: null, error: { message: 'NAME_SETTINGS_STALE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern und weiter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('inzwischen geändert');
    expect(screen.getByRole('textbox')).toHaveValue('Richi');
    expect(screen.getByRole('button', { name: 'Speichern und weiter' })).toBeDisabled();
    expect(screen.queryByText('Application')).not.toBeInTheDocument();
    f.rpc.mockResolvedValue({ data: confirmed, error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));
    expect(await screen.findByText('Application')).toBeInTheDocument();
  });
  it('offers setup and logout when identity is missing, without releasing the app', async () => {
    const f = fixture(null); render(f.view());
    expect(await screen.findByRole('link', { name: 'Fahrerprofil einrichten' })).toHaveAttribute('href', '/onboarding');
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    await waitFor(() => expect(f.signOut).toHaveBeenCalledOnce());
    expect(screen.queryByText('Application')).not.toBeInTheDocument();
  });
  it('never carries one accounts confirmation into the next account', async () => {
    const f = fixture(confirmed); context.client = f.client; context.auth.user = { id: 'first' };
    const view = () => <MemoryRouter initialEntries={['/home']}><I18nProvider><PublicNameGate>Application</PublicNameGate></I18nProvider></MemoryRouter>;
    const rendered = render(view()); expect(await screen.findByText('Application')).toBeInTheDocument();
    context.auth.user = { id: 'second' }; f.rpc.mockResolvedValue({ data: required, error: null }); rendered.rerender(view());
    expect(screen.queryByText('Application')).not.toBeInTheDocument();
    expect(await screen.findByRole('combobox')).toHaveValue('');
  });
  it('does not intercept anonymous visits or password recovery', () => {
    const f = fixture(); context.client = f.client;
    const view = (path: string) => <MemoryRouter initialEntries={[path]}><I18nProvider><PublicNameGate>Application</PublicNameGate></I18nProvider></MemoryRouter>;
    render(view('/home')); expect(screen.getByText('Application')).toBeInTheDocument(); expect(f.rpc).not.toHaveBeenCalled(); cleanup();
    context.auth.user = { id: 'first' }; render(view('/auth/reset')); expect(screen.getByText('Application')).toBeInTheDocument(); expect(f.rpc).not.toHaveBeenCalled();
  });
});
