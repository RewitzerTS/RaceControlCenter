import type { Json } from '../types/database';
import type { LeagueSupabaseClient } from '../lib/supabase';

export type MetricCounts = {
  races?: number;
  drivers?: number;
  members?: number;
  open_steward_cases?: number;
  leagues?: number;
  global_drivers?: number;
  pending_jobs: number;
  failed_jobs: number;
};

export type AuditItem = { id: string; action: string; entity_type: string; occurred_at: string };
export type OwnerLeague = { id: string; name: string; slug: string; status: string };
export type PlatformFlag = { key: string; enabled: boolean; description_key: string; updated_at: string };
export type AdminSnapshot = { league: OwnerLeague; counts: MetricCounts; recent_audit: AuditItem[] };
export type OwnerSnapshot = { counts: MetricCounts; leagues: OwnerLeague[]; flags: PlatformFlag[]; recent_audit: AuditItem[] };
export type CreatedLeague = { id: string; name: string; slug: string; status: string; is_public: boolean };
export type LeagueBranding = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  subtitle: string;
  description: string;
  websiteUrl: string;
  discordUrl: string;
  themePreset: number;
};
export type LeagueMemberRole = 'driver' | 'steward' | 'league_admin';
export type LeagueMember = {
  user_id: string;
  email: string;
  role: LeagueMemberRole;
  joined_at: string;
  identity_status: string;
  driver_id: string | null;
  driver_name: string | null;
};
export type MemberAdminWorkspace = { league: OwnerLeague; members: LeagueMember[] };
export type LeagueDriver = {
  id: string;
  display_name: string;
  gamertag: string | null;
  number: number | null;
  nationality_code: string | null;
  league_team: string | null;
  car_name: string | null;
  is_active: boolean;
  identity_linked: boolean;
  result_count: number;
};
export type DriverAdminWorkspace = {
  league: OwnerLeague;
  counts: { total: number; active: number; linked: number };
  drivers: LeagueDriver[];
};
export type LeagueSeason = { id: string; name: string; slug: string; is_active: boolean; game_label: string; start_date: string | null; end_date: string | null };
export type LeagueRace = {
  id: string; season_id: string; season_name: string; round_number: number;
  grand_prix_name: string; circuit_name: string | null; country_code: string | null;
  race_date: string | null; race_start_at: string | null; status: string; has_sprint: boolean;
  result_count: number; result_version: number | null; result_status: string | null; result_activated_at: string | null;
};
export type DriverStanding = { driver_id: string; display_name: string; gamertag: string | null; points: number; wins: number; podiums: number; starts: number };
export type TeamStanding = { team_name: string; points: number; wins: number; podiums: number };
export type RaceAdminWorkspace = { league: OwnerLeague; seasons: LeagueSeason[]; races: LeagueRace[]; driver_standings: DriverStanding[]; team_standings: TeamStanding[] };
export type LeagueDriverInput = {
  id?: string;
  displayName: string;
  gamertag: string;
  number: number | null;
  nationalityCode: string;
  leagueTeam: string;
  carName: string;
  isActive: boolean;
};
export type InboxNotification = {
  id: string;
  notification_kind: string;
  title_key: string;
  body_key: string;
  payload: Json;
  created_at: string;
  read_at: string | null;
};

function object(value: Json | null): Record<string, Json | undefined> {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Unexpected workspace payload.');
  return value;
}

export async function loadAdminSnapshot(client: LeagueSupabaseClient): Promise<AdminSnapshot> {
  const response = await client.rpc('get_league_admin_workspace');
  if (response.error) throw response.error;
  return object(response.data) as unknown as AdminSnapshot;
}

export async function loadOwnerSnapshot(client: LeagueSupabaseClient): Promise<OwnerSnapshot> {
  const response = await client.rpc('get_owner_control_snapshot');
  if (response.error) throw response.error;
  return object(response.data) as unknown as OwnerSnapshot;
}

export async function setPlatformFlag(client: LeagueSupabaseClient, key: string, enabled: boolean) {
  const response = await client.rpc('set_platform_feature_flag', { p_flag_key: key, p_enabled: enabled });
  if (response.error) throw response.error;
}

