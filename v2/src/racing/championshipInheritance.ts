import type { LeagueSupabaseClient } from '../lib/supabase';

export interface ChampionshipAiAssignment {
  human_driver_id: string;
  ai_driver_id: string;
  effective_from_round: number;
  effective_to_round: number | null;
}

export async function loadChampionshipAiAssignments(client: LeagueSupabaseClient, seasonId: string, signal: AbortSignal) {
  const response = await client.rpc('get_season_championship_ai_assignments', { p_season_id: seasonId }).abortSignal(signal);
  signal.throwIfAborted();
  if (response.error) throw response.error;
  if (!Array.isArray(response.data)) throw new Error('Championship assignments unavailable');
  return response.data;
}

// An AI result belongs to the first human who takes over that AI stint. Ended
// assignments retain their inherited points even after a later seat change.
// The server excludes assignments which have not yet become effective.
export function championshipPointOwner(owner: string, round: number, assignments: ChampionshipAiAssignment[] = []) {
  const takeover = assignments.filter(item => item.ai_driver_id === owner
    && (item.effective_to_round === null || item.effective_to_round >= round))
    .sort((a, b) => a.effective_from_round - b.effective_from_round);
  if (!takeover.length) return owner;
  const first = takeover[0];
  if (takeover.some(item => item.effective_from_round === first.effective_from_round && item.human_driver_id !== first.human_driver_id)) {
    throw new Error('Ambiguous championship seat ownership');
  }
  return first.human_driver_id;
}
