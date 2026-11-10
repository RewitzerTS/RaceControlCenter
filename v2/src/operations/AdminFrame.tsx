import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { adminOverviewCopy } from './adminOverviewCopy';
import './adminOverview.css';

const areas = [
  { key: 'overview', to: '/admin', paths: ['/admin'], items: [] },
  { key: 'season', to: '/admin/races', paths: ['/admin/races', '/admin/season/setup', '/admin/results', '/admin/results/import', '/admin/standings', '/admin/reverse-grid', '/admin/graphics'], items: [
    { key: 'admin.races', to: '/admin/races' }, { key: 'admin.results', to: '/admin/results' }, { key: 'admin.import', to: '/admin/results/import' }, { key: 'admin.standings', to: '/admin/standings' }, { key: 'admin.reverseGrid', to: '/admin/reverse-grid' }, { key: 'admin.graphics', to: '/admin/graphics' }, { key: 'admin.seasonSetup', to: '/admin/season/setup' }, { key: 'admin.cases', to: '/stewarding' },
  ] },
  { key: 'drivers', to: '/admin/drivers', paths: ['/admin/drivers', '/admin/teams', '/admin/teams/legacy'], items: [] },
  { key: 'members', to: '/admin/users', paths: ['/admin/users'], items: [] },
  { key: 'settings', to: '/admin/branding', paths: ['/admin/branding', '/admin/rules', '/admin/audit'], items: [
    { key: 'admin.branding', to: '/admin/branding' }, { key: 'admin.rules', to: '/admin/rules' },
  ] },
] as const;

export function AdminFrame({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { language, t } = useI18n();
  const c = adminOverviewCopy[language];
  const active = areas.find(area => (area.paths as readonly string[]).includes(pathname)) ?? areas[0];
  const [expanded, setExpanded] = useState<string | null>(active.items.length ? active.key : null);
  useEffect(() => { setExpanded(active.items.length ? active.key : null); }, [pathname, active.key, active.items.length]);
  if (!enabled) return children;
  return <div className="admin-layout">
    <nav className="admin-side-nav" aria-label={c.area}>
      <span className="admin-nav-title">{c.title}</span>
      <div className="admin-desktop-sections">{areas.map(area => <div className="admin-nav-group" key={area.key}>
        {area.items.length ? <>
          <button type="button" className={`admin-area-toggle${area === active ? ' admin-area-active' : ''}`} aria-expanded={expanded === area.key} aria-controls={`admin-subnav-${area.key}`} onClick={() => setExpanded(current => current === area.key ? null : area.key)}>
            <span>{c[area.key]}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
          </button>
          <div className="admin-section-links" id={`admin-subnav-${area.key}`} hidden={expanded !== area.key}>{area.items.map(item => <NavLink end key={item.to} to={item.to}>{t(item.key as MessageKey)}</NavLink>)}</div>
        </> : <Link to={area.to} aria-current={area === active ? 'page' : undefined} className={area === active ? 'admin-area-active' : ''}>{c[area.key]}</Link>}
      </div>)}</div>
      <label className="admin-mobile-sections">{c.area}<select value={active.to} onChange={event => navigate(event.target.value)}>{areas.map(area => <option key={area.key} value={area.to}>{c[area.key]}</option>)}</select></label>
      {active.items.length > 0 && <div className="admin-section-links admin-mobile-subnav">{active.items.map(item => <NavLink end key={item.to} to={item.to}>{t(item.key as MessageKey)}</NavLink>)}</div>}
      <NavLink end className={`admin-history-link${active.key === 'overview' ? ' admin-history-overview' : ''}`} to="/admin/audit">{c.changes}</NavLink>
    </nav>
    <div className="admin-layout-content">{children}</div>
  </div>;
}
