import { act, cleanup, render, screen } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { DriverIdentityProvider, useDriverIdentity } from './DriverIdentityProvider';

function Probe() {
  const { identity, loading } = useDriverIdentity();
  return <span data-testid="identity-state">{loading ? 'loading' : identity?.id ?? 'none'}</span>;
}

function createClient() {
  const identityResult = {
    data: { id: 'identity-1', profile_number: 27, status: 'active' },
    error: null,
  };
  const linksResult = { data: [{ driver_id: 'driver-1' }], error: null };
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => table === 'driver_identities'
        ? { maybeSingle: vi.fn().mockResolvedValue(identityResult) }
        : Promise.resolve(linksResult)),
    })),
  }));
  return { client: { from } as unknown as LeagueSupabaseClient, from };
}

describe('DriverIdentityProvider', () => {
  afterEach(cleanup);

  it('keeps the resolved identity when the same signed-in user object is refreshed', async () => {
    const { client, from } = createClient();
    const initialUser = { id: 'user-1', updated_at: '2026-08-28T10:00:00Z' } as User;
    const view = render(<DriverIdentityProvider client={client} user={initialUser}><Probe /></DriverIdentityProvider>);

    expect(screen.getByTestId('identity-state')).toHaveTextContent('loading');
    await act(async () => {});
    expect(screen.getByTestId('identity-state')).toHaveTextContent('identity-1');

    const refreshedUser = { ...initialUser, updated_at: '2026-08-28T10:05:00Z' } as User;
    view.rerender(<DriverIdentityProvider client={client} user={refreshedUser}><Probe /></DriverIdentityProvider>);

    expect(screen.getByTestId('identity-state')).toHaveTextContent('identity-1');
    expect(from).toHaveBeenCalledTimes(2);
  });
});
