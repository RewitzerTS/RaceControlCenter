import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { BetaFeedback } from '../feedback/BetaFeedback';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import raceVoraMark from '../../../assets/images/racevora-logo-color.svg';
import { useAuth } from '../auth/AuthProvider';
import { BetaAccessPage } from '../auth/BetaAccessPage';
import { AuthLinkPage } from '../auth/AuthLinkPage';
import type { RuntimeEnvironment } from '../config/environment';
import { DriverHomePage } from '../driver/DriverHomePage';
import { OnboardingPage } from '../driver/OnboardingPage';
import { RacingPage } from '../driver/RacingPage';
import { useFeatureFlags } from '../features/FeatureFlagProvider';
import {
  SUPPORTED_LANGUAGES,
  useI18n,
  type Language,
  type MessageKey,
} from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { LeagueSwitcher } from '../league/LeagueSwitcher';
import { fallbackLeagueBranding, shouldUseStandardRaceVoraBranding } from '../league/leagueBranding';
import { useRole } from '../roles/RoleProvider';
import { AppState } from './AppState';

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
const SeasonSetupPage = lazy(() => import('../operations/SeasonSetupPage').then((module) => ({ default: module.SeasonSetupPage })));
const OwnerControlPage = lazy(() => import('../operations/OwnerControlPage').then((module) => ({ default: module.OwnerControlPage })));
const InstagramStudioPage = lazy(() => import('../graphics/InstagramStudioPage').then((module) => ({ default: module.InstagramStudioPage })));
const NotificationCenterPage = lazy(() => import('../operations/NotificationCenterPage').then((module) => ({ default: module.NotificationCenterPage })));
const VoraPage = lazy(() => import('../vora/VoraPage').then((module) => ({ default: module.VoraPage })));
const GraphicsStudioPage = lazy(() => import('../graphics/GraphicsStudioPage').then((module) => ({ default: module.GraphicsStudioPage })));
const DemoE2EPage = lazy(() => import('../demo/DemoE2EPage').then((module) => ({ default: module.DemoE2EPage })));

type IconName = 'admin' | 'bell' | 'career' | 'home' | 'league' | 'logout' | 'more' | 'owner' | 'profile' | 'racing' | 'steward' | 'vora';

export const DRIVER_NAV_ITEMS: ReadonlyArray<{
  icon: IconName;
  key: MessageKey;
  mobilePrimary: boolean;
  path: string;
}> = [
  { icon: 'home', key: 'nav.home', mobilePrimary: true, path: '/home' },
  { icon: 'racing', key: 'nav.racing', mobilePrimary: true, path: '/racing' },
  { icon: 'career', key: 'nav.career', mobilePrimary: true, path: '/career' },
  { icon: 'vora', key: 'nav.vora', mobilePrimary: false, path: '/vora' },
];

export const MOBILE_PRIMARY_NAV_ITEMS = DRIVER_NAV_ITEMS.filter((item) => item.mobilePrimary);

export const LEGAL_FOOTER_LINKS: ReadonlyArray<{ href: string; key: MessageKey }> = [
  { href: '/impressum.html', key: 'footer.imprint' },
  { href: '/datenschutz.html', key: 'footer.privacy' },
  { href: '/agb.html', key: 'footer.terms' },
  { href: '/widerruf.html', key: 'footer.withdrawal' },
];

export function shouldUseLeagueBrandLogo(logoUrl: string, failedLogoUrl: string | null): boolean {
  const normalizedLogoUrl = logoUrl.trim();
  return normalizedLogoUrl.length > 0 && normalizedLogoUrl !== failedLogoUrl;
}

export function shouldShowLeagueSwitcher(userId: string | null | undefined): boolean {
  return Boolean(userId);
}

function BrandLogo({ logoUrl }: { logoUrl: string }) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const useLeagueLogo = shouldUseLeagueBrandLogo(logoUrl, failedLogoUrl);
  const source = useLeagueLogo ? logoUrl.trim() : raceVoraMark;

  return (
    <img
      alt=""
      className="brand-logo"
      onError={() => {
        if (useLeagueLogo) setFailedLogoUrl(source);
      }}
      src={source}
    />
  );
}

