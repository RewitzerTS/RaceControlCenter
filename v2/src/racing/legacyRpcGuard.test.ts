import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync('../assets/js/supabase-client.js', 'utf8');
const guard = source.slice(source.indexOf('(() => {', source.indexOf('// Authenticated helper RPCs')), source.indexOf('// The bundled Hall-of-Fame'));

describe('legacy authenticated RPC guard', () => {
  it('preserves the actual Supabase query builder for paginated profile and comparison history', async () => {
    const requests: URL[] = [];
    const client = createClient('https://rpc-test.supabase.co', 'test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input) => { requests.push(new URL(String(input))); return new Response('[]', { headers: { 'Content-Type': 'application/json' } }); } } });
    runInNewContext(guard, { window: { supabaseClient: client } });
    const response = await client.rpc('get_league_team_history').order('season_id').order('driver_id').order('effective_round_number').order('created_at').range(1000, 1999).abortSignal(new AbortController().signal);
    expect(response.error).toBeNull();
    expect(requests[0].searchParams.get('order')).toBe('season_id.asc,driver_id.asc,effective_round_number.asc,created_at.asc');
    expect(requests[0].searchParams.get('offset')).toBe('1000');
    expect(requests[0].searchParams.get('limit')).toBe('1000');
  });
  it('still short-circuits anonymous boolean role checks without network requests', async () => {
    const native = vi.fn().mockResolvedValue({ data: true, error: null });
    const client = { rpc: native, auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) } };
    runInNewContext(guard, { window: { supabaseClient: client } });
    expect(await client.rpc('is_platform_owner')).toEqual({ data: false, error: null });
    expect(native).not.toHaveBeenCalled();
    client.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'test-user' } } }, error: null } as never);
    expect(await client.rpc('is_platform_owner')).toEqual({ data: true, error: null });
    expect(native).toHaveBeenCalledOnce();
  });
});
