import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../i18n/I18nProvider';
import { BetaFeedback, feedbackPage } from './BetaFeedback';

beforeEach(() => {
  localStorage.setItem('racevora.locale', 'de');
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });
function setup(obscured = false) {
  return render(<I18nProvider><MemoryRouter initialEntries={['/racing/results?league=private#secret']}><BetaFeedback obscured={obscured} /></MemoryRouter></I18nProvider>);
}
function mockApi(status = 200) {
  return vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ready: true }))).mockResolvedValue(new Response(JSON.stringify(status === 200 ? { ok: true } : { error: 'failed' }), { status })));
}
async function open() { fireEvent.click(screen.getByRole('button', { name: 'Beta-Feedback geben' })); await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1)); }

describe('BetaFeedback', () => {
  it('starts closed and does not make background requests', () => {
    vi.stubGlobal('fetch', vi.fn()); setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Beta-Feedback geben' })).toBeVisible();
  });
  it('stays out of the mobile menu', () => {
    setup(true); expect(screen.queryByRole('button', { name: 'Beta-Feedback geben' })).not.toBeInTheDocument();
  });
  it('sends only entered data and the route, and shows success', async () => {
    mockApi(); setup(); await open();
    fireEvent.change(screen.getByLabelText('Deine Nachricht'), { target: { value: 'Bitte die Tabelle verbessern.' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Feedback senden' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Feedback senden' }));
    expect(await screen.findByText('Danke! Dein Feedback wurde versendet.')).toBeVisible();
    const call = vi.mocked(fetch).mock.calls[1];
    expect(JSON.parse(String(call[1]?.body))).toEqual({ kind: 'bug', message: 'Bitte die Tabelle verbessern.', email: '', page: '/racing/results', website: '' });
  });
  it.each([429, 502])('preserves the draft after HTTP %s', async (status) => {
    mockApi(status); setup(); await open();
    fireEvent.change(screen.getByLabelText('Deine Nachricht'), { target: { value: 'Mein Feedback bleibt erhalten.' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Feedback senden' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Feedback senden' }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getByLabelText('Deine Nachricht')).toHaveValue('Mein Feedback bleibt erhalten.');
  });
  it('keeps the draft on close and restores focus', async () => {
    mockApi(); setup(); await open();
    fireEvent.change(screen.getByLabelText('Deine Nachricht'), { target: { value: 'Noch nicht fertig.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.getByRole('button', { name: 'Beta-Feedback geben' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Beta-Feedback geben' }));
    expect(screen.getByLabelText('Deine Nachricht')).toHaveValue('Noch nicht fertig.');
  });
  it('does not pretend that an unconfigured mail service works', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ready: false }))));
    setup(); await open();
    expect(await screen.findByText(/Der Formularversand ist gerade nicht verfügbar/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Feedback senden' })).toBeDisabled();
  });
  it('removes query strings and fragments', () => expect(feedbackPage('/profile?token=private#auth')).toBe('/profile'));
});