export function isMobileMoreRoute(pathname: string): boolean {
  return ['/vora', '/stewarding', '/admin', '/owner', '/notifications', '/profile', '/leagues']
    .some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4Z" />,
    racing: <><path d="M5 21V4" /><path d="M5 5h11l-2 4 2 4H5" /></>,
    career: <><path d="M4 20V9" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M3 20h18" /></>,
    vora: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5Z" /><path d="m18 16 .7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7Z" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-4 3.3-6 8-6s7.3 2 8 6" /></>,
    league: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    steward: <><path d="M12 3 5 6v5c0 4.5 2.7 8 7 10 4.3-2 7-5.5 7-10V6Z" /><path d="m9 12 2 2 4-5" /></>,
    admin: <><path d="M4 5h16v14H4Z" /><path d="M4 9h16M9 9v10" /></>,
    owner: <><path d="m12 3 2.2 4.6 5.1.7-3.7 3.6.9 5.1-4.5-2.4L7.5 17l.9-5.1-3.7-3.6 5.1-.7Z" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    logout: <><path d="M10 5H5v14h5" /><path d="M14 8l4 4-4 4" /><path d="M8 12h10" /></>,
  };
  return (
    <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

function LanguageFlag({ language }: { language: Language }) {
  if (language === 'de') {
    return <svg aria-hidden="true" className="language-flag" viewBox="0 0 24 18"><path fill="#111" d="M0 0h24v6H0z" /><path fill="#d00" d="M0 6h24v6H0z" /><path fill="#ffce00" d="M0 12h24v6H0z" /></svg>;
  }
  if (language === 'es') {
    return <svg aria-hidden="true" className="language-flag" viewBox="0 0 24 18"><path fill="#aa151b" d="M0 0h24v4.5H0zM0 13.5h24V18H0z" /><path fill="#f1bf00" d="M0 4.5h24v9H0z" /></svg>;
  }
  if (language === 'fr') {
    return <svg aria-hidden="true" className="language-flag" viewBox="0 0 24 18"><path fill="#002654" d="M0 0h8v18H0z" /><path fill="#fff" d="M8 0h8v18H8z" /><path fill="#ed2939" d="M16 0h8v18h-8z" /></svg>;
  }
  return (
    <svg aria-hidden="true" className="language-flag" viewBox="0 0 24 18">
      <path fill="#012169" d="M0 0h24v18H0z" />
      <path d="M0 0l24 18M24 0 0 18" stroke="#fff" strokeWidth="4" />
      <path d="M0 0l24 18M24 0 0 18" stroke="#c8102e" strokeWidth="1.5" />
      <path fill="#fff" d="M9 0h6v18H9zM0 6h24v6H0z" />
      <path fill="#c8102e" d="M10.5 0h3v18h-3zM0 7.5h24v3H0z" />
    </svg>
  );
}

function LanguageControl() {
  const { language, setLanguage, t } = useI18n();
  const languageName = (item: Language) => t(('languageName.' + item) as MessageKey);

  return (
    <details
      className="language-control language-control--compact"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.removeAttribute('open');
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') event.currentTarget.removeAttribute('open');
      }}
    >
      <summary aria-label={`${t('language')}: ${languageName(language)}`} title={languageName(language)}>
        <LanguageFlag language={language} />
      </summary>
      <div aria-label={t('language')} className="language-options" role="menu">
        {SUPPORTED_LANGUAGES.map((item) => (
          <button
            aria-checked={language === item}
            className={language === item ? 'language-option language-option--active' : 'language-option'}
            key={item}
            onClick={(event) => {
              setLanguage(item);
              event.currentTarget.closest('details')?.removeAttribute('open');
            }}
            role="menuitemradio"
            type="button"
          >
            <LanguageFlag language={item} />
            <span>{languageName(item)}</span>
            <small>{item.toUpperCase()}</small>
          </button>
        ))}
      </div>
    </details>
  );
}

