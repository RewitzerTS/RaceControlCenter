import type { LeagueSupabaseClient } from '../lib/supabase';

export type LinkableDriver = { id: string; display_name: string; gamertag: string | null; number: number | null; is_active: boolean };

export function memberDriverLinkError(reason: unknown): string {
  const message = reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : '';
  const messages: Record<string, string> = {
    MEMBER_DRIVER_TAKEN: 'Dieser Fahrer ist inzwischen mit einem anderen Konto verknüpft. Bitte lade die Auswahl neu.',
    MEMBER_ALREADY_LINKED: 'Dieses Konto hat bereits einen Fahrer in dieser Liga. Bestehende Verknüpfungen werden nicht überschrieben.',
    MEMBER_NOT_FOUND: 'Das Konto ist nicht mehr Mitglied dieser Liga. Bitte lade die Seite neu.',
    MEMBER_IDENTITY_INACTIVE: 'Das Konto benötigt ein aktives RaceVora-Profil.',
    MEMBER_DRIVER_NOT_FOUND: 'Dieser Fahrer gehört nicht zur aktuellen Liga oder ist ein KI-Fahrer. Bitte lade die Auswahl neu.',
    MEMBER_LINK_DENIED: 'Du hast keine Berechtigung für diese Zuordnung. Bitte prüfe deine aktive Liga und Anmeldung.',
  };
  return messages[message] ?? 'Die Verknüpfung konnte nicht bestätigt werden. Bitte lade die Auswahl neu und versuche es erneut.';
}

export async function loadLinkableDrivers(client: LeagueSupabaseClient): Promise<LinkableDriver[]> {
  const { data, error } = await client.rpc('get_linkable_league_drivers');
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Invalid driver selection');
  return data as LinkableDriver[];
}

export async function linkMemberDriver(client: LeagueSupabaseClient, userId: string, driverId: string) {
  const { error } = await client.rpc('link_league_member_driver', { p_user_id: userId, p_driver_id: driverId });
  if (error) throw error;
}
