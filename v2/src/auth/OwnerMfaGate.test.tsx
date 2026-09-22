import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { I18nProvider } from '../i18n/I18nProvider';
import { OwnerMfaGate, OwnerMfaSession, parseOwnerMfaStatus } from './OwnerMfaGate';

const auth = vi.hoisted(() => ({ loading: false, user: null as null | { id: string }, session: null, signOut: vi.fn() }));
vi.mock('./AuthProvider', () => ({ useAuth: () => auth }));
afterEach(() => { cleanup(); localStorage.clear(); auth.user = null; auth.loading = false; });
const verified = { id: 'verified-factor', status: 'verified', factor_type: 'totp', friendly_name: 'My phone' };
function fixture(status: unknown = { is_owner: true, verified: false }, factors: unknown[] = []) {
  const mfa = {
    listFactors: vi.fn().mockResolvedValue({ data: { totp: factors, all: factors }, error: null }),
    enroll: vi.fn().mockResolvedValue({ data: { id: 'new-factor', totp: { qr_code: 'data:image/svg+xml,SYNTHETIC', secret: 'SYNTHETIC-TEST-ONLY' } }, error: null }),
    unenroll: vi.fn().mockResolvedValue({ error: null }),
    challengeAndVerify: vi.fn().mockResolvedValue({ data: {}, error: null }),
  };
  const rpc = vi.fn().mockResolvedValue({ data: status, error: null });
  const client = { rpc, auth: { mfa } } as unknown as LeagueSupabaseClient;
  const signOut = vi.fn().mockResolvedValue(undefined);
  localStorage.setItem('racevora.locale', 'de');
  const view = (token = 'token-a') => <I18nProvider><OwnerMfaSession client={client} token={token} signOut={signOut}><div>Protected content</div></OwnerMfaSession></I18nProvider>;
  return { mfa, rpc, client, signOut, view };
}
describe('owner MFA fail-closed boundary', () => {
  it.each([null, {}, { is_owner: 'true', verified: true }, { is_owner: false, verified: true }])('rejects malformed server status %j', (value) => {
    expect(() => parseOwnerMfaStatus(value)).toThrow();
  });
  it('leaves anonymous users outside the MFA gate without a database request', () => {
    const f = fixture();
    render(<I18nProvider><OwnerMfaGate client={f.client}>Public content</OwnerMfaGate></I18nProvider>);
    expect(screen.getByText('Public content')).toBeInTheDocument();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each([{ is_owner: false, verified: false }, { is_owner: true, verified: true }])('passes only server-approved sessions %j', async (status) => {
    const f = fixture(status);
    render(f.view());
    expect(await screen.findByText('Protected content')).toBeInTheDocument();
    expect(f.mfa.listFactors).not.toHaveBeenCalled();
  });
  it('never enrolls automatically, including StrictMode', async () => {
    const f = fixture();
    render(<StrictMode>{f.view()}</StrictMode>);
    expect(await screen.findByRole('button', { name: 'Authenticator einrichten' })).toBeEnabled();
    expect(f.mfa.enroll).not.toHaveBeenCalled();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
  it('keeps access closed on failed checks and allows retry', async () => {
    const f = fixture();
    f.rpc.mockRejectedValueOnce(new Error('Do not expose internal details'));
    render(f.view());
    expect(await screen.findByRole('alert')).toHaveTextContent('Sicherheitsprüfung');
    expect(screen.queryByText(/internal details/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut prüfen' }));
    expect(await screen.findByRole('button', { name: 'Authenticator einrichten' })).toBeEnabled();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
  it('cleans only its own unverified setup and requires backup acknowledgement', async () => {
    const f = fixture(undefined, [
      { id: 'old', factor_type: 'totp', status: 'unverified', friendly_name: 'RaceVora Owner' },
      { id: 'other', factor_type: 'totp', status: 'unverified', friendly_name: 'Other' },
    ]);
    render(f.view());
    fireEvent.click(await screen.findByRole('button', { name: 'Authenticator einrichten' }));
    expect(await screen.findByAltText('Privater QR-Code für die Authenticator-Einrichtung')).toBeInTheDocument();
    expect(f.mfa.unenroll).toHaveBeenCalledExactlyOnceWith({ factorId: 'old' });
    expect(f.mfa.enroll).toHaveBeenCalledTimes(1);
    expect(f.mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'RaceVora Owner', issuer: 'RaceVora Staging' });
    expect(screen.getByRole('button', { name: 'Code bestätigen' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Code bestätigen' })).toBeEnabled();
    expect(localStorage.getItem('racevora.locale')).toBe('de');
    expect(JSON.stringify(localStorage)).not.toContain('SYNTHETIC-TEST-ONLY');
  });
  it('rejects bad code format without making a verification request', async () => {
    const f = fixture(undefined, [verified]);
    render(f.view());
    fireEvent.change(await screen.findByLabelText('Authenticator-Code'), { target: { value: '12abcd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Code bestätigen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('sechsstelligen');
    expect(f.mfa.challengeAndVerify).not.toHaveBeenCalled();
  });
  it('keeps wrong codes locked without revealing server details', async () => {
    const f = fixture(undefined, [verified]);
    f.mfa.challengeAndVerify.mockResolvedValue({ error: new Error('SECRET-DETAILS'), data: {} });
    render(f.view());
    fireEvent.change(await screen.findByLabelText('Authenticator-Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Code bestätigen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Code konnte nicht');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.queryByText(/SECRET-DETAILS/)).not.toBeInTheDocument();
  });
  it('rechecks the server after successful verification rather than trusting the client', async () => {
    const f = fixture(undefined, [verified]);
    render(f.view());
    fireEvent.change(await screen.findByLabelText('Authenticator-Code'), { target: { value: '123 456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Code bestätigen' }));
    await waitFor(() => expect(f.rpc).toHaveBeenCalledTimes(2));
    expect(f.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'verified-factor', code: '123456' });
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
  it('unlocks after a fresh approved server response', async () => {
    const f = fixture(undefined, [verified]);
    render(f.view());
    fireEvent.change(await screen.findByLabelText('Authenticator-Code'), { target: { value: '123456' } });
    f.rpc.mockResolvedValue({ data: { is_owner: true, verified: true }, error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Code bestätigen' }));
    expect(await screen.findByText('Protected content')).toBeInTheDocument();
  });
  it('does not reuse an allowed response for a different token', async () => {
    const f = fixture({ is_owner: true, verified: true });
    const view = render(f.view());
    await screen.findByText('Protected content');
    f.rpc.mockImplementation(() => new Promise(() => {}));
    view.rerender(f.view('token-b'));
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('geprüft');
  });
  it('supports switching between verified authenticators', async () => {
    const f = fixture(undefined, [verified, { ...verified, id: 'backup', friendly_name: 'Backup phone' }]);
    render(f.view());
    fireEvent.change(await screen.findByLabelText('Authenticator auswählen'), { target: { value: 'backup' } });
    fireEvent.change(screen.getByLabelText('Authenticator-Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Code bestätigen' }));
    await waitFor(() => expect(f.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'backup', code: '123456' }));
    expect(f.mfa.unenroll).not.toHaveBeenCalled();
  });
});
