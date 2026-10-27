import { describe, expect, it, vi } from 'vitest';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { loadNameSettings, nameCopy, nameSettings, saveNameSettings, withPublicName } from './nameSettings';
const state = { name: 'Richard', gamertag: 'Racer', public_name_mode: 'gamertag' as const, needs_confirmation: false, revision: 'r1' };
describe('name and public appearance', () => {
  it('validates the server response and preserves a missing identity', () => {
    expect(nameSettings(null)).toBeNull(); expect(nameSettings(state)).toEqual(state);
    for (const value of [{}, { ...state, public_name_mode: 'email' }, { ...state, revision: null }]) expect(() => nameSettings(value)).toThrow();
  });
  it('writes only the current account with an explicit choice and revision', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: state, error: null }); const client = { rpc } as unknown as LeagueSupabaseClient;
    expect(await loadNameSettings(client)).toEqual(state);
    expect(await saveNameSettings(client, ' Richard ', 'gamertag', 'r1')).toEqual(state);
    expect(rpc).toHaveBeenLastCalledWith('save_my_name_settings', { p_name: 'Richard', p_public_name_mode: 'gamertag', p_revision: 'r1' });
    for (const value of ['', 'a', '<bad>', 'x'.repeat(61), 'bad\nname']) await expect(saveNameSettings(client, value, 'name', 'r1')).rejects.toThrow('INVALID');
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('does not report a stale or malformed save as success', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'NAME_SETTINGS_STALE' } }); const client = { rpc } as unknown as LeagueSupabaseClient;
    await expect(saveNameSettings(client, 'Richard', 'name', 'old')).rejects.toMatchObject({ message: 'NAME_SETTINGS_STALE' });
    rpc.mockResolvedValue({ data: state, error: null });
    await expect(saveNameSettings(client, 'Different', 'gamertag', 'r1')).rejects.toThrow('RESPONSE');
  });
  it('changes only the visible label, never IDs, points or input objects', () => {
    const driver = { id: 'unchanged', display_name: 'Legacy', public_name: 'Racer', points: 255 };
    expect(withPublicName(driver)).toEqual({ ...driver, display_name: 'Racer' });
    expect(driver.display_name).toBe('Legacy');
    expect(withPublicName({ display_name: 'Legacy', public_name: null }).display_name).toBe('Legacy');
  });
  it('keeps all copy complete in four languages', () => {
    for (const copy of Object.values(nameCopy)) expect(Object.keys(copy)).toEqual(Object.keys(nameCopy.de));
  });
});
