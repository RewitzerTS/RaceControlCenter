import type { Json } from '../types/database';
import type { LeagueSupabaseClient } from '../lib/supabase';

export type VoraSnapshot = {
  source: 'deterministic_v1';
  generated_at: string;
  insight: { rule: string; title_key: string; body_key: string };
  career: { starts: number; wins: number; podiums: number; average_finish: number | null; last_race_date: string | null };
  progression: { level: number; rank: string; lifetime_xp: number; xp_to_next_level: number };
  recent_result: { finish_position: number | null; grid_position: number | null; classification_status: string; race_date: string | null } | null;
  active_challenges: number;
  context_fields: string[];
};

function isRecord(value: Json | null): value is Record<string, Json | undefined> {
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object';
}

export async function loadVoraSnapshot(client: LeagueSupabaseClient): Promise<VoraSnapshot> {
  const response = await client.rpc('get_vora_companion_snapshot');
  if (response.error) throw response.error;
  if (!isRecord(response.data) || response.data.source !== 'deterministic_v1') throw new Error('Unexpected Vora context.');
  return response.data as unknown as VoraSnapshot;
}
