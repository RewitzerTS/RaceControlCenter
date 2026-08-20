import { NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { RuntimeEnvironment } from '../config/environment';
import { useDriverIdentity } from '../driver/DriverIdentityProvider';
import {
  SUPPORTED_LANGUAGES,
  useI18n,
  type Language,
  type MessageKey,
} from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';

function StatusRow({ label, value, tone = 'ok' }: { label: string; value: string; tone?: 'ok' | 'pending' }) {
  return (
    <div className="status-row">
      <span>{label}</span>
      <strong><i className={`status-dot status-dot--${tone}`} aria-hidden="true" />{value}</strong>
    </div>
  );
}

function FoundationPage({ environment }: { environment: RuntimeEnvironment }) {
  const { loading: authLoading, user } = useAuth();
  const { error: identityError, identity, loading: identityLoading } = useDriverIdentity();
  const { leagueSlug } = useLeague();
  const { loading: roleLoading, role } = useRole();
  const { plural, t } = useI18n();
  const roleValue = role === 'driver'
    ? t('driverRole')
    : role === 'steward'
      ? t('stewardRole')
      : role === 'league_admin'
        ? t('leagueAdminRole')
        : role === 'platform_owner'
          ? t('platformOwnerRole')
          : t('noRole');

  return (
    <main className="content" id="main-content">
      <div className="content-heading">
        <div>
          <p className="eyebrow">{t('overview')} · {t('phaseLabel')} 13</p>
          <h1>{t('foundation')}</h1>
        </div>
        <span className="environment-badge">{environment.appEnvironment}</span>
      </div>

      <section className="isolation-statement" aria-labelledby="isolation-title">
        <div className="track-mark" aria-hidden="true"><span /></div>
        <div>
          <h2 id="isolation-title">{t('protectedCopy')}</h2>
          <p>{t('isolationDetails', { projectRef: environment.supabaseProjectRef })}</p>
        </div>
      </section>

      <section className="foundation-grid" aria-label={t('foundation')}>
        <div className="status-panel">
          <StatusRow label={t('environment')} value={t('ready')} />
          <StatusRow label={t('tenant')} value={leagueSlug} />
          <StatusRow
            label={t('session')}
            value={authLoading ? t('pending') : user ? user.email ?? user.id : t('signedOut')}
            tone={authLoading ? 'pending' : 'ok'}
          />
          <StatusRow
            label={t('authorization')}
            value={roleLoading ? t('pending') : roleValue}
            tone={roleLoading ? 'pending' : 'ok'}
          />
          <StatusRow
            label={t('driverIdentity')}
            value={
              identityLoading
                ? t('pending')
                : identityError
                  ? t('notConfirmed')
                  : !user
                    ? t('signedOut')
                    : identity
                      ? `${t(identity.status === 'active' ? 'identityActive' : 'identitySuspended')} · ${identity.linkedDriverCount} ${plural('linkedRecord', identity.linkedDriverCount)}`
                      : t('noIdentity')
            }
            tone={identityLoading || Boolean(identityError) ? 'pending' : 'ok'}
          />
          <StatusRow label={t('resultHistory')} value={t('explicitPointer')} />
          <StatusRow label={t('eventProcessing')} value={t('independentProcessors')} />
          <StatusRow label={t('careerSource')} value={t('currentOfficialResults')} />
          <StatusRow label={t('careerScope')} value={t('crossLeagueIdentity')} />
          <StatusRow label={t('xpSource')} value={t('appendOnlyLedger')} />
          <StatusRow label={t('levelRange')} value={t('oneToHundred')} />
          <StatusRow label={t('highestRank')} value={t('immortal')} />
          <StatusRow label={t('achievementSystem')} value={t('fiftyCoreAchievements')} />
          <StatusRow label={t('creditSource')} value={t('signedCreditLedger')} />
          <StatusRow label={t('garage')} value={t('cosmeticsOnly')} />
          <StatusRow label={t('challengeSystem')} value={t('threeRacingChallenges')} />
          <StatusRow label={t('launchLanguages')} value={t('fourLanguages')} />
        </div>

        <aside className="next-step" aria-labelledby="next-title">
          <span className="step-number">14</span>
          <div>
            <h2 id="next-title">{t('next')}</h2>
            <p>{t('nextCopy')}</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

export function AppShell({ environment }: { environment: RuntimeEnvironment }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label={`${t('product')} ${t('overview')}`}>
          <span className="brand-symbol" aria-hidden="true">RV</span>
          <span><strong>{t('product')}</strong><small>{t('staging')}</small></span>
        </NavLink>

        <label className="language-control">
          <span>{t('language')}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
            {SUPPORTED_LANGUAGES.map((item) => (
              <option key={item} value={item}>
                {t(`languageName.${item}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
      </header>

      <Routes>
        <Route path="*" element={<FoundationPage environment={environment} />} />
      </Routes>
      <footer className="footer"><span>{t('footerTitle')}</span><span>{t('footerCopy')}</span></footer>
    </div>
  );
}
