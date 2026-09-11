import { describe, expect, it, vi } from 'vitest';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { loadAdminSnapshot } from './operations';
import { copyLeagueIdToClipboard } from './AdminWorkspacePage';

describe('league join codes', () => {
  it('loads and copies the five-digit code without replacing the internal UUID', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { league: { id: 'internal-uuid' } }, error: null })
      .mockResolvedValueOnce({ data: '12345', error: null });
    const result = await loadAdminSnapshot({ rpc } as unknown as LeagueSupabaseClient);
    expect(result.league).toEqual({ id: 'internal-uuid', join_code: '12345' });
    expect(rpc).toHaveBeenLastCalledWith('get_current_league_join_code');
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyLeagueIdToClipboard({ writeText }, result.league.join_code!)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('12345');
  });
  it('does not mislabel a missing code as a short code', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { league: { id: 'internal-uuid' } }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    await expect(loadAdminSnapshot({ rpc } as unknown as LeagueSupabaseClient)).rejects.toThrow('Beitrittscode');
  });
});
