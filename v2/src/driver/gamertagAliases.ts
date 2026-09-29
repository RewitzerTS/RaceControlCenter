import type { LeagueSupabaseClient } from '../lib/supabase';
import { normalizeGamertag } from './gamertag';

export type AliasPlatform = 'other' | 'ea' | 'playstation' | 'xbox' | 'steam';
export type GamertagAlias = { id: string; alias: string; platform: AliasPlatform; editable: boolean; scope: 'personal' | 'league' };
export type GamertagAliases = { main: string | null; aliases: GamertagAlias[] };
export function aliasResponse(data: unknown): GamertagAliases {
  if (!data || typeof data !== 'object' || !('aliases' in data) || !Array.isArray(data.aliases)) throw new Error('ALIAS_RESPONSE');
  return data as GamertagAliases;
}
export async function loadGamertagAliases(client: LeagueSupabaseClient, driverId?: string) {
  const { data, error } = await client.rpc('get_driver_gamertags', { p_driver_id: driverId });
  if (error) throw error;
  return aliasResponse(data);
}
export async function addGamertagAlias(client: LeagueSupabaseClient, alias: string, platform: AliasPlatform, driverId?: string) {
  const clean = normalizeGamertag(alias);
  if (!clean) throw new Error('ALIAS_INVALID');
  const { data, error } = await client.rpc('add_driver_gamertag', { p_alias: clean, p_platform: platform, p_driver_id: driverId });
  if (error) throw error;
  return aliasResponse(data);
}
export async function removeGamertagAlias(client: LeagueSupabaseClient, aliasId: string, driverId?: string) {
  const { data, error } = await client.rpc('remove_driver_gamertag', { p_alias_id: aliasId, p_driver_id: driverId });
  if (error) throw error;
  return aliasResponse(data);
}
