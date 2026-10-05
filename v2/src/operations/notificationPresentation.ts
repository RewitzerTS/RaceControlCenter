import type { Json } from '../types/database';
import type { InboxNotification } from './operations';

type NotificationCategoryKey =
  | 'notification.kind.result'
  | 'notification.kind.steward'
  | 'notification.kind.system';

export type NotificationPresentation = {
  categoryKey: NotificationCategoryKey;
  params: Record<string, string | number>;
  reference: string | null;
  target: string | null;
};

function payloadObject(payload: Json): Record<string, Json | undefined> {
  return payload && !Array.isArray(payload) && typeof payload === 'object' ? payload : {};
}

function text(value: Json | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function number(value: Json | undefined): number | string {
  return typeof value === 'number' || typeof value === 'string' ? value : '—';
}

export function notificationPresentation(item: InboxNotification): NotificationPresentation {
  const payload = payloadObject(item.payload);
  const isSteward = item.notification_kind === 'steward_decision';
  const isResult = item.notification_kind === 'race_summary';
  const caseNumber = text(payload.case_number, '—');
  const version = number(payload.result_version);
  const league = text(payload.league_slug, '');
  const suffix = league ? `?league=${encodeURIComponent(league)}` : '';
  if (payload.event_type === 'league.join_requested') return { categoryKey: 'notification.kind.system', params: {}, reference: null, target: `/admin/users${suffix}` };
  if (payload.event_type === 'steward.case_opened') return { categoryKey: 'notification.kind.steward', params: { caseNumber }, reference: caseNumber, target: `/stewarding${suffix}` };
  if (payload.event_type === 'career.level_up') return { categoryKey: 'notification.kind.system', params: { level: number(payload.level) }, reference: null, target: '/career' };

  return {
    categoryKey: isSteward ? 'notification.kind.steward' : isResult ? 'notification.kind.result' : 'notification.kind.system',
    params: {
      race: text(payload.race_name, '—'),
      caseNumber,
      version,
    },
    reference: isSteward && caseNumber !== '—' ? caseNumber : isResult && version !== '—' ? `V${version}` : null,
    target: isSteward || isResult ? '/racing' : null,
  };
}
