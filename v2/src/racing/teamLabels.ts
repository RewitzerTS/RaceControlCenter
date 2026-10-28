import type { LeagueSupabaseClient } from '../lib/supabase';
export type TeamLabel = { season_id: string; team_id: string; key_name: string; display_name: string };
export async function loadTeamLabels(client: LeagueSupabaseClient): Promise<TeamLabel[]> {
  const { data, error } = await client.rpc('get_league_team_labels');
  if (error) throw error;
  return data ?? [];
}
export function teamLabel(labels: TeamLabel[], seasonId: string, name: string | null | undefined) {
  return labels.find(label => label.season_id === seasonId && label.key_name === name)?.display_name ?? name;
}
