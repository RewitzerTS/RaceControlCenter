import type { LeagueSupabaseClient } from '../lib/supabase';
import type { Json } from '../types/database';
import type { GamertagAliases, AliasPlatform } from '../driver/gamertagAliases';
import type { LeagueDriver, SeasonCalendarEntry, StartedSeason, SeasonAiAssignment } from './operations';

export type EditorAlias = { alias: string; platform: AliasPlatform };
export type DriverEditorState = { driver: LeagueDriver | null; gamertags: GamertagAliases; revision: string };
export const platformLabels: Record<AliasPlatform, string> = { ea: 'EA', playstation: 'PlayStation', steam: 'Steam', xbox: 'Xbox', other: 'Andere Plattform' };
export function editableAliases(tags: GamertagAliases): EditorAlias[] {
  const rows = tags.aliases.filter(a => a.editable).map(({ alias, platform }) => ({ alias, platform }));
  for (const platform of ['ea', 'playstation', 'steam', 'xbox'] as const) if (!rows.some(a => a.platform === platform)) rows.push({ alias: '', platform });
  return rows;
}
export function occupiedAi(assignments: SeasonAiAssignment[], aiId: string, driverId: string | undefined, round: number) {
  return assignments.find(a => a.ai_driver_id === aiId && a.human_driver_id !== driverId && (a.effective_to_round === null || a.effective_to_round >= round));
}
function editorState(data: unknown): DriverEditorState {
  if (!data || typeof data !== 'object' || !('revision' in data) || !('gamertags' in data)) throw new Error('Das Fahrerformular konnte nicht geladen werden. Bitte erneut versuchen.');
  return data as DriverEditorState;
}
export async function loadDriverEditor(client: LeagueSupabaseClient, id?: string) {
  const { data, error } = await client.rpc('get_league_driver_editor', { p_driver_id: id ?? null });
  if (error) throw error;
  return editorState(data);
}
export async function saveDriverEditor(client: LeagueSupabaseClient, input: {
  id?: string; profile: { display_name: string; gamertag: string; nationality_code: string; is_active: boolean };
  aliases: EditorAlias[]; aiId: string | null; round: number | null; revision: string;
}) {
  const { data, error } = await client.rpc('save_league_driver_editor', {
    p_driver_id: input.id ?? null, p_profile: input.profile, p_aliases: input.aliases.filter(a => a.alias.trim()).map(a => ({ ...a, alias: a.alias.trim() })),
    p_ai_driver_id: input.aiId, p_round: input.round, p_revision: input.revision,
  });
  if (error) throw error;
  return editorState(data);
}
export async function startSeasonWithoutAssignments(client: LeagueSupabaseClient, input: {
  name: string; slug: string; gameKey: string; startDate: string; fastestLapBonusEnabled: boolean; calendar: SeasonCalendarEntry[];
}): Promise<StartedSeason> {
  const { data, error } = await client.rpc('start_league_season_setup', {
    p_name: input.name, p_slug: input.slug, p_game_key: input.gameKey, p_start_date: input.startDate,
    p_calendar: input.calendar as unknown as Json, p_fastest_lap_bonus_enabled: input.fastestLapBonusEnabled,
  });
  if (error) throw new Error(error.message);
  return data as unknown as StartedSeason;
}
