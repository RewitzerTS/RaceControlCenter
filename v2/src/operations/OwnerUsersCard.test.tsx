import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OwnerUsersCard } from './OwnerUsersCard';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { I18nProvider } from '../i18n/I18nProvider';

const rpc = vi.fn();
const client = { rpc } as unknown as LeagueSupabaseClient;
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: { total: 1, users: [{ id: '1', name: '<script>Test</script>', email: 'test@example.invalid' }] }, error: null }); });
afterEach(cleanup);
async function open() {
  localStorage.setItem('racevora.locale', 'de');
  const { container } = render(<I18nProvider><OwnerUsersCard client={client} /></I18nProvider>);
  expect(rpc).not.toHaveBeenCalled();
  const details = container.querySelector('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  return details;
}
it('loads only on open and renders names as text, not markup', async () => {
  await open();
  expect(await screen.findByText('<script>Test</script>')).toBeVisible();
  expect(rpc).toHaveBeenCalledWith('get_owner_registered_users', { p_offset: 0 });
  expect(document.querySelector('script')).toBeNull();
});
it('offers retry without exposing error details or stale users', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'private database detail' } });
  await open();
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private database detail');
  fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
  expect(await screen.findByText('test@example.invalid')).toBeVisible();
});
it('loads the next page and handles missing names', async () => {
  rpc.mockResolvedValueOnce({ data: { total: 51, users: [{ id: '1', name: null, email: 'a@example.invalid' }] }, error: null });
  await open();
  expect(await screen.findByText('Noch kein Name hinterlegt')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
  await waitFor(() => expect(rpc).toHaveBeenLastCalledWith('get_owner_registered_users', { p_offset: 50 }));
  expect(await screen.findByText('test@example.invalid')).toBeVisible();
});
