import type { LeagueSupabaseClient } from '../lib/supabase';

export function normalizeGamertag(value: string): string | null {
  const normalized = value.trim();
  const length = Array.from(normalized).length;
  return length >= 2 && length <= 60 && !/[<>\u0000-\u001f\u007f]/.test(normalized) ? normalized : null;
}

export async function saveOwnGamertag(client: LeagueSupabaseClient, value: string): Promise<string> {
  const gamertag = normalizeGamertag(value);
  if (!gamertag) throw new Error('invalid_gamertag');
  const { data, error } = await client.rpc('update_my_gamertag', { p_gamertag: gamertag });
  if (error) throw error;
  if (typeof data !== 'string' || data !== gamertag) throw new Error('gamertag_save_not_confirmed');
  return data;
}
