import { act, cleanup, render, screen } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { DriverIdentityProvider, useDriverIdentity } from './DriverIdentityProvider';

function Probe() {
  const { identity, loading } = useDriverIdentity();
  return <span data-testid="identity-state">{loading ? 'loading' : `${identity?.id ?? 'none'}:${identity?.driverId ?? 'unlinked'}`}</span>;
}

function createClient(missingInitially = false) {
  const identityResult = {
    data: { id: 'identity-1', profile_number: 27, status: 'active' },
    error: null,
  };
  const leagueResults = {
    rcc: { data: { id: 'league-rcc' }, error: null },
    rummelracer: { data: { id: 'league-rummelracer' }, error: null },
  };
  const linksByLeague = {
    'league-rcc': { data: [{ driver_id: 'driver-rcc' }], error: null },
    'league-rummelracer': { data: [{ driver_id: 'driver-rummelracer' }], error: null },
  };
  let identityReads = 0;
  const rpc = vi.fn().mockResolvedValue({ data: { identity_id: 'identity-1', racevora_id: 'RV-100001', step: 1, profile_complete: false }, error: null });
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => {
      if (table === 'driver_identities') {
        return { eq: vi.fn(() => ({ maybeSingle: vi.fn().mockImplementation(async () => (++identityReads === 1 && missingInitially) ? { data: null, error: null } : identityResult) })) };
      }
      if (table === 'leagues') {
        return {
          eq: vi.fn((_column: string, slug: keyof typeof leagueResults) => ({
            maybeSingle: vi.fn().mockResolvedValue(leagueResults[slug]),
          })),
        };
      }
      return {
        eq: vi.fn(() => ({
          eq: vi.fn((_column: string, leagueId: keyof typeof linksByLeague) => Promise.resolve(linksByLeague[leagueId])),
        })),
      };
    }),
  }));
  return { client: { from, rpc } as unknown as LeagueSupabaseClient, from, rpc };
}

describe('DriverIdentityProvider', () => {
  afterEach(cleanup);

  it('provisions a missing identity once and reads the verified record again', async () => {
    const { client, rpc } = createClient(true);
    render(<DriverIdentityProvider client={client} leagueSlug="rcc" user={{ id: 'new-user' } as User}><Probe /></DriverIdentityProvider>);
    await act(async () => {});
    expect(rpc).toHaveBeenCalledExactlyOnceWith('get_my_entry_state');
    expect(screen.getByTestId('identity-state')).toHaveTextContent('identity-1:driver-rcc');
  });

  it('keeps the resolved identity when the same signed-in user object is refreshed', async () => {
    const { client, from } = createClient();
    const initialUser = { id: 'user-1', updated_at: '2026-08-28T10:00:00Z' } as User;
    const view = render(<DriverIdentityProvider client={client} leagueSlug="rcc" user={initialUser}><Probe /></DriverIdentityProvider>);

    expect(screen.getByTestId('identity-state')).toHaveTextContent('loading');
    await act(async () => {});
    expect(screen.getByTestId('identity-state')).toHaveTextContent('identity-1:driver-rcc');

    const refreshedUser = { ...initialUser, updated_at: '2026-08-28T10:05:00Z' } as User;
    view.rerender(<DriverIdentityProvider client={client} leagueSlug="rcc" user={refreshedUser}><Probe /></DriverIdentityProvider>);

    expect(screen.getByTestId('identity-state')).toHaveTextContent('identity-1:driver-rcc');
    expect(from).toHaveBeenCalledTimes(3);
  });

  it('selects only the driver link from the active league', async () => {
    const { client } = createClient();
    const user = { id: 'user-1' } as User;
    const view = render(<DriverIdentityProvider client={client} leagueSlug="rcc" user={user}><Probe /></DriverIdentityProvider>);

    await act(async () => {});
    expect(screen.getByTestId('identity-state')).toHaveTextContent('identity-1:driver-rcc');

    view.rerender(<DriverIdentityProvider client={client} leagueSlug="rummelracer" user={user}><Probe /></DriverIdentityProvider>);
    await act(async () => {});

    expect(screen.getByTestId('identity-state')).toHaveTextContent('identity-1:driver-rummelracer');
  });
});
