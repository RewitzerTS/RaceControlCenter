import { useEffect, useLayoutEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { EnvironmentGate } from './components/EnvironmentGate';
import { DriverIdentityProvider } from './driver/DriverIdentityProvider';
import { FeatureFlagProvider } from './features/FeatureFlagProvider';
import { I18nProvider } from './i18n/I18nProvider';
import { LeagueProvider, useLeague } from './league/LeagueProvider';
import { applyLeagueBranding, fallbackLeagueBranding, resolvePersonalTheme, shouldUseStandardRaceVoraBranding } from './league/leagueBranding';
import { RoleProvider, useRole } from './roles/RoleProvider';

export function resetRouteScroll(hash: string): void {
  if (hash) {
    window.requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    });
    return;
  }
  window.scrollTo({ behavior: 'auto', left: 0, top: 0 });
}

function AuthorizedShell({ environment }: { environment: Parameters<typeof AppShell>[0]['environment'] }) {
  const location = useLocation();
  const { client, leagueSlug } = useLeague();
  const { user } = useAuth();

  useLayoutEffect(() => {
    resetRouteScroll(location.hash);
  }, [location.hash, location.pathname]);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  return (
    <DriverIdentityProvider client={client} leagueSlug={leagueSlug} user={user}>
      <RoleProvider client={client} leagueSlug={leagueSlug} user={user}>
        <AuthorizedExperience environment={environment} />
      </RoleProvider>
    </DriverIdentityProvider>
  );
}

function AuthorizedExperience({ environment }: { environment: Parameters<typeof AppShell>[0]['environment'] }) {
  const location = useLocation();
  const { branding, leagueSlug } = useLeague();
  const { loading: authLoading, user } = useAuth();
  const { loading: roleLoading, role } = useRole();
  const useStandardBranding = (!roleLoading && Boolean(user) && !role) || shouldUseStandardRaceVoraBranding({
    authenticated: Boolean(user),
    authLoading,
    leagueSlug,
    pathname: location.pathname,
    search: location.search,
  });

  useEffect(() => {
    if (useStandardBranding || !user) {
      applyLeagueBranding(fallbackLeagueBranding('racevora'));
      return;
    }
    applyLeagueBranding({ ...branding, theme: resolvePersonalTheme(user.user_metadata) });
  }, [branding, useStandardBranding, user]);

  return <AppShell environment={environment} />;
}

export default function App() {
  return (
    <EnvironmentGate>
      {(environment) => (
        <BrowserRouter>
          <I18nProvider>
            <FeatureFlagProvider flags={environment.features}>
              <LeagueProvider environment={environment}>
                <AuthBridge environment={environment} />
              </LeagueProvider>
            </FeatureFlagProvider>
          </I18nProvider>
        </BrowserRouter>
      )}
    </EnvironmentGate>
  );
}

function AuthBridge({ environment }: { environment: Parameters<typeof AppShell>[0]['environment'] }) {
  const { client } = useLeague();
  return (
    <AuthProvider captcha={environment.authCaptcha} client={client}>
      <AuthorizedShell environment={environment} />
    </AuthProvider>
  );
}

