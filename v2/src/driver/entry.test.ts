import { describe, expect, it, vi } from 'vitest';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { advanceEntry, entryState, loadEntry, requestEntryLeague, saveEntryProfile } from './entry';
import { entryCopy } from './entryCopy';

const state = { identity_id: 'identity', racevora_id: 'RV-100001', display_name: null, gamertag: null, step: 1, profile_complete: false };
function client(data: unknown = state, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { rpc, value: { rpc } as unknown as LeagueSupabaseClient };
}
describe('Entry 2.0', () => {
  it('rejects malformed state instead of presenting missing data as success', () => {
    expect(entryState(state)).toEqual(state);
    for (const invalid of [null, [], {}, { ...state, step: 4 }, { ...state, profile_complete: undefined }]) expect(() => entryState(invalid)).toThrow();
  });
  it('provisions only the signed-in actor, without passing a user or league ID', async () => {
    const c = client(); await loadEntry(c.value);
    expect(c.rpc).toHaveBeenCalledWith('get_my_entry_state');
  });
  it('saves profile independently of league joining', async () => {
    const c = client(); await saveEntryProfile(c.value, ' Racer ', ' Darkqz ');
    expect(c.rpc).toHaveBeenCalledExactlyOnceWith('save_my_entry_names', { p_name: 'Racer', p_gamertag: 'Darkqz', p_public_name_mode: 'gamertag' });
  });
  it('rejects invalid codes locally and never silently drops characters', async () => {
    const c = client();
    for (const invalid of ['1234', '123456', 'abc12', '12 34']) await expect(requestEntryLeague(c.value, invalid)).rejects.toThrow('ENTRY_CODE');
    expect(c.rpc).not.toHaveBeenCalled();
    await requestEntryLeague(c.value, ' 12345 ');
    expect(c.rpc).toHaveBeenCalledWith('request_my_entry_league', { p_code: '12345' });
  });
  it('keeps transport and permission failures visible', async () => {
    const c = client(null, new Error('denied'));
    await expect(loadEntry(c.value)).rejects.toThrow('denied');
    await expect(saveEntryProfile(c.value, 'Racer', 'Tag')).rejects.toThrow('denied');
    await expect(advanceEntry(c.value, 3, true)).rejects.toThrow('denied');
  });
  it('has every entry message in all supported languages', () => {
    for (const copy of Object.values(entryCopy)) {
      expect(Object.keys(copy).sort()).toEqual(Object.keys(entryCopy.de).sort());
      expect(copy.steps).toHaveLength(3);
      expect(Object.values(copy).every(value => Array.isArray(value) || value.length > 0)).toBe(true);
    }
  });
});
