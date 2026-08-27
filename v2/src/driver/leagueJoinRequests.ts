import type { LeagueSupabaseClient } from '../lib/supabase';
import type { MessageKey } from '../i18n/messages';

export type LeagueJoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type MyLeagueJoinRequest = {
  id: string;
  league_id: string;
  league_name: string;
  league_slug: string;
  status: LeagueJoinRequestStatus;
  requested_at: string;
  reviewed_at: string | null;
};

type JoinRequestPresentation = {
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  tone: LeagueJoinRequestStatus;
};

const PRESENTATIONS: Record<LeagueJoinRequestStatus, JoinRequestPresentation> = {
  pending: {
    labelKey: 'joinRequests.pending',
    descriptionKey: 'joinRequests.pendingCopy',
    tone: 'pending',
  },
  approved: {
    labelKey: 'joinRequests.approved',
    descriptionKey: 'joinRequests.approvedCopy',
    tone: 'approved',
  },
  rejected: {
    labelKey: 'joinRequests.rejected',
    descriptionKey: 'joinRequests.rejectedCopy',
    tone: 'rejected',
  },
  cancelled: {
    labelKey: 'joinRequests.cancelled',
    descriptionKey: 'joinRequests.cancelledCopy',
    tone: 'cancelled',
  },
};

export function joinRequestPresentation(status: LeagueJoinRequestStatus): JoinRequestPresentation {
  return PRESENTATIONS[status];
}

function isJoinRequest(value: unknown): value is MyLeagueJoinRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<MyLeagueJoinRequest>;
  return typeof candidate.id === 'string'
    && typeof candidate.league_id === 'string'
    && typeof candidate.league_name === 'string'
    && typeof candidate.league_slug === 'string'
    && typeof candidate.requested_at === 'string'
    && ['pending', 'approved', 'rejected', 'cancelled'].includes(String(candidate.status));
}

export async function loadMyLeagueJoinRequests(client: LeagueSupabaseClient): Promise<MyLeagueJoinRequest[]> {
  const response = await client.rpc('get_my_league_join_requests');
  if (response.error) throw response.error;
  return Array.isArray(response.data) ? response.data.filter(isJoinRequest) : [];
}
