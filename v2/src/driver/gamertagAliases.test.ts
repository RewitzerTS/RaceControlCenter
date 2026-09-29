import { describe, expect, it, vi } from 'vitest';
import { addGamertagAlias, aliasResponse, removeGamertagAlias } from './gamertagAliases';
import type { LeagueSupabaseClient } from '../lib/supabase';
describe('gamertag alias API', () => {
  it('validates before sending and preserves explicit admin scope', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { main: 'Darkqz', aliases: [] }, error: null });
    const client = { rpc } as unknown as LeagueSupabaseClient;
    await expect(addGamertagAlias(client,'<invalid>','ea')).rejects.toThrow('ALIAS_INVALID');
    expect(rpc).not.toHaveBeenCalled();
    await addGamertagAlias(client,' D4RK ','steam','driver');
    expect(rpc).toHaveBeenCalledWith('add_driver_gamertag',{ p_alias: 'D4RK', p_platform:'steam',p_driver_id:'driver' });
    await removeGamertagAlias(client,'alias-id');
    expect(rpc).toHaveBeenLastCalledWith('remove_driver_gamertag',{p_alias_id:'alias-id',p_driver_id:undefined});
  });
  it('does not report an unconfirmed response as saved', () => {
    expect(() => aliasResponse(null)).toThrow();
    expect(() => aliasResponse({})).toThrow();
  });
});
