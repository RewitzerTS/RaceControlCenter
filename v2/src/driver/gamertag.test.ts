import { describe, expect, it, vi } from 'vitest';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { normalizeGamertag, saveOwnGamertag } from './gamertag';

describe('personal gamertag correction', () => {
  it.each(['', ' ', 'a', '<racer>', 'a\nb', 'a\u0000b', 'x'.repeat(61)])('rejects invalid input %j', value => {
    expect(normalizeGamertag(value)).toBeNull();
  });
  it('preserves spelling and internal spaces, trims surrounding whitespace', () => {
    expect(normalizeGamertag('  Ratcher7575  ')).toBe('Ratcher7575');
    expect(normalizeGamertag('Räcer One_75')).toBe('Räcer One_75');
    expect(normalizeGamertag('x'.repeat(60))).toHaveLength(60);
  });
  it('only sends the new tag; user and driver IDs are not client-controlled', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'Ratcher7575', error: null });
    expect(await saveOwnGamertag({ rpc } as unknown as LeagueSupabaseClient, ' Ratcher7575 ')).toBe('Ratcher7575');
    expect(rpc).toHaveBeenCalledWith('update_my_gamertag', { p_gamertag: 'Ratcher7575' });
  });
  it('does not send invalid input', async () => {
    const rpc = vi.fn();
    await expect(saveOwnGamertag({ rpc } as unknown as LeagueSupabaseClient, '<bad>')).rejects.toThrow('invalid_gamertag');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('does not report success for a rejected or unconfirmed save', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: new Error('denied') }).mockResolvedValueOnce({ data: null, error: null });
    await expect(saveOwnGamertag({ rpc } as unknown as LeagueSupabaseClient, 'Ratcher7575')).rejects.toThrow('denied');
    await expect(saveOwnGamertag({ rpc } as unknown as LeagueSupabaseClient, 'Ratcher7575')).rejects.toThrow('gamertag_save_not_confirmed');
  });
});
