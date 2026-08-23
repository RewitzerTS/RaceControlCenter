import { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { EnvironmentGate } from './components/EnvironmentGate';
import { DriverIdentityProvider } from './driver/DriverIdentityProvider';
import { FeatureFlagProvider } from './features/FeatureFlagProvider';
import { I18nProvider } from './i18n/I18nProvider';
import { LeagueProvider, useLeague } from './league/LeagueProvider';
import { applyLeagueBranding, fallbackLeagueBranding, resolveTheme, shouldUseStandardRaceVoraBranding } from './league/leagueBranding';
import { RoleProvider } from './roles/RoleProvider';

function AuthorizedShell({ environment }: { environment: Parameters<typeof AppShell>[0]['environment'] }) {
  const location = useLocation();
  const { branding, client, leagueSlug } = useLeague();
  const { loading: authLoading, user } = useAuth();
  const useStandardBranding = shouldUseStandardRaceVoraBranding({
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
    const themePreset = Number(user.user_metadata?.theme_preset ?? 0);
    applyLeagueBranding({ ...branding, theme: resolveTheme({ theme_id: themePreset }) });
  }, [branding, useStandardBranding, user]);

  return (
    <DriverIdentityProvider client={client} user={user}>
      <RoleProvider client={client} user={user}>
        <AppShell environment={environment} />
      </RoleProvider>
    </DriverIdentityProvider>
  );
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