function DriverNavigation({ hasLeagueAccess, onNavigate }: { hasLeagueAccess: boolean; onNavigate?: () => void }) {
  const { t } = useI18n();
  const items = hasLeagueAccess ? DRIVER_NAV_ITEMS : DRIVER_NAV_ITEMS.filter((item) => item.path === '/home');
  return (
    <div className="driver-navigation" aria-label={t('nav.driver')}>
      {items.map((item) => (
        <NavLink
          className={({ isActive }) => [
            'nav-item',
            !item.mobilePrimary && 'nav-item--mobile-secondary',
            isActive && 'nav-item--active',
          ].filter(Boolean).join(' ')}
          end={item.path === '/home'}
          key={item.path}
          onClick={onNavigate}
          to={item.path}
        >
          <NavIcon name={item.icon} />
          <span>{t(item.key)}</span>
        </NavLink>
      ))}
    </div>
  );
}

function MobilePrimaryNavigation({
  hasLeagueAccess,
  moreActive,
  navigationOpen,
  onNavigate,
  onToggleMore,
}: {
  hasLeagueAccess: boolean;
  moreActive: boolean;
  navigationOpen: boolean;
  onNavigate: () => void;
  onToggleMore: () => void;
}) {
  const { t } = useI18n();
  const items = hasLeagueAccess ? MOBILE_PRIMARY_NAV_ITEMS : MOBILE_PRIMARY_NAV_ITEMS.filter((item) => item.path === '/home');
  return (
    <nav aria-label={t('nav.mobile')} className="mobile-primary-navigation">
      {items.map((item) => (
        <NavLink
          className={({ isActive }) => isActive ? 'mobile-primary-item mobile-primary-item--active' : 'mobile-primary-item'}
          end={item.path === '/home'}
          key={item.path}
          onClick={onNavigate}
          to={item.path}
        >
          <NavIcon name={item.icon} />
          <span>{t(item.key)}</span>
        </NavLink>
      ))}
      <button
        aria-controls="mobile-more-navigation"
        aria-expanded={navigationOpen}
        className={moreActive || navigationOpen ? 'mobile-primary-item mobile-primary-item--active' : 'mobile-primary-item'}
        onClick={onToggleMore}
        type="button"
      >
        <NavIcon name="more" />
        <span>{t('nav.more')}</span>
      </button>
    </nav>
  );
}

function MobileMoreNavigation({
  canAdmin,
  canOwner,
  canSteward,
  hasLeagueAccess,
  open,
  onNavigate,
  onSignOut,
  isPlatformOwner,
  signingOut,
  userId,
}: {
  canAdmin: boolean;
  canOwner: boolean;
  canSteward: boolean;
  hasLeagueAccess: boolean;
  open: boolean;
  onNavigate: () => void;
  onSignOut: () => void;
  isPlatformOwner: boolean;
  signingOut: boolean;
  userId: string | null;
}) {
  const { t } = useI18n();
  return (
    <nav
      aria-hidden={!open}
      aria-label={t('nav.more')}
      className={open ? 'mobile-more-navigation mobile-more-navigation--open' : 'mobile-more-navigation'}
      id="mobile-more-navigation"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onNavigate();
      }}
    >
      <div className="mobile-more-heading">
        <strong>{t('nav.more')}</strong>
        <button aria-label={t('nav.close')} onClick={onNavigate} type="button">×</button>
      </div>
      <div className="mobile-more-links">
        {hasLeagueAccess && <NavLink onClick={onNavigate} className={({ isActive }) => isActive ? 'nav-item nav-item--active' : 'nav-item'} to="/vora"><NavIcon name="vora" /><span>{t('nav.vora')}</span></NavLink>}
        {canSteward && <NavLink onClick={onNavigate} className={({ isActive }) => isActive ? 'nav-item nav-item--active' : 'nav-item'} to="/stewarding"><NavIcon name="steward" /><span>{t('nav.stewarding')}</span></NavLink>}
        {canAdmin && <NavLink onClick={onNavigate} className={({ isActive }) => isActive ? 'nav-item nav-item--active' : 'nav-item'} to="/admin"><NavIcon name="admin" /><span>{t('nav.admin')}</span></NavLink>}
        {canOwner && <NavLink onClick={onNavigate} className={({ isActive }) => isActive ? 'nav-item nav-item--active' : 'nav-item'} to="/owner"><NavIcon name="owner" /><span>{t('nav.owner')}</span></NavLink>}
      </div>
      <div className="mobile-more-tools">
        {userId && shouldShowLeagueSwitcher(userId) && <div className="mobile-more-league-switcher"><LeagueSwitcher isPlatformOwner={isPlatformOwner} onSwitch={onNavigate} userId={userId} /></div>}
        <NavLink className={({ isActive }) => isActive ? 'nav-item nav-item--active' : 'nav-item'} onClick={onNavigate} to="/profile"><NavIcon name="profile" /><span>{t('nav.profile')}</span></NavLink>
        <LanguageControl />
        {userId
          ? <button className="nav-item menu-sign-out" disabled={signingOut} onClick={onSignOut} type="button"><NavIcon name="logout" /><span>{signingOut ? t('pending') : t('shell.signOut')}</span></button>
          : <NavLink className="session-state session-state--link" onClick={onNavigate} to="/login?mode=signin">{t('beta.action')}</NavLink>}
      </div>
    </nav>
  );
}

