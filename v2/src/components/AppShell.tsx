import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { RuntimeEnvironment } from '../config/environment';
import { DriverHomePage } from '../driver/DriverHomePage';
import { useFeatureFlags } from '../features/FeatureFlagProvider';
import {
  SUPPORTED_LANGUAGES,
  useI18n,
  type Language,
  type MessageKey,
} from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';

const StewardWorkspacePage = lazy(() => import('../stewarding/StewardWorkspacePage').then((module) => ({ default: module.StewardWorkspacePage })));
const AdminWorkspacePage = lazy(() => import('../operations/AdminWorkspacePage').then((module) => ({ default: module.AdminWorkspacePage })));
const OwnerControlPage = lazy(() => import('../operations/OwnerControlPage').then((module) => ({ default: module.OwnerControlPage })));
const NotificationCenterPage = lazy(() => import('../operations/NotificationCenterPage').then((module) => ({ default: module.NotificationCenterPage })));
const VoraPage = lazy(() => import('../vora/VoraPage').then((module) => ({ default: module.VoraPage })));
const GraphicsStudioPage = lazy(() => import('../graphics/GraphicsStudioPage').then((module) => ({ default: module.GraphicsStudioPage })));
const DemoE2EPage = lazy(() => import('../demo/DemoE2EPage').then((module) => ({ default: module.DemoE2EPage })));

type IconName = 'admin' | 'bell' | 'career' | 'home' | 'owner' | 'profile' | 'racing' | 'steward' | 'vora';

