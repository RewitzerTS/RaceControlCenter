import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemberDriverLink } from './MemberDriverLink';
import type { LeagueSupabaseClient } from '../lib/supabase';
import type { LeagueMember } from './operations';

const rpc = vi.fn();
const client = { rpc } as unknown as LeagueSupabaseClient;
const member: LeagueMember = { user_id: 'member-1', email: 'driver@example.test', role: 'driver', joined_at: '', identity_status: 'active', driver_id: null, driver_name: null };
const driver = { id: 'driver-1', display_name: 'RCC Fahrer', gamertag: 'Racer', number: 7, is_active: true };
const onLinked = vi.fn(async () => undefined);
beforeEach(() => { onLinked.mockReset(); rpc.mockReset(); rpc.mockImplementation(async (name) => ({ data: name === 'get_linkable_league_drivers' ? [driver] : {}, error: null })); });
afterEach(cleanup);
async function open() {
  render(<MemberDriverLink client={client} member={member} onLinked={onLinked} />);
  fireEvent.click(screen.getByRole('button', { name: 'Fahrer verknüpfen' }));
  return screen.findByLabelText('Bestehender Fahrer');
}
it('requires selection and explicit confirmation before linking the exact account and driver', async () => {
  const select = await open();
  expect(screen.queryByRole('button', { name: 'Verknüpfung bestätigen' })).toBeNull();
  fireEvent.change(select, { target: { value: driver.id } });
  expect(screen.getByText(/Du verknüpfst/)).toHaveTextContent(member.email);
  expect(rpc).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Verknüpfung bestätigen' }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('link_league_member_driver', { p_user_id: member.user_id, p_driver_id: driver.id }));
  expect(await screen.findByRole('status')).toHaveTextContent('Fahrer verknüpft');
  expect(onLinked).toHaveBeenCalledTimes(1);
});
it('never offers overwriting an existing link', () => {
  render(<MemberDriverLink client={client} member={{ ...member, driver_id: driver.id, driver_name: driver.display_name }} onLinked={onLinked} />);
  expect(screen.getByText(driver.display_name)).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
  expect(rpc).not.toHaveBeenCalled();
});
it('keeps a committed link successful even if the member refresh fails', async () => {
  onLinked.mockRejectedValueOnce(new Error('offline'));
  fireEvent.change(await open(), { target: { value: driver.id } });
  fireEvent.click(screen.getByRole('button', { name: 'Verknüpfung bestätigen' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Fahrer verknüpft');
  expect(screen.queryByRole('alert')).toBeNull();
});
it('explains conflicts and reloads the driver selection', async () => {
  fireEvent.change(await open(), { target: { value: driver.id } });
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'MEMBER_DRIVER_TAKEN' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verknüpfung bestätigen' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('anderen Konto');
  fireEvent.click(screen.getByRole('button', { name: 'Auswahl neu laden' }));
  await waitFor(() => expect(screen.getByLabelText('Bestehender Fahrer')).toHaveValue(''));
  expect(onLinked).not.toHaveBeenCalled();
});
it('offers retry for failed loading', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
  render(<MemberDriverLink client={client} member={member} onLinked={onLinked} />);
  fireEvent.click(screen.getByRole('button', { name: 'Fahrer verknüpfen' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Auswahl neu laden' }));
  expect(await screen.findByLabelText('Bestehender Fahrer')).toBeTruthy();
});
it('shows an empty selection without a save action', async () => {
  rpc.mockResolvedValueOnce({ data: [], error: null });
  render(<MemberDriverLink client={client} member={member} onLinked={onLinked} />);
  fireEvent.click(screen.getByRole('button', { name: 'Fahrer verknüpfen' }));
  expect(await screen.findByText(/Keine unverknüpften Fahrer/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Verknüpfung bestätigen' })).toBeNull();
});
it('cancels without writing and disables inactive accounts', async () => {
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
  expect(screen.getByRole('button', { name: 'Fahrer verknüpfen' })).toBeTruthy();
  expect(rpc).toHaveBeenCalledTimes(1);
  cleanup();
  render(<MemberDriverLink client={client} member={{ ...member, identity_status: 'suspended' }} onLinked={onLinked} />);
  expect(screen.getByRole('button', { name: 'Fahrer verknüpfen' })).toBeDisabled();
});
