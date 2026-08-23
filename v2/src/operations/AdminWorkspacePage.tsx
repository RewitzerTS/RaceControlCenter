import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { loadAdminSnapshot, type AdminSnapshot } from './operations';

const ADMIN_AREAS: Array<{ title: MessageKey; items: Array<{ key: MessageKey; to: string }> }> = [
  { title: 'admin.league', items: [{ key: 'admin.branding', to: '/admin/branding' }, { key: 'admin.users', to: '/admin/users' }, { key: 'admin.drivers', to: '/admin/drivers' }, { key: 'admin.teams', to: '/admin/teams' }, { key: 'admin.rules', to: '/admin/rules' }] },
  { title: 'admin.raceOps', items: [{ key: 'admin.races', to: '/admin/races' }, { key: 'admin.results', to: '/admin/results' }, { key: 'admin.import', to: '/admin/results/import' }, { key: 'admin.standings', to: '/admin/standings' }, { key: 'admin.cases', to: '/stewarding' }] },
  { title: 'admin.content', items: [{ key: 'admin.graphics', to: '/admin/graphics' }, { key: 'admin.audit', to: '/admin/audit' }] },
];

export function AdminWorkspacePage() {
  const { client } = useLeague();
  const { role } = useRole();
  const { formatDate, t } = useI18n();
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [openAreas, setOpenAreas] = useState<Set<MessageKey>>(() => new Set([ADMIN_AREAS[0].title]));
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

  return <main className="operations-page" id="main-content">
    {role === 'platform_owner' && <div className="owner-mode" role="status">{t('owner.mode')}</div>}
    <p className="section-label operations-eyebrow">{t('admin.eyebrow')}</p>
    <section className="admin-quick-actions" aria-labelledby="admin-quick-actions-title"><h2 id="admin-quick-actions-title">{t('admin.quickActions')}</h2><div><NavLink className="primary-action" to="/admin/results/import">{t('admin.quickImport')}</NavLink><NavLink className="text-link" to="/stewarding">{t('admin.quickSteward')}</NavLink><NavLink className="text-link" to="/admin/races">{t('admin.quickReschedule')}</NavLink><NavLink className="text-link" to="/racing">{t('admin.preview')}</NavLink></div></section>
    <div className="operations-layout">
      <nav className="operations-menu" aria-labelledby="admin-navigation-title">
        <div className="operations-menu-heading">
          <h2 id="admin-navigation-title">{t('admin.navigation')}</h2>
          <NavLink className="primary-action operations-create-league" to="/leagues/new">{t('profile.createLeague')}</NavLink>
        </div>
        <div className="operations-menu-groups">
          {ADMIN_AREAS.map((area) => <details key={area.title} open={openAreas.has(area.title)}><summary onClick={(event) => { event.preventDefault(); setOpenAreas((current) => { const next = new Set(current); if (next.has(area.title)) next.delete(area.title); else next.add(area.title); return next; }); }}>{t(area.title)}</summary><div>{area.items.map((item) => <NavLink key={item.key} to={item.to}>{t(item.key)}</NavLink>)}</div></details>)}
        </div>
      </nav>
      <details className="operations-feed operations-audit">
        <summary>
          <span>{t('admin.recentAudit')}</span>
          <span className="operations-audit-state"><span>{t('admin.auditShow')}</span><span>{t('admin.auditHide')}</span></span>
        </summary>
        <div className="operations-audit-content">{snapshot.recent_audit.length ? <ol>{snapshot.recent_audit.map((item) => <li key={item.id}><div><strong>{item.action}</strong><span>{item.entity_type}</span></div><time dateTime={item.occurred_at}>{formatDate(item.occurred_at)}</time></li>)}</ol> : <p className="empty-copy">{t('admin.noAudit')}</p>}</div>
      </details>
    </div>
  </main>;
}
