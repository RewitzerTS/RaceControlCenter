import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppState } from '../components/AppState';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { loadOwnerSnapshot, setPlatformFlag, type OwnerSnapshot } from './operations';

export function OwnerControlPage() {
  const { client, setLeagueSlug } = useLeague();
  const { role } = useRole();
  const { formatNumber, t } = useI18n();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<OwnerSnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (role !== 'platform_owner') return;
    let active = true;
    void loadOwnerSnapshot(client).then((data) => { if (active) setSnapshot(data); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [client, role]);

  async function toggleFlag(key: string, enabled: boolean) {
    if (!snapshot) return;
    setSnapshot({ ...snapshot, flags: snapshot.flags.map((flag) => flag.key === key ? { ...flag, enabled } : flag) });
    try { await setPlatformFlag(client, key, enabled); } catch { setError(true); void loadOwnerSnapshot(client).then(setSnapshot); }
  }

  if (role !== 'platform_owner') return <AppState copy="Dieser Bereich ist ausschließlich für den Platform Owner verfügbar." title={t('owner.denied')} tone="denied" />;
  if (error && !snapshot) return <AppState action={<button className="text-action" onClick={() => window.location.reload()} type="button">Erneut versuchen</button>} copy="Die Plattformübersicht konnte nicht abgerufen werden." title={t('owner.error')} tone="error" />;
  if (!snapshot) return <AppState copy="Ligen, Systemstatus und Feature-Schalter werden geladen." title={t('pending')} tone="loading" />;

  const metrics: Array<[MessageKey, number]> = [['owner.leagues', snapshot.counts.leagues ?? 0], ['owner.globalDrivers', snapshot.counts.global_drivers ?? 0], ['owner.processing', snapshot.counts.pending_jobs], ['owner.errors', snapshot.counts.failed_jobs]];
  return <main className="operations-page" id="main-content">
    <div className="owner-mode" role="status">{t('owner.control')}</div>
    <header className="operations-header"><div><p className="section-label">{t('owner.eyebrow')}</p><h1>{t('owner.title')}</h1><p>{t('owner.copy')}</p></div></header>
    <section className="operations-metrics" aria-label={t('overview')}>{metrics.map(([key, value]) => <div key={key}><strong>{formatNumber(value)}</strong><span>{t(key)}</span></div>)}</section>
    <div className="owner-grid">
      <section className="owner-leagues"><h2>{t('owner.leagues')}</h2><div className="responsive-table responsive-table--records" role="region" tabIndex={0}><table><thead><tr><th>{t('owner.league')}</th><th>{t('owner.status')}</th><th>{t('owner.action')}</th></tr></thead><tbody>{snapshot.leagues.map((league) => <tr key={league.id}><td data-label={t('owner.league')} data-mobile-primary="true"><strong>{league.name}</strong><small>{league.slug}</small></td><td data-label={t('owner.status')}>{league.status}</td><td data-label={t('owner.action')}><button type="button" onClick={() => { setLeagueSlug(league.slug); navigate(league.slug === 'demo' ? '/owner/demo' : '/admin'); }}>{league.slug === 'demo' ? t('owner.openDemo') : t('owner.open')}</button></td></tr>)}</tbody></table></div></section>
      <section className="owner-flags"><h2>{t('owner.featureFlags')}</h2>{snapshot.flags.map((flag) => <label key={flag.key}><span><strong>{flag.key}</strong><small>{t('owner.flagCopy')}</small></span><input type="checkbox" checked={flag.enabled} onChange={(event) => void toggleFlag(flag.key, event.target.checked)} /></label>)}</section>
    </div>
    {error && <p className="inline-error" role="alert">{t('owner.updateError')}</p>}
  </main>;
}
