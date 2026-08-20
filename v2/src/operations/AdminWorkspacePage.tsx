import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { loadAdminSnapshot, type AdminSnapshot } from './operations';

const ADMIN_AREAS: Array<{ title: MessageKey; items: Array<{ key: MessageKey; to?: string }> }> = [
  { title: 'admin.raceOps', items: ['admin.races', 'admin.results', 'admin.import', 'admin.standings', 'admin.championship'].map((key) => ({ key: key as MessageKey })) },
  { title: 'admin.participants', items: ['admin.drivers', 'admin.teams', 'admin.users'].map((key) => ({ key: key as MessageKey })) },
  { title: 'admin.stewarding', items: ['admin.cases', 'admin.rules'].map((key) => ({ key: key as MessageKey })) },
  { title: 'admin.content', items: [{ key: 'admin.graphics', to: '/admin/graphics' }, { key: 'admin.publishing' }] },
  { title: 'admin.league', items: ['admin.settings', 'admin.branding', 'admin.permissions', 'admin.audit'].map((key) => ({ key: key as MessageKey })) },
];

export function AdminWorkspacePage() {
  const { client } = useLeague();
  const { role } = useRole();
  const { formatDate, formatNumber, t } = useI18n();
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [error, setError] = useState(false);
  const allowed = role === 'league_admin' || role === 'platform_owner';

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void loadAdminSnapshot(client).then((data) => { if (active) setSnapshot(data); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [allowed, client]);

  if (!allowed) return <main className="driver-state" id="main-content"><span className="state-mark">17</span><div><h1>{t('admin.deniedTitle')}</h1><p>{t('admin.deniedCopy')}</p></div></main>;
  if (error) return <main className="driver-state" id="main-content"><span className="state-mark">!</span><div><h1>{t('admin.error')}</h1></div></main>;
  if (!snapshot) return <main className="driver-state" id="main-content"><span className="state-mark">17</span><div><h1>{t('pending')}</h1></div></main>;

  const metrics: Array<[MessageKey, number]> = [
    ['admin.races', snapshot.counts.races ?? 0], ['admin.drivers', snapshot.counts.drivers ?? 0],
    ['admin.users', snapshot.counts.members ?? 0], ['admin.openCases', snapshot.counts.open_steward_cases ?? 0],
    ['admin.pendingJobs', snapshot.counts.pending_jobs], ['admin.failedJobs', snapshot.counts.failed_jobs],
  ];

  return <main className="operations-page" id="main-content">
    {role === 'platform_owner' && <div className="owner-mode" role="status">{t('owner.mode')}</div>}
    <header className="operations-header"><div><p className="section-label">{t('admin.eyebrow')}</p><h1>{snapshot.league.name}</h1><p>{t('admin.copy')}</p></div><NavLink className="text-link" to="/">{t('admin.exit')}<span aria-hidden="true">→</span></NavLink></header>
    <section className="operations-metrics" aria-label={t('overview')}>{metrics.map(([key, value]) => <div key={key}><strong>{formatNumber(value)}</strong><span>{t(key)}</span></div>)}</section>
    <div className="operations-layout">
      <nav className="operations-menu" aria-label={t('admin.navigation')}>{ADMIN_AREAS.map((area) => <section key={area.title}><h2>{t(area.title)}</h2>{area.items.map((item) => item.to ? <NavLink key={item.key} to={item.to}>{t(item.key)}<span aria-hidden="true">→</span></NavLink> : <button key={item.key} type="button">{t(item.key)}<span aria-hidden="true">→</span></button>)}</section>)}</nav>
      <section className="operations-feed"><h2>{t('admin.recentAudit')}</h2>{snapshot.recent_audit.length ? <ol>{snapshot.recent_audit.map((item) => <li key={item.id}><div><strong>{item.action}</strong><span>{item.entity_type}</span></div><time dateTime={item.occurred_at}>{formatDate(item.occurred_at)}</time></li>)}</ol> : <p className="empty-copy">{t('admin.noAudit')}</p>}</section>
    </div>
  </main>;
}