export async function loadInbox(client: LeagueSupabaseClient): Promise<InboxNotification[]> {
  const response = await client
    .from('user_notifications')
    .select('id,notification_kind,title_key,body_key,payload,created_at,read_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (response.error) throw response.error;
  return response.data ?? [];
}

export async function markInboxItemRead(client: LeagueSupabaseClient, id: string) {
  const response = await client.rpc('mark_notification_read', { p_notification_id: id });
  if (response.error) throw response.error;
}

export async function loadMemberAdminWorkspace(client: LeagueSupabaseClient): Promise<MemberAdminWorkspace> {
  const response = await client.rpc('get_league_member_admin_workspace');
  if (response.error) throw response.error;
  return object(response.data) as unknown as MemberAdminWorkspace;
}

export async function addLeagueMember(client: LeagueSupabaseClient, email: string, role: LeagueMemberRole) {
  const response = await client.rpc('add_existing_league_member_by_email', { p_email: email, p_role: role });
  if (response.error) throw response.error;
}

export async function setLeagueMemberRole(client: LeagueSupabaseClient, userId: string, role: LeagueMemberRole) {
  const response = await client.rpc('set_league_member_role', { p_user_id: userId, p_role: role });
  if (response.error) throw response.error;
}

export async function removeLeagueMember(client: LeagueSupabaseClient, userId: string) {
  const response = await client.rpc('remove_league_member', { p_user_id: userId });
  if (response.error) throw response.error;
}

export async function loadDriverAdminWorkspace(client: LeagueSupabaseClient): Promise<DriverAdminWorkspace> {
  const response = await client.rpc('get_league_driver_admin_workspace');
  if (response.error) throw response.error;
  return object(response.data) as unknown as DriverAdminWorkspace;
}

export async function loadRaceAdminWorkspace(client: LeagueSupabaseClient): Promise<RaceAdminWorkspace> {
  const response = await client.rpc('get_league_race_admin_workspace');
  if (response.error) throw response.error;
  return object(response.data) as unknown as RaceAdminWorkspace;
}

export async function upsertLeagueDriver(client: LeagueSupabaseClient, input: LeagueDriverInput) {
  const response = await client.rpc('upsert_league_driver', {
    p_display_name: input.displayName,
    p_driver_id: input.id,
    p_gamertag: input.gamertag,
    p_number: input.number ?? undefined,
    p_nationality_code: input.nationalityCode,
    p_league_team: input.leagueTeam,
    p_car_name: input.carName,
    p_is_active: input.isActive,
  });
  if (response.error) throw response.error;
}

function optionalText(value: Json | undefined): string {
  return typeof value === 'string' ? value : '';
}

function firstText(settings: Record<string, Json | undefined>, ...keys: string[]): string {
  for (const key of keys) {
    const value = optionalText(settings[key]);
    if (value) return value;
  }
  return '';
}

export async function createLeague(
  client: LeagueSupabaseClient,
  input: { name: string; slug: string; isPublic: boolean },
): Promise<CreatedLeague> {
  const response = await client.rpc('create_league', {
    p_name: input.name,
    p_slug: input.slug,
    p_is_public: input.isPublic,
  });
  if (response.error) throw response.error;
  return object(response.data) as unknown as CreatedLeague;
}

export async function loadLeagueBranding(client: LeagueSupabaseClient, leagueSlug: string): Promise<LeagueBranding> {
  const response = await client.from('leagues').select('id,name,slug,logo_url,settings').eq('slug', leagueSlug).single();
  if (response.error) throw response.error;
  const settings = object(response.data.settings);
  return {
    id: response.data.id,
    name: response.data.name,
    slug: response.data.slug,
    logoUrl: response.data.logo_url ?? '',
    subtitle: firstText(settings, 'brand_subtitle', 'subtitle'),
    description: firstText(settings, 'public_description', 'description'),
    websiteUrl: firstText(settings, 'public_website', 'website_url'),
    discordUrl: firstText(settings, 'public_discord', 'discord_url'),
    themePreset: Number(firstText(settings, 'theme_id') || settings.theme_preset || 1),
  };
}

export async function uploadLeagueLogo(client: LeagueSupabaseClient, leagueSlug: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${leagueSlug}/logo-${Date.now()}.${extension}`;
  const upload = await client.storage.from('league-brand-assets').upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  });
  if (upload.error) throw upload.error;
  return client.storage.from('league-brand-assets').getPublicUrl(upload.data.path).data.publicUrl;
}

export async function updateLeagueBranding(
  client: LeagueSupabaseClient,
  input: Omit<LeagueBranding, 'id' | 'slug'>,
): Promise<LeagueBranding> {
  const response = await client.rpc('update_league_branding', {
    p_brand_name: input.name,
    p_brand_subtitle: input.subtitle,
    p_public_description: input.description,
    p_public_website: input.websiteUrl,
    p_public_discord: input.discordUrl,
    p_logo_url: input.logoUrl,
    p_theme_id: String(input.themePreset),
  });
  if (response.error) throw response.error;
  const data = object(response.data);
  const settings = object(data.settings ?? null);
  return {
    id: String(data.id ?? ''),
    slug: String(data.slug ?? ''),
    name: String(data.name ?? input.name),
    logoUrl: String(data.logo_url ?? input.logoUrl),
    subtitle: firstText(settings, 'brand_subtitle') || input.subtitle,
    description: firstText(settings, 'public_description') || input.description,
    websiteUrl: firstText(settings, 'public_website') || input.websiteUrl,
    discordUrl: firstText(settings, 'public_discord') || input.discordUrl,
    themePreset: Number(firstText(settings, 'theme_id') || input.themePreset),
  };
}
