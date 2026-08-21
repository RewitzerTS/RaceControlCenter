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

function optionalText(value: Json | undefined): string {
  return typeof value === 'string' ? value : '';
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
    subtitle: optionalText(settings.subtitle),
    description: optionalText(settings.description),
    websiteUrl: optionalText(settings.website_url),
    discordUrl: optionalText(settings.discord_url),
    themePreset: typeof settings.theme_preset === 'number' ? settings.theme_preset : 1,
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
    p_name: input.name,
    p_logo_url: input.logoUrl,
    p_subtitle: input.subtitle,
    p_description: input.description,
    p_website_url: input.websiteUrl,
    p_discord_url: input.discordUrl,
    p_theme_preset: input.themePreset,
  });
  if (response.error) throw response.error;
  const data = object(response.data);
  return {
    id: String(data.id ?? ''),
    slug: String(data.slug ?? ''),
    name: String(data.name ?? input.name),
    logoUrl: String(data.logo_url ?? input.logoUrl),
    subtitle: String(data.subtitle ?? input.subtitle),
    description: String(data.description ?? input.description),
    websiteUrl: String(data.website_url ?? input.websiteUrl),
    discordUrl: String(data.discord_url ?? input.discordUrl),
    themePreset: Number(data.theme_preset ?? input.themePreset),
  };
}
