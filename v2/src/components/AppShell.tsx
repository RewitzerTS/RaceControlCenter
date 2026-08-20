import { NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { RuntimeEnvironment } from '../config/environment';
import { SUPPORTED_LANGUAGES, useI18n, type Language } from '../i18n/I18nProvider';
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
  const { leagueSlug } = useLeague();
  const { loading: roleLoading, role } = useRole();
  const { t } = useI18n();

  return (
    <main className="content" id="main-content">
      <div className="content-heading">
        <div>
          <p className="eyebrow">{t('overview')} · Phase 3</p>
          <h1>{t('foundation')}</h1>
        </div>
        <span className="environment-badge">{environment.appEnvironment}</span>
      </div>

      <section className="isolation-statement" aria-labelledby="isolation-title">
        <div className="track-mark" aria-hidden="true"><span /></div>
        <div>
          <h2 id="isolation-title">{t('protectedCopy')}</h2>
          <p>Project <code>{environment.supabaseProjectRef}</code> · Browser key only · RLS remains authoritative</p>
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
            value={roleLoading ? t('pending') : role ?? t('noRole')}
            tone={roleLoading ? 'pending' : 'ok'}
          />
        </div>

        <aside className="next-step" aria-labelledby="next-title">
          <span className="step-number">04</span>
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
            {SUPPORTED_LANGUAGES.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
          </select>
        </label>
      </header>

      <Routes>
        <Route path="*" element={<FoundationPage environment={environment} />} />
      </Routes>
      <footer className="footer"><span>RaceVora V2</span><span>Isolated staging foundation</span></footer>
    </div>
  );
}
