import type { ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { adminOverviewCopy } from './adminOverviewCopy';
import './adminOverview.css';

const areas = [
  { key: 'overview', to: '/admin', paths: ['/admin'], items: [] },
  { key: 'season', to: '/admin/races', paths: ['/admin/races', '/admin/season/setup', '/admin/results', '/admin/results/import', '/admin/standings', '/admin/graphics'], items: [
    { key: 'admin.races', to: '/admin/races' }, { key: 'admin.results', to: '/admin/results' }, { key: 'admin.import', to: '/admin/results/import' }, { key: 'admin.standings', to: '/admin/standings' }, { key: 'admin.graphics', to: '/admin/graphics' }, { key: 'admin.seasonSetup', to: '/admin/season/setup' }, { key: 'admin.cases', to: '/stewarding' },
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
  if (!enabled) return children;
  const active = areas.find(area => (area.paths as readonly string[]).includes(pathname)) ?? areas[0];
  return <div className="admin-layout">
    <nav className="admin-side-nav" aria-label={c.area}>
      <span className="admin-nav-title">{c.title}</span>
      <div className="admin-desktop-sections">{areas.map(area => <Link key={area.key} to={area.to} aria-current={area === active ? 'page' : undefined} className={area === active ? 'admin-area-active' : ''}>{c[area.key]}</Link>)}</div>
      <label className="admin-mobile-sections">{c.area}<select value={active.to} onChange={event => navigate(event.target.value)}>{areas.map(area => <option key={area.key} value={area.to}>{c[area.key]}</option>)}</select></label>
      {active.items.length > 0 && <div className="admin-section-links">{active.items.map(item => <NavLink end key={item.to} to={item.to}>{t(item.key as MessageKey)}</NavLink>)}</div>}
      <NavLink end className={`admin-history-link${active.key === 'overview' ? ' admin-history-overview' : ''}`} to="/admin/audit">{c.changes}</NavLink>
    </nav>
    <div className="admin-layout-content">{children}</div>
  </div>;
}
