import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import raceVoraMark from '../../../assets/images/racevora-mark.svg';
import { useAuth } from '../auth/AuthProvider';
import { BetaAccessPage } from '../auth/BetaAccessPage';
import { AuthLinkPage } from '../auth/AuthLinkPage';
import type { RuntimeEnvironment } from '../config/environment';
import { DriverHomePage } from '../driver/DriverHomePage';
import { RacingPage } from '../driver/RacingPage';
import { useFeatureFlags } from '../features/FeatureFlagProvider';
import {
  SUPPORTED_LANGUAGES,
  useI18n,
  type Language,
  type MessageKey,
} from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { fallbackLeagueBranding, shouldUseStandardRaceVoraBranding } from '../league/leagueBranding';
import { useRole } from '../roles/RoleProvider';

const StewardWorkspacePage = lazy(() => import('../stewarding/StewardWorkspacePage').then((module) => ({ default: module.StewardWorkspacePage })));
const CareerPage = lazy(() => import('../driver/CareerPage').then((module) => ({ default: module.CareerPage })));
const ProfilePage = lazy(() => import('../driver/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const AdminWorkspacePage = lazy(() => import('../operations/AdminWorkspacePage').then((module) => ({ default: module.AdminWorkspacePage })));
const LeagueBrandingPage = lazy(() => import('../operations/LeagueBrandingPage').then((module) => ({ default: module.LeagueBrandingPage })));
const LeagueMembersPage = lazy(() => import('../operations/LeagueMembersPage').then((module) => ({ default: module.LeagueMembersPage })));
const LeagueDriversPage = lazy(() => import('../operations/LeagueDriversPage').then((module) => ({ default: module.LeagueDriversPage })));
const LeagueRacesPage = lazy(() => import('../operations/LeagueRacesPage').then((module) => ({ default: module.LeagueRacesPage })));
const LeagueTeamsPage = lazy(() => import('../operations/V1CompletionPages').then((module) => ({ default: module.LeagueTeamsPage })));
const LeagueRulesPage = lazy(() => import('../operations/V1CompletionPages').then((module) => ({ default: module.LeagueRulesPage })));
const ResultImportPage = lazy(() => import('../operations/V1CompletionPages').then((module) => ({ default: module.ResultImportPage })));
const LeagueAuditPage = lazy(() => import('../operations/V1CompletionPages').then((module) => ({ default: module.LeagueAuditPage })));
const LeagueCreatePage = lazy(() => import('../operations/LeagueCreatePage').then((module) => ({ default: module.LeagueCreatePage })));
const OwnerControlPage = lazy(() => import('../operations/OwnerControlPage').then((module) => ({ default: module.OwnerControlPage })));
const NotificationCenterPage = lazy(() => import('../operations/NotificationCenterPage').then((module) => ({ default: module.NotificationCenterPage })));
const VoraPage = lazy(() => import('../vora/VoraPage').then((module) => ({ default: module.VoraPage })));
const GraphicsStudioPage = lazy(() => import('../graphics/GraphicsStudioPage').then((module) => ({ default: module.GraphicsStudioPage })));
const DemoE2EPage = lazy(() => import('../demo/DemoE2EPage').then((module) => ({ default: module.DemoE2EPage })));

type IconName = 'admin' | 'bell' | 'career' | 'home' | 'league' | 'owner' | 'profile' | 'racing' | 'steward' | 'vora';

export const DRIVER_NAV_ITEMS: ReadonlyArray<{
  icon: IconName;
  key: MessageKey;
  path: string;
}> = [
  { icon: 'home', key: 'nav.home', path: '/home' },
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
    league: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
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

function DriverNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  const { leagueSlug } = useLeague();
  return (
    <div className="driver-navigation" aria-label={t('nav.driver')}>
      {DRIVER_NAV_ITEMS.map((item) => (
        <NavLink
          className={({ isActive }) => isActive ? 'nav-item nav-item--active' : 'nav-item'}
          end={item.path === '/home'}
          key={item.path}
          onClick={onNavigate}
          to={item.path}
        >
          <NavIcon name={item.icon} />
          <span>{t(item.key)}</span>
        </NavLink>
      ))}
      <a className="nav-item nav-item--public" href={`/race-hub?league=${encodeURIComponent(leagueSlug)}`} onClick={onNavigate}>
        <NavIcon name="league" />
        <span>{t('nav.league')}</span>
      </a>
    </div>
  );
}

function roleLabel(role: ReturnType<typeof useRole>['role'], t: ReturnType<typeof useI18n>['t']) {
  if (role === 'driver') return t('driverRole');
  if (role === 'steward') return t('stewardRole');
  if (role === 'league_admin') return t('leagueAdminRole');
  if (role === 'platform_owner') return t('platformOwnerRole');
  return t('noRole');
}

export function AppShell({ environment }: { environment: RuntimeEnvironment }) {
  const location = useLocation();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const { language, setLanguage, t } = useI18n();
  const { branding, leagueSlug } = useLeague();
  const { loading: roleLoading, role } = useRole();
  const features = useFeatureFlags();
  const { loading: authLoading, signOut, user } = useAuth();
  const displayBranding = shouldUseStandardRaceVoraBranding({
    authenticated: Boolean(user),
    authLoading,
    leagueSlug,
    pathname: location.pathname,
    search: location.search,
  }) ? fallbackLeagueBranding('racevora') : branding;
  const canSteward = features.stewardWorkspace && (role === 'steward' || role === 'league_admin' || role === 'platform_owner');
  // V1 administration is now core product functionality. The resolved role
  // gates the routes here; every mutation is authorized again by its RPC.
  const canAdmin = role === 'league_admin' || role === 'platform_owner';
  const canOwner = features.ownerControl && role === 'platform_owner';
  const canNotify = features.notificationsV2 && Boolean(user);
  const canCreateGraphics = canAdmin && features.socialGraphics;
  const accessLoading = authLoading || roleLoading;
  const embeddedAccess = location.pathname === '/login' && new URLSearchParams(location.search).get('embed') === '1';
  const closeNavigation = () => setNavigationOpen(false);

  return (
    <div className={embeddedAccess ? 'app-shell app-shell--embedded-access' : 'app-shell'}>
      {!embeddedAccess && <header className="site-header">
        <div className="header-inner container">
        <NavLink className="brand" to="/home" onClick={closeNavigation}>
          <img className="brand-logo" src={displayBranding.logoUrl || raceVoraMark} alt="" />
          <span className="brand-text">
            <strong className="brand-title">{displayBranding.name || 'RaceVora'}</strong>
            <small className="brand-subtitle">{displayBranding.subtitle || 'Race Management Platform'}</small>
          </span>
        </NavLink>

        <button
          aria-controls="main-navigation"
          aria-expanded={navigationOpen}
          aria-label={navigationOpen ? 'Navigation schließen' : 'Navigation öffnen'}
          className="mobile-toggle"
          onClick={() => setNavigationOpen((current) => !current)}
          type="button"
        >
          <span className="mobile-toggle__icon"><span /><span /><span /></span>
        </button>

        <nav className={navigationOpen ? 'main-navigation main-nav main-navigation--open' : 'main-navigation main-nav'} id="main-navigation" aria-label={t('nav.driver')}>
          <DriverNavigation onNavigate={closeNavigation} />
          <div className="privileged-navigation">
            {canSteward && <NavLink onClick={closeNavigation} className={({ isActive }) => isActive ? 'nav-item nav-item--active steward-nav-item' : 'nav-item steward-nav-item'} to="/stewarding"><NavIcon name="steward" /><span>{t('nav.stewarding')}</span></NavLink>}
            {canAdmin && <NavLink onClick={closeNavigation} className={({ isActive }) => isActive ? 'nav-item nav-item--active operations-nav-item' : 'nav-item operations-nav-item'} to="/admin"><NavIcon name="admin" /><span>{t('nav.admin')}</span></NavLink>}
            {canOwner && <NavLink onClick={closeNavigation} className={({ isActive }) => isActive ? 'nav-item nav-item--active operations-nav-item' : 'nav-item operations-nav-item'} to="/owner"><NavIcon name="owner" /><span>{t('nav.owner')}</span></NavLink>}
          </div>
          <div className="header-tools">
            {canNotify && <NavLink onClick={closeNavigation} className="topbar-icon-link" to="/notifications" aria-label={t('nav.notifications')}><NavIcon name="bell" /><span>{t('nav.notifications')}</span></NavLink>}
            <span className="role-chip">{roleLoading ? t('pending') : roleLabel(role, t)}</span>
            <label className="language-control" htmlFor="language-selector">
              <span>{t('language')}</span>
              <select id="language-selector" name="language" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
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
              <NavLink className="session-state session-state--link" onClick={closeNavigation} to="/login?mode=signin">{t('beta.action')}</NavLink>
            )}
          </div>
        </nav>
        </div>
      </header>}

      {!embeddedAccess && <section className="status-strip v2-status-strip" aria-label={t('shell.leagueContext')}>
        <article className="status-pill-card">
          <i className="status-dot" aria-hidden="true" />
          <span className="status-copy"><strong>{t('shell.leagueContext')}</strong><span>{leagueSlug}</span></span>
        </article>
        <article className="status-pill-card">
          <i className="status-dot violet" aria-hidden="true" />
          <span className="status-copy"><strong>{t('authorization')}</strong><span>{roleLoading ? t('pending') : roleLabel(role, t)}</span></span>
        </article>
        <article className="status-pill-card">
          <i className="status-dot gold" aria-hidden="true" />
          <span className="status-copy"><strong>{t('environment')}</strong><span>{environment.appEnvironment}</span></span>
        </article>
        <article className="status-pill-card">
          <i className={user ? 'status-dot' : 'status-dot inactive'} aria-hidden="true" />
          <span className="status-copy"><strong>{t('session')}</strong><span>{user ? roleLabel(role, t) : t('signedOut')}</span></span>
        </article>
      </section>}

      <div className={embeddedAccess ? 'shell-frame shell-frame--embedded-access' : 'shell-frame'}>

        <Routes>
          <Route path="/" element={<Navigate replace to="/home" />} />
          <Route path="/home" element={<DriverHomePage />} />
          <Route path="/racing" element={<RacingPage />} />
          <Route path="/career" element={<Suspense fallback={<main className="driver-state"><span className="state-mark">C</span><div><h1>{t('pending')}</h1></div></main>}><CareerPage /></Suspense>} />
          <Route path="/vora" element={<Suspense fallback={<main className="driver-state"><span className="state-mark">V</span><div><h1>{t('pending')}</h1></div></main>}><VoraPage /></Suspense>} />
          <Route path="/profile" element={<Suspense fallback={<main className="driver-state"><span className="state-mark">P</span><div><h1>{t('pending')}</h1></div></main>}><ProfilePage /></Suspense>} />
          <Route path="/login" element={<BetaAccessPage appEnvironment={environment.appEnvironment} />} />
          <Route path="/beta" element={<BetaAccessPage appEnvironment={environment.appEnvironment} />} />
          <Route path="/auth/confirm" element={<AuthLinkPage appEnvironment={environment.appEnvironment} mode="confirm" />} />
          <Route path="/auth/reset" element={<AuthLinkPage appEnvironment={environment.appEnvironment} mode="reset" />} />
          <Route path="/stewarding" element={accessLoading ? <main className="driver-state"><span className="state-mark">16</span><div><h1>{t('pending')}</h1></div></main> : canSteward ? <Suspense fallback={<main className="driver-state"><span className="state-mark">16</span><div><h1>{t('pending')}</h1></div></main>}><StewardWorkspacePage /></Suspense> : <Navigate replace to="/home" />} />
          <Route path="/admin" element={accessLoading ? <main className="driver-state"><span className="state-mark">17</span><div><h1>{t('pending')}</h1></div></main> : canAdmin ? <Suspense fallback={<main className="driver-state"><span className="state-mark">17</span><div><h1>{t('pending')}</h1></div></main>}><AdminWorkspacePage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/branding" element={accessLoading ? <main className="driver-state"><span className="state-mark">B</span><div><h1>{t('pending')}</h1></div></main> : canAdmin ? <Suspense fallback={<main className="driver-state"><span className="state-mark">B</span><div><h1>{t('pending')}</h1></div></main>}><LeagueBrandingPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/users" element={accessLoading ? <main className="driver-state"><span className="state-mark">U</span><div><h1>{t('pending')}</h1></div></main> : canAdmin ? <Suspense fallback={<main className="driver-state"><span className="state-mark">U</span><div><h1>{t('pending')}</h1></div></main>}><LeagueMembersPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/drivers" element={accessLoading ? <main className="driver-state"><span className="state-mark">D</span><div><h1>{t('pending')}</h1></div></main> : canAdmin ? <Suspense fallback={<main className="driver-state"><span className="state-mark">D</span><div><h1>{t('pending')}</h1></div></main>}><LeagueDriversPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/races" element={accessLoading ? <main className="driver-state"><span className="state-mark">R</span><div><h1>{t('pending')}</h1></div></main> : canAdmin ? <Suspense fallback={<main className="driver-state"><span className="state-mark">R</span><div><h1>{t('pending')}</h1></div></main>}><LeagueRacesPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/results" element={accessLoading ? <main className="driver-state"><span className="state-mark">R</span><div><h1>{t('pending')}</h1></div></main> : canAdmin ? <Suspense fallback={<main className="driver-state"><span className="state-mark">R</span><div><h1>{t('pending')}</h1></div></main>}><LeagueRacesPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/standings" element={accessLoading ? <main className="driver-state"><span className="state-mark">W</span><div><h1>{t('pending')}</h1></div></main> : canAdmin ? <Suspense fallback={<main className="driver-state"><span className="state-mark">W</span><div><h1>{t('pending')}</h1></div></main>}><LeagueRacesPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/teams" element={accessLoading ? <main className="driver-state"><span className="state-mark">T</span><div><h1>{t('pending')}</h1></div></main> : canAdmin ? <Suspense fallback={<main className="driver-state"><span className="state-mark">T</span><div><h1>{t('pending')}</h1></div></main>}><LeagueTeamsPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/rules" element={accessLoading ? <main className="driver-state"><span className="state-mark">§</span><div><h1>{t('pending')}</h1></div></main> : canAdmin ? <Suspense fallback={<main className="driver-state"><span className="state-mark">§</span><div><h1>{t('pending')}</h1></div></main>}><LeagueRulesPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/results/import" element={accessLoading ? <main className="driver-state"><span className="state-mark">I</span><div><h1>{t('pending')}</h1></div></main> : canAdmin ? <Suspense fallback={<main className="driver-state"><span className="state-mark">I</span><div><h1>{t('pending')}</h1></div></main>}><ResultImportPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/audit" element={accessLoading ? <main className="driver-state"><span className="state-mark">A</span><div><h1>{t('pending')}</h1></div></main> : canAdmin ? <Suspense fallback={<main className="driver-state"><span className="state-mark">A</span><div><h1>{t('pending')}</h1></div></main>}><LeagueAuditPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/graphics" element={accessLoading ? <main className="driver-state"><span className="state-mark">21</span><div><h1>{t('pending')}</h1></div></main> : canCreateGraphics ? <Suspense fallback={<main className="driver-state"><span className="state-mark">21</span><div><h1>{t('pending')}</h1></div></main>}><GraphicsStudioPage /></Suspense> : <Navigate replace to="/admin" />} />
          <Route path="/owner" element={accessLoading ? <main className="driver-state"><span className="state-mark">18</span><div><h1>{t('pending')}</h1></div></main> : canOwner ? <Suspense fallback={<main className="driver-state"><span className="state-mark">18</span><div><h1>{t('pending')}</h1></div></main>}><OwnerControlPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/owner/leagues/new" element={accessLoading ? <main className="driver-state"><span className="state-mark">L</span><div><h1>{t('pending')}</h1></div></main> : canOwner ? <Suspense fallback={<main className="driver-state"><span className="state-mark">L</span><div><h1>{t('pending')}</h1></div></main>}><LeagueCreatePage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/owner/demo" element={accessLoading ? <main className="driver-state"><span className="state-mark">22</span><div><h1>{t('pending')}</h1></div></main> : canOwner ? <Suspense fallback={<main className="driver-state"><span className="state-mark">22</span><div><h1>{t('pending')}</h1></div></main>}><DemoE2EPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/notifications" element={authLoading ? <main className="driver-state"><span className="state-mark">19</span><div><h1>{t('pending')}</h1></div></main> : canNotify ? <Suspense fallback={<main className="driver-state"><span className="state-mark">19</span><div><h1>{t('pending')}</h1></div></main>}><NotificationCenterPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="*" element={<Navigate replace to="/home" />} />
        </Routes>

        {!embeddedAccess && <footer className="footer">
          <span>{t('footerTitle')}</span>
          <span>{t('shell.footerCopy')}</span>
        </footer>}
      </div>
    </div>
  );
}

