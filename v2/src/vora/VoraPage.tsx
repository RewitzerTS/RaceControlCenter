import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { AppState } from '../components/AppState';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { loadVoraSnapshot, type VoraSnapshot } from './vora';

export function VoraPage() {
  const { user } = useAuth();
  const { client } = useLeague();
  const { formatNumber, t } = useI18n();
  const [snapshot, setSnapshot] = useState<VoraSnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void loadVoraSnapshot(client).then((data) => { if (active) setSnapshot(data); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [client, user]);

  if (!user) return <AppState copy={t('vora.signedOutCopy')} title={t('vora.signedOutTitle')} tone="info" />;
  if (error) return <AppState action={<button className="text-action" onClick={() => window.location.reload()} type="button">Erneut versuchen</button>} copy={t('vora.errorCopy')} title={t('vora.errorTitle')} tone="error" />;
  if (!snapshot) return <AppState copy="Deine Renndaten werden für VORA ausgewertet." title={t('pending')} tone="loading" />;

  const metrics: Array<[MessageKey, number | string]> = [
    ['vora.starts', snapshot.career.starts], ['vora.wins', snapshot.career.wins], ['vora.podiums', snapshot.career.podiums],
    ['vora.averageFinish', snapshot.career.average_finish ? formatNumber(snapshot.career.average_finish, { maximumFractionDigits: 1 }) : t('vora.noAverage')],
  ];

  return <main className="vora-page" id="main-content">
    <header className="vora-header"><div><p className="section-label">{t('vora.eyebrow')}</p><h1>{t('vora.title')}</h1><p>{t('vora.copy')}</p></div></header>
    <section className="vora-insight" aria-labelledby="vora-insight-title"><div className="vora-avatar" aria-hidden="true">V</div><div><p>{t('vora.currentInsight')}</p><h2 id="vora-insight-title">{t(snapshot.insight.title_key as MessageKey)}</h2><p>{t(snapshot.insight.body_key as MessageKey)}</p></div></section>
    <section className="vora-racing-line" aria-label={t('vora.career')}>
      {metrics.map(([key, value]) => <div key={key}><span>{t(key)}</span><strong>{typeof value === 'number' ? formatNumber(value) : value}</strong></div>)}
      <div className="vora-progression"><span>{t('vora.progression')}</span><strong>{t('vora.levelRank', { level: snapshot.progression.level, rank: snapshot.progression.rank })}</strong><small>{t('vora.nextLevel', { xp: formatNumber(snapshot.progression.xp_to_next_level) })}</small></div>
      <div><span>{t('vora.activeChallenges')}</span><strong>{formatNumber(snapshot.active_challenges)}</strong></div>
    </section>
  </main>;
}
