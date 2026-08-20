import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { EnvironmentGate } from './components/EnvironmentGate';
import { FeatureFlagProvider } from './features/FeatureFlagProvider';
import { I18nProvider } from './i18n/I18nProvider';
import { LeagueProvider, useLeague } from './league/LeagueProvider';
import { RoleProvider } from './roles/RoleProvider';

function AuthorizedShell({ environment }: { environment: Parameters<typeof AppShell>[0]['environment'] }) {
  const { client, leagueSlug } = useLeague();
  const { user } = useAuth();
  return (
    <RoleProvider client={client} user={user} leagueSlug={leagueSlug}>
      <AppShell environment={environment} />
    </RoleProvider>
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
    <AuthProvider client={client}>
      <AuthorizedShell environment={environment} />
    </AuthProvider>
  );
}
