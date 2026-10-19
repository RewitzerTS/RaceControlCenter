import type { LeagueSupabaseClient } from '../lib/supabase';

export type EntryState = {
  identity_id: string;
  racevora_id: string;
  display_name: string | null;
  gamertag: string | null;
  step: 1 | 2 | 3;
  profile_complete: boolean;
};

export function entryState(value: unknown): EntryState {
  if (!value || typeof value !== 'object') throw new Error('ENTRY_RESPONSE');
  const data = value as EntryState;
  if (typeof data.identity_id !== 'string' || typeof data.racevora_id !== 'string'
    || ![1, 2, 3].includes(data.step) || typeof data.profile_complete !== 'boolean') throw new Error('ENTRY_RESPONSE');
  return data;
}

export async function loadEntry(client: LeagueSupabaseClient) {
  const { data, error } = await client.rpc('get_my_entry_state');
  if (error) throw error;
  return entryState(data);
}

export async function saveEntryProfile(client: LeagueSupabaseClient, name: string, gamertag: string) {
  const { data, error } = await client.rpc('save_my_entry_profile', { p_display_name: name.trim(), p_gamertag: gamertag.trim() });
  if (error) throw error;
  return entryState(data);
}

export async function advanceEntry(client: LeagueSupabaseClient, step: 2 | 3, finish = false) {
  const { data, error } = await client.rpc('advance_my_entry', { p_step: step, p_finish: finish });
  if (error) throw error;
  return entryState(data);
}

export async function requestEntryLeague(client: LeagueSupabaseClient, code: string) {
  if (!/^\d{5}$/.test(code.trim())) throw new Error('ENTRY_CODE');
  const { data, error } = await client.rpc('request_my_entry_league', { p_code: code.trim() });
  if (error) throw error;
  return data as { league_name: string; request_status: string };
}
