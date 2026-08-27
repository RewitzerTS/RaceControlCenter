import { act, cleanup, render, screen } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { RoleProvider, useRole } from './RoleProvider';

function Probe() {
  const { loading, role } = useRole();
  return <span data-testid="role-state">{loading ? 'loading' : role ?? 'none'}</span>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe('RoleProvider', () => {
  afterEach(cleanup);

  it('does not expose the previous league role while the new league role is loading', async () => {
    const oldRole = deferred<{ data: string; error: null }>();
    const newRole = deferred<{ data: string; error: null }>();
    const rpc = vi.fn()
      .mockReturnValueOnce(oldRole.promise)
      .mockReturnValueOnce(newRole.promise);
    const client = { rpc } as unknown as LeagueSupabaseClient;
    const user = { id: 'user-1' } as User;

    const view = render(<RoleProvider client={client} leagueSlug="old-league" user={user}><Probe /></RoleProvider>);
    expect(screen.getByTestId('role-state')).toHaveTextContent('loading');

    await act(async () => { oldRole.resolve({ data: 'driver', error: null }); });
    expect(screen.getByTestId('role-state')).toHaveTextContent('driver');

    view.rerender(<RoleProvider client={client} leagueSlug="new-league" user={user}><Probe /></RoleProvider>);
    expect(screen.getByTestId('role-state')).toHaveTextContent('loading');

    await act(async () => { newRole.resolve({ data: 'league_admin', error: null }); });
    expect(screen.getByTestId('role-state')).toHaveTextContent('league_admin');
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
