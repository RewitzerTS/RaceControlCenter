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