function LegacyRouteRedirect({ to }: { to: string }) {
  const location = useLocation();
  const [pathname, targetQuery = ''] = to.split('?');
  const query = new URLSearchParams(targetQuery);
  new URLSearchParams(location.search).forEach((value, key) => {
    if (!query.has(key)) query.set(key, value);
  });
  const search = query.size ? `?${query.toString()}` : '';
  return <Navigate replace to={`${pathname}${search}${location.hash}`} />;
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
  const navigate = useNavigate();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const { t } = useI18n();
  const { branding, leagueSlug } = useLeague();
  const { error: roleError, loading: roleLoading, role } = useRole();
  const features = useFeatureFlags();
  const { loading: authLoading, signOut, user } = useAuth();
  const hasLeagueAccess = Boolean(role);
  const canUseLeagueFeatures = !user || hasLeagueAccess;
  const displayBranding = (!roleLoading && Boolean(user) && !hasLeagueAccess) || shouldUseStandardRaceVoraBranding({
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
  const onboardingRequired = user?.user_metadata?.onboarding_complete === false;
  const closeNavigation = () => setNavigationOpen(false);
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      await signOut();
      closeNavigation();
      navigate('/login?mode=signin', { replace: true });
    } catch {
      setSignOutFailed(true);
    } finally {
      setSigningOut(false);
    }
  };
  const moreRouteActive = isMobileMoreRoute(location.pathname);
  const routeLoading = <AppState copy={t('home.loadingCopy')} title={t('pending')} tone="loading" />;
  const noLeagueAccess = <AppState
    action={<>
      <NavLink className="primary-action" to="/onboarding">{t('home.joinLeague')}</NavLink>
      <NavLink className="text-action" to="/leagues/new">{t('home.createLeague')}</NavLink>
    </>}
    copy={t('home.noLeagueCopy')}
    title={t('home.noLeagueTitle')}
    tone="empty"
  />;
  const leagueAccessError = <AppState copy={t('home.leagueAccessErrorCopy')} title={t('home.leagueAccessErrorTitle')} tone="error" />;
  const leagueRoute = (content: ReactNode) => accessLoading
    ? routeLoading
    : user && roleError
      ? leagueAccessError
      : user && !hasLeagueAccess
        ? noLeagueAccess
        : content;

  useEffect(() => setNavigationOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    const updateScrollProgress = () => {
      const maximum = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(maximum > 0 ? Math.min(1, Math.max(0, window.scrollY / maximum)) : 1);
    };
    updateScrollProgress();
    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    window.addEventListener('resize', updateScrollProgress);
    return () => {
      window.removeEventListener('scroll', updateScrollProgress);
      window.removeEventListener('resize', updateScrollProgress);
    };
  }, [location.pathname, location.search]);

  if (!authLoading && onboardingRequired && location.pathname !== '/onboarding') {
    return <Navigate replace to="/onboarding" />;
  }

  return (
    <div className={embeddedAccess ? 'app-shell app-shell--embedded-access' : 'app-shell'}>
      {!embeddedAccess && <header className="site-header">
        <div className="header-inner container">
        <NavLink className="brand" to="/home" onClick={closeNavigation}>
          <BrandLogo logoUrl={displayBranding.logoUrl} />
          <span className="brand-text">
            <strong className="brand-title">{displayBranding.name || 'RaceVora'}</strong>
            <small className="brand-subtitle">{displayBranding.subtitle || 'Race Management Platform'}</small>
          </span>
        </NavLink>

        {canNotify && (
          <NavLink
            aria-label={t('nav.notifications')}
            className={({ isActive }) => isActive ? 'mobile-header-notifications mobile-header-notifications--active' : 'mobile-header-notifications'}
            onClick={closeNavigation}
            to="/notifications"
          >
            <NavIcon name="bell" />
          </NavLink>
        )}

        <button
          aria-controls="main-navigation"
          aria-expanded={navigationOpen}
          aria-label={t('nav.mobile')}
          className="mobile-toggle"
          onClick={() => setNavigationOpen((current) => !current)}
          type="button"
        >
          <span className="mobile-toggle__icon"><span /><span /><span /></span>
        </button>

        <nav className={navigationOpen ? 'main-navigation main-nav main-navigation--open' : 'main-navigation main-nav'} id="main-navigation" aria-label={t('nav.driver')}>
          <DriverNavigation hasLeagueAccess={canUseLeagueFeatures} onNavigate={closeNavigation} />
          <div className="privileged-navigation">
            {canSteward && <NavLink onClick={closeNavigation} className={({ isActive }) => isActive ? 'nav-item nav-item--active steward-nav-item' : 'nav-item steward-nav-item'} to="/stewarding"><NavIcon name="steward" /><span>{t('nav.stewarding')}</span></NavLink>}
            {canAdmin && <NavLink onClick={closeNavigation} className={({ isActive }) => isActive ? 'nav-item nav-item--active operations-nav-item' : 'nav-item operations-nav-item'} to="/admin"><NavIcon name="admin" /><span>{t('nav.admin')}</span></NavLink>}
            {canOwner && <NavLink onClick={closeNavigation} className={({ isActive }) => isActive ? 'nav-item nav-item--active operations-nav-item' : 'nav-item operations-nav-item'} to="/owner"><NavIcon name="owner" /><span>{t('nav.owner')}</span></NavLink>}
          </div>
          <div className="header-tools">
            {user && shouldShowLeagueSwitcher(user.id) && <div className="navigation-league-switcher"><LeagueSwitcher isPlatformOwner={role === 'platform_owner'} onSwitch={closeNavigation} userId={user.id} /></div>}
            {canNotify && <NavLink onClick={closeNavigation} className="topbar-icon-link" to="/notifications" aria-label={t('nav.notifications')}><NavIcon name="bell" /><span>{t('nav.notifications')}</span></NavLink>}
            <span className="role-chip">{roleLoading ? t('pending') : user && !role ? t('leagueSwitcher.none') : roleLabel(role, t)}</span>
            <NavLink
              className={({ isActive }) => isActive ? 'nav-item nav-item--active topbar-profile-link' : 'nav-item topbar-profile-link'}
              onClick={closeNavigation}
              to="/profile"
            >
              <NavIcon name="profile" />
              <span>{t('nav.profile')}</span>
            </NavLink>
            <LanguageControl />
            {user && <button className="nav-item menu-sign-out" disabled={signingOut} onClick={() => void handleSignOut()} type="button"><NavIcon name="logout" /><span>{signingOut ? t('pending') : t('shell.signOut')}</span></button>}
            {!user && (
              <NavLink className="session-state session-state--link" onClick={closeNavigation} to="/login?mode=signin">{t('beta.action')}</NavLink>
            )}
          </div>
        </nav>
        {signOutFailed && <span className="header-session-error" role="alert">{t('profile.signOutError')}</span>}
        </div>
        <div className="global-scroll-progress" aria-hidden="true"><span style={{ transform: `scaleX(${scrollProgress})` }} /></div>
      </header>}

      {!embeddedAccess && navigationOpen && <button aria-label={t('nav.close')} className="mobile-navigation-scrim" onClick={closeNavigation} type="button" />}
      {!embeddedAccess && (
        <MobileMoreNavigation
          canAdmin={canAdmin}
          canOwner={canOwner}
          canSteward={canSteward}
          hasLeagueAccess={canUseLeagueFeatures}
          onNavigate={closeNavigation}
          onSignOut={() => void handleSignOut()}
          open={navigationOpen}
          isPlatformOwner={role === 'platform_owner'}
          signingOut={signingOut}
          userId={user?.id || null}
        />
      )}
      {!embeddedAccess && (
        <MobilePrimaryNavigation
          hasLeagueAccess={canUseLeagueFeatures}
          moreActive={moreRouteActive}
          navigationOpen={navigationOpen}
          onNavigate={closeNavigation}
          onToggleMore={() => setNavigationOpen((current) => !current)}
        />
      )}

      <div className={embeddedAccess ? 'shell-frame shell-frame--embedded-access' : 'shell-frame'}>

        <Routes key={leagueSlug}>
          <Route path="/" element={<Navigate replace to="/home" />} />
          <Route path="/home" element={leagueRoute(<DriverHomePage />)} />
          <Route path="/racing" element={leagueRoute(<Navigate replace to={{ pathname: '/racing/calendar', search: location.search, hash: location.hash }} />)} />
          <Route path="/racing/*" element={leagueRoute(<RacingPage />)} />
          <Route path="/career" element={leagueRoute(<Suspense fallback={routeLoading}><CareerPage /></Suspense>)} />
          <Route path="/career/*" element={leagueRoute(<Suspense fallback={routeLoading}><CareerPage /></Suspense>)} />
          <Route path="/vora" element={leagueRoute(<Suspense fallback={routeLoading}><VoraPage /></Suspense>)} />
          <Route path="/profile" element={<Suspense fallback={routeLoading}><ProfilePage /></Suspense>} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/login" element={<BetaAccessPage appEnvironment={environment.appEnvironment} />} />
          <Route path="/beta" element={<BetaAccessPage appEnvironment={environment.appEnvironment} />} />
          <Route path="/auth/confirm" element={<AuthLinkPage appEnvironment={environment.appEnvironment} mode="confirm" />} />
          <Route path="/auth/reset" element={<AuthLinkPage appEnvironment={environment.appEnvironment} mode="reset" />} />
          <Route path="/stewarding" element={accessLoading ? routeLoading : canSteward ? <Suspense fallback={routeLoading}><StewardWorkspacePage /></Suspense> : <Navigate replace to="/home" />} />
          <Route path="/admin" element={accessLoading ? routeLoading : canAdmin ? <Suspense fallback={routeLoading}><AdminWorkspacePage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/branding" element={accessLoading ? routeLoading : canAdmin ? <Suspense fallback={routeLoading}><LeagueBrandingPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/users" element={accessLoading ? routeLoading : canAdmin ? <Suspense fallback={routeLoading}><LeagueMembersPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/drivers" element={accessLoading ? routeLoading : canAdmin ? <Suspense fallback={routeLoading}><LeagueDriversPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/races" element={accessLoading ? routeLoading : canAdmin ? <Suspense fallback={routeLoading}><LeagueRacesPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/season/setup" element={accessLoading ? routeLoading : canAdmin ? <Suspense fallback={routeLoading}><SeasonSetupPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/results" element={accessLoading ? routeLoading : canAdmin ? <Suspense fallback={routeLoading}><LeagueRacesPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/standings" element={accessLoading ? routeLoading : canAdmin ? <Suspense fallback={routeLoading}><LeagueRacesPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/teams" element={accessLoading ? routeLoading : canAdmin ? <Suspense fallback={routeLoading}><LeagueTeamsPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/rules" element={accessLoading ? routeLoading : canAdmin ? <Suspense fallback={routeLoading}><LeagueRulesPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/results/import" element={accessLoading ? routeLoading : canAdmin ? <Suspense fallback={routeLoading}><ResultImportPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/audit" element={accessLoading ? routeLoading : canAdmin ? <Suspense fallback={routeLoading}><LeagueAuditPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/admin/graphics" element={accessLoading ? routeLoading : canCreateGraphics ? <Suspense fallback={routeLoading}><GraphicsStudioPage /></Suspense> : <Navigate replace to="/admin" />} />
          <Route path="/owner" element={accessLoading ? routeLoading : canOwner ? <Suspense fallback={routeLoading}><OwnerControlPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/owner/instagram" element={accessLoading ? routeLoading : canOwner ? <Suspense fallback={routeLoading}><InstagramStudioPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/leagues/new" element={authLoading ? routeLoading : user ? <Suspense fallback={routeLoading}><LeagueCreatePage /></Suspense> : <Navigate replace to="/login?mode=signin" />} />
          <Route path="/owner/leagues/new" element={<Navigate replace to="/leagues/new" />} />
          <Route path="/owner/demo" element={accessLoading ? routeLoading : canOwner ? <Suspense fallback={routeLoading}><DemoE2EPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/notifications" element={authLoading ? routeLoading : canNotify ? <Suspense fallback={routeLoading}><NotificationCenterPage /></Suspense> : <Navigate replace to="/" />} />
          <Route path="/race-hub" element={<LegacyRouteRedirect to="/racing" />} />
          <Route path="/kalender" element={<LegacyRouteRedirect to="/racing/calendar" />} />
          <Route path="/ergebnisse" element={<LegacyRouteRedirect to="/racing/results" />} />
          <Route path="/fahrer-wm" element={<LegacyRouteRedirect to="/racing/standings?view=drivers" />} />
          <Route path="/team-wm" element={<LegacyRouteRedirect to="/racing/standings?view=teams" />} />
          <Route path="/grid" element={<LegacyRouteRedirect to="/racing/grid" />} />
          <Route path="/regeln-faq" element={<LegacyRouteRedirect to="/racing/rules" />} />
          <Route path="/strecken" element={<LegacyRouteRedirect to="/racing/tracks" />} />
          <Route path="/strecken-profil" element={<LegacyRouteRedirect to="/racing/tracks/profile" />} />
          <Route path="/rennen-detail" element={<LegacyRouteRedirect to="/racing/races/detail" />} />
          <Route path="/fahrer-profil" element={<LegacyRouteRedirect to="/racing/drivers/profile" />} />
          <Route path="/team-profil" element={<LegacyRouteRedirect to="/racing/teams/profile" />} />
          <Route path="/head-to-head" element={<LegacyRouteRedirect to="/career/compare" />} />
          <Route path="/rekorde" element={<LegacyRouteRedirect to="/racing/history?view=records" />} />
          <Route path="/hall-of-fame" element={<LegacyRouteRedirect to="/racing/history?view=hall-of-fame" />} />
          <Route path="/saison-archiv" element={<LegacyRouteRedirect to="/racing/history?view=seasons" />} />
          <Route path="*" element={<Navigate replace to="/home" />} />
        </Routes>

        {!embeddedAccess && <footer className="footer">
          <span className="footer-copyright">{t('footer.copyright', { year: new Date().getFullYear() })}</span>
          <nav className="footer-legal" aria-label={t('footer.legalNavigation')}>
            {LEGAL_FOOTER_LINKS.map((link) => <a href={link.href} key={link.href}>{t(link.key)}</a>)}
          </nav>
        </footer>}
      </div>
      {!embeddedAccess && <BetaFeedback obscured={navigationOpen} />}
    </div>
  );
}

