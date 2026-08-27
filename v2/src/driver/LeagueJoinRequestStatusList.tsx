import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import {
  joinRequestPresentation,
  loadMyLeagueJoinRequests,
  type MyLeagueJoinRequest,
} from './leagueJoinRequests';

type Props = {
  refreshKey?: number;
};

export function LeagueJoinRequestStatusList({ refreshKey = 0 }: Props) {
  const { client } = useLeague();
  const { formatDate, formatTime, t } = useI18n();
  const [requests, setRequests] = useState<MyLeagueJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setRequests(await loadMyLeagueJoinRequests(client));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  if (loading) return <p className="join-request-status-state" role="status">{t('joinRequests.loading')}</p>;
  if (failed) return <p className="form-error join-request-status-state" role="alert">{t('joinRequests.loadError')}</p>;
  if (!requests.length) return <p className="join-request-status-state">{t('joinRequests.empty')}</p>;

  return <ol className="join-request-status-list">
    {requests.map((request) => {
      const presentation = joinRequestPresentation(request.status);
      const requestedAt = `${formatDate(request.requested_at)} · ${formatTime(request.requested_at)}`;
      const reviewedAt = request.reviewed_at
        ? `${formatDate(request.reviewed_at)} · ${formatTime(request.reviewed_at)}`
        : '';
      return <li className={`join-request-status join-request-status--${presentation.tone}`} key={request.id}>
        <div className="join-request-status-heading">
          <div><strong>{request.league_name}</strong><small>{request.league_slug}</small></div>
          <span>{t(presentation.labelKey)}</span>
        </div>
        <p>{t(presentation.descriptionKey)}</p>
        <dl>
          <div><dt>{t('joinRequests.requestedAt')}</dt><dd>{requestedAt}</dd></div>
          {reviewedAt && <div><dt>{t('joinRequests.reviewedAt')}</dt><dd>{reviewedAt}</dd></div>}
        </dl>
      </li>;
    })}
  </ol>;
}