export const DRIVER_NAV_ITEMS: ReadonlyArray<{
  icon: IconName;
  key: MessageKey;
  path: string;
}> = [
  { icon: 'home', key: 'nav.home', path: '/' },
  { icon: 'racing', key: 'nav.racing', path: '/racing' },
  { icon: 'career', key: 'nav.career', path: '/career' },
  { icon: 'vora', key: 'nav.vora', path: '/vora' },
  { icon: 'profile', key: 'nav.profile', path: '/profile' },
];

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4Z" />,
    racing: <><path d="M5 21V4" /><path d="M5 5h11l-2 4 2 4H5" /></>,
    career: <><path d="M4 20V9" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M3 20h18" /></>,
    vora: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5Z" /><path d="m18 16 .7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7Z" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-4 3.3-6 8-6s7.3 2 8 6" /></>,
    steward: <><path d="M12 3 5 6v5c0 4.5 2.7 8 7 10 4.3-2 7-5.5 7-10V6Z" /><path d="m9 12 2 2 4-5" /></>,
    admin: <><path d="M4 5h16v14H4Z" /><path d="M4 9h16M9 9v10" /></>,
    owner: <><path d="m12 3 2.2 4.6 5.1.7-3.7 3.6.9 5.1-4.5-2.4L7.5 17l.9-5.1-3.7-3.6 5.1-.7Z" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  };
  return (
    <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

function DriverNavigation({ mobile = false }: { mobile?: boolean }) {
  const { t } = useI18n();
  return (
    <nav className={mobile ? 'bottom-navigation' : 'driver-navigation'} aria-label={t('nav.driver')}>
      {DRIVER_NAV_ITEMS.map((item) => (
        <NavLink
          className={({ isActive }) => isActive ? 'nav-item nav-item--active' : 'nav-item'}
          end={item.path === '/'}
          key={item.path}
          to={item.path}
        >
          <NavIcon name={item.icon} />
          <span>{t(item.key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function roleLabel(role: ReturnType<typeof useRole>['role'], t: ReturnType<typeof useI18n>['t']) {
  if (role === 'driver') return t('driverRole');
  if (role === 'steward') return t('stewardRole');
  if (role === 'league_admin') return t('leagueAdminRole');
  if (role === 'platform_owner') return t('platformOwnerRole');
  return t('noRole');
}

function RoutePlaceholder({
  copyKey,
  titleKey,
}: {
  copyKey: MessageKey;
  titleKey: MessageKey;
}) {
  const { t } = useI18n();
  return (
    <main className="route-placeholder" id="main-content">
      <p className="section-label">{t('staging')}</p>
      <h1>{t(titleKey)}</h1>
      <p>{t(copyKey)}</p>
      <NavLink className="text-link" to="/">{t('route.backHome')}<span aria-hidden="true">→</span></NavLink>
    </main>
  );
}

export function AppShell({ environment }: { environment: RuntimeEnvironment }) {
  const { language, setLanguage, t } = useI18n();
  const { leagueSlug } = useLeague();
  const { loading: roleLoading, role } = useRole();
  const features = useFeatureFlags();
  const { signOut, user } = useAuth();
  const canSteward = features.stewardWorkspace && (role === 'steward' || role === 'league_admin' || role === 'platform_owner');
  const canAdmin = features.leagueAdmin && (role === 'league_admin' || role === 'platform_owner');
  const canOwner = features.ownerControl && role === 'platform_owner';
  const canNotify = features.notificationsV2 && Boolean(user);
  const canCreateGraphics = canAdmin && features.socialGraphics;

  return (
    <div className="app-shell">
      <aside className="app-rail">
        <NavLink className="brand" to="/" aria-label={t('nav.home')}>
          <span className="brand-symbol" aria-hidden="true">RV</span>
          <span className="brand-copy"><strong>{t('product')}</strong><small>{t('staging')}</small></span>
        </NavLink>
        <DriverNavigation />
        {canSteward && <NavLink className={({ isActive }) => isActive ? 'nav-item nav-item--active steward-nav-item' : 'nav-item steward-nav-item'} to="/stewarding"><NavIcon name="steward" /><span>{t('nav.stewarding')}</span></NavLink>}
        {canAdmin && <NavLink className={({ isActive }) => isActive ? 'nav-item nav-item--active operations-nav-item' : 'nav-item operations-nav-item'} to="/admin"><NavIcon name="admin" /><span>{t('nav.admin')}</span></NavLink>}
        {canOwner && <NavLink className={({ isActive }) => isActive ? 'nav-item nav-item--active operations-nav-item' : 'nav-item operations-nav-item'} to="/owner"><NavIcon name="owner" /><span>{t('nav.owner')}</span></NavLink>}
        <div className="rail-status">
          <i aria-hidden="true" />
          <span>{environment.appEnvironment}</span>
        </div>
      </aside>

      <div className="shell-frame">
        <header className="topbar">
          <div className="tenant-context">
            <span>{t('shell.leagueContext')}</span>
            <strong>{leagueSlug}</strong>
          </div>
          <div className="topbar-actions">
            {canAdmin && <NavLink className="mobile-operations-link" to="/admin" aria-label={t('nav.admin')}><NavIcon name="admin" /></NavLink>}
            {canOwner && <NavLink className="mobile-operations-link" to="/owner" aria-label={t('nav.owner')}><NavIcon name="owner" /></NavLink>}
            {canNotify && <NavLink className="topbar-icon-link" to="/notifications" aria-label={t('nav.notifications')}><NavIcon name="bell" /></NavLink>}
            {canSteward && <NavLink className="mobile-steward-link" to="/stewarding" aria-label={t('nav.stewarding')}><NavIcon name="steward" /></NavLink>}
            <span className="role-chip">{roleLoading ? t('pending') : roleLabel(role, t)}</span>
            <label className="language-control">
              <span>{t('language')}</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
                {SUPPORTED_LANGUAGES.map((item) => (
                  <option key={item} value={item}>{t(('languageName.' + item) as MessageKey)}</option>
                ))}
              </select>
            </label>
            {user ? (
              <button className="account-action" type="button" onClick={() => void signOut()}>
                <NavIcon name="profile" />
                <span>{t('shell.signOut')}</span>
              </button>
            ) : (
              <span className="session-state">{t('signedOut')}</span>
            )}
          </div>
        </header>

        <Routes>
          <Route path="/" element={<DriverHomePage />} />
          <Route path="/racing" element={<RoutePlaceholder titleKey="route.racingTitle" copyKey="route.racingCopy" />} />
          <Route path="/career" element={<RoutePlaceholder titleKey="route.careerTitle" copyKey="route.careerCopy" />} />
          <Route path="/vora" element={<Suspense fallback={<main className="driver-state"><span className="state-mark">V</span><div><h1>{t('pending')}</h1></div></main>}><VoraPage /></Suspense>} />
          <Route path="/profile" element={<RoutePlaceholder titleKey="route.profileTitle" copyKey="route.profileCopy" />} />
          <Route path="/stewarding" element={<Suspense fallback={<main className="driver-state"><span className="state-mark">16</span><div><h1>{t('pending')}</h1></div></main>}><StewardWorkspacePage /></Suspense>} />
          <Route path="/admin" element={canAdmin ? <Suspense fallback={<main className="driver-state"><span className="state-mark">17</span><div><h1>{t('pending')}</h1></div></main>}><AdminWorkspacePage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/graphics" element={canCreateGraphics ? <Suspense fallback={<main className="driver-state"><span className="state-mark">21</span><div><h1>{t('pending')}</h1></div></main>}><GraphicsStudioPage /></Suspense> : <Navigate replace to="/admin" />} />
          <Route path="/owner" element={canOwner ? <Suspense fallback={<main className="driver-state"><span className="state-mark">18</span><div><h1>{t('pending')}</h1></div></main>}><OwnerControlPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/owner/demo" element={canOwner ? <Suspense fallback={<main className="driver-state"><span className="state-mark">22</span><div><h1>{t('pending')}</h1></div></main>}><DemoE2EPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/notifications" element={canNotify ? <Suspense fallback={<main className="driver-state"><span className="state-mark">19</span><div><h1>{t('pending')}</h1></div></main>}><NotificationCenterPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>

        <footer className="footer">
          <span>{t('footerTitle')}</span>
          <span>{t('shell.footerCopy')}</span>
        </footer>
      </div>

      <DriverNavigation mobile />
    </div>
  );
}
