import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { THEME_PRESETS } from '../league/leagueBranding';
import { useDriverIdentity } from './DriverIdentityProvider';

export function ProfilePage() {
  const { loading: authLoading, signOut, updateDisplayName, updateThemePreset, user } = useAuth();
  const { identity, loading: identityLoading } = useDriverIdentity();
  const { plural, t } = useI18n();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<'error' | 'saved' | null>(null);
  const [themeFeedback, setThemeFeedback] = useState<'error' | 'saved' | null>(null);
  const [themePreset, setThemePreset] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  useEffect(() => {
    setDisplayName(typeof user?.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '');
    const storedTheme = Number(user?.user_metadata?.theme_preset);
    setThemePreset(THEME_PRESETS.some((theme) => theme.id === storedTheme) ? storedTheme : 0);
  }, [user]);

  if (authLoading || identityLoading) {
    return <main className="driver-state" id="main-content"><span className="state-mark" aria-hidden="true">P</span><div><h1>{t('home.loadingTitle')}</h1><p>{t('home.loadingCopy')}</p></div></main>;
  }
  if (!user) {
    return <main className="driver-state" id="main-content"><span className="state-mark" aria-hidden="true">P</span><div><h1>{t('profile.signedOutTitle')}</h1><p>{t('home.signedOutCopy')}</p><NavLink className="primary-action" to="/login?mode=signin">{t('beta.action')}<span aria-hidden="true">→</span></NavLink></div></main>;
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = displayName.trim();
    if (normalized.length < 2 || normalized.length > 60) {
      setFeedback('error');
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await updateDisplayName(normalized);
      setDisplayName(normalized);
      setFeedback('saved');
    } catch {
      setFeedback('error');
    } finally {
      setSaving(false);
    }
  }

  async function selectTheme(nextTheme: number) {
    setThemePreset(nextTheme);
    setThemeFeedback(null);
    try {
      await updateThemePreset(nextTheme);
      setThemeFeedback('saved');
    } catch {
      setThemeFeedback('error');
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(false);
    try {
      await signOut();
    } catch {
      setSignOutError(true);
      setSigningOut(false);
    }
  }

  const selectedTheme = THEME_PRESETS.find((theme) => theme.id === themePreset) ?? THEME_PRESETS[0];

  return (
    <main className="profile-page dashboard-shell" id="main-content">
      <section className="profile-layout">
        <article className="hero-main profile-summary">
          <p className="hero-kicker">{t('profile.account')}</p>
          <h1>{displayName || user.email?.split('@')[0] || t('home.defaultDriver')}</h1>
          <p className="hero-subcopy">{t('route.profileCopy')}</p>
          <dl className="profile-facts">
            <div><dt>{t('beta.email')}</dt><dd>{user.email ?? t('notConfirmed')}</dd></div>
            <div><dt>{t('profile.number')}</dt><dd className="profile-number">#{identity?.profileNumber ?? '–'}</dd></div>
            <div><dt>{t('profile.identity')}</dt><dd>{identity?.status === 'active' ? t('identityActive') : t('noIdentity')}</dd></div>
            <div><dt>{t('profile.linkedDrivers')}</dt><dd>{plural('linkedRecord', identity?.linkedDriverCount ?? 0)}</dd></div>
          </dl>
        </article>
        <form className="hero-side profile-form" onSubmit={(event) => void saveProfile(event)}>
          <div><p className="section-label">{t('profile.settings')}</p><h2>{t('profile.displayName')}</h2><p>{t('profile.displayNameCopy')}</p></div>
          <label htmlFor="profile-display-name">{t('profile.displayName')}</label>
          <input id="profile-display-name" maxLength={60} minLength={2} onChange={(event) => { setDisplayName(event.target.value); setFeedback(null); }} required value={displayName} />
          {feedback === 'saved' && <p className="form-success" role="status">{t('profile.saved')}</p>}
          {feedback === 'error' && <p className="form-error" role="alert">{t('profile.saveError')}</p>}
          <button className="primary-action" disabled={saving} type="submit">{saving ? t('pending') : t('steward.save')}</button>
        </form>
        <article className="profile-personalization">
          <div><p className="section-label">{t('profile.settings')}</p><h2>{t('profile.themeTitle')}</h2><p>{t('profile.themeCopy')}</p></div>
          <fieldset className="theme-picker profile-theme-picker">
            <legend>{t('profile.themeTitle')}</legend>
            {THEME_PRESETS.map((theme) => <label key={theme.id} className={themePreset === theme.id ? 'theme-option theme-option--active' : 'theme-option'}><input type="radio" name="personal-theme" checked={themePreset === theme.id} onChange={() => void selectTheme(theme.id)} /><span className="theme-swatches" aria-hidden="true">{[theme.primary, theme.accent, theme.accent2].map((color) => <i key={color} style={{ background: color }} />)}</span><span><strong>{theme.name}</strong><small>{theme.subtitle}</small></span></label>)}
          </fieldset>
          {themeFeedback === 'saved' && <p className="form-success" role="status">{t('profile.themeSaved')}</p>}
          {themeFeedback === 'error' && <p className="form-error" role="alert">{t('profile.themeError')}</p>}
        </article>
        <aside className="profile-theme-preview" style={{ '--preview-primary': selectedTheme.primary, '--preview-secondary': selectedTheme.surface, '--preview-accent': selectedTheme.accent } as CSSProperties}>
          <span className="preview-mark" aria-hidden="true">RV</span><h2>RaceVora</h2><small>{selectedTheme.name}</small><span className="profile-preview-button">{t('profile.themeTitle')}</span>
        </aside>
        <article className="profile-create-league"><div><p className="section-label">RaceVora</p><h2>{t('profile.createLeague')}</h2><p>{t('profile.createLeagueCopy')}</p></div><div className="profile-league-actions"><NavLink className="text-action" to="/onboarding">{t('onboarding.leagueStep')}</NavLink><NavLink className="primary-action" to="/leagues/new">{t('profile.createLeague')}<span aria-hidden="true">→</span></NavLink></div></article>
        <article className="profile-session">
          <div><p className="section-label">{t('profile.account')}</p><h2>{t('shell.signOut')}</h2><p>{t('profile.signOutCopy')}</p></div>
          <div className="profile-session-action">
            <span>{user.email}</span>
            <button className="text-action profile-sign-out" disabled={signingOut} onClick={() => void handleSignOut()} type="button">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></svg>
              <span>{signingOut ? t('pending') : t('shell.signOut')}</span>
            </button>
          </div>
          {signOutError && <p className="form-error profile-session-error" role="alert">{t('profile.signOutError')}</p>}
        </article>
      </section>
    </main>
  );
}
