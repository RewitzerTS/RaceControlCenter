import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { AuthProvider, useAuth } from './AuthProvider';

describe('signup response handling', () => {
  it.each([
    [[], 'existing-account'],
    [[{ id: 'new-identity' }], 'confirmation-required'],
    [undefined, 'confirmation-required'],
  ])('handles identities %j without claiming a session', async (identities, expected) => {
    const client = { auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signUp: vi.fn().mockResolvedValue({ data: { session: null, user: { identities } }, error: null }),
    } } as unknown as LeagueSupabaseClient;
    const wrapper = ({ children }: PropsWithChildren) => <AuthProvider client={client} captcha={{ enabled: false, turnstileSiteKey: null }}>{children}</AuthProvider>;
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let response: string | undefined;
    await act(async () => { response = await result.current.signUp('qa@example.invalid', 'test-password-only', null); });
    expect(response).toBe(expected);
    expect(result.current.session).toBeNull();
  });
});
