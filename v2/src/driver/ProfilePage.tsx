import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AppState } from '../components/AppState';
import { useI18n } from '../i18n/I18nProvider';
import { LeagueSwitcher } from '../league/LeagueSwitcher';
import {
  CUSTOM_THEME_ID,
  customThemeHasAccessibleContrast,
  customThemeMetadata,
  resolvePersonalTheme,
  resolveStoredCustomTheme,
  resolveTheme,
  THEME_PRESETS,
  toCustomThemeColors,
  type CustomThemeColors,
} from '../league/leagueBranding';
import { useRole } from '../roles/RoleProvider';
import { useDriverIdentity } from './DriverIdentityProvider';
import { LeagueJoinRequestStatusList } from './LeagueJoinRequestStatusList';

const CUSTOM_THEME_FIELDS = [
  ['primary', 'profile.themePrimary'],
  ['secondary', 'profile.themeSecondary'],
  ['accent', 'profile.themeAccent'],
  ['accent2', 'profile.themeAccent2'],
  ['background', 'profile.themeBackground'],
  ['surface', 'profile.themeSurface'],
  ['text', 'profile.themeText'],
  ['textOnPrimary', 'profile.themeOnPrimary'],
] as const;

export function ProfilePage() {
  const { loading: authLoading, signOut, updateCustomTheme, updateDisplayName, updateThemePreset, user } = useAuth();
  const { identity, loading: identityLoading } = useDriverIdentity();
  const { role } = useRole();
  const { plural, t } = useI18n();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<'error' | 'saved' | null>(null);
  const [themeFeedback, setThemeFeedback] = useState<'error' | 'saved' | null>(null);
  const [themePreset, setThemePreset] = useState(0);
  const [customTheme, setCustomTheme] = useState<CustomThemeColors>(() => toCustomThemeColors(THEME_PRESETS[0]));
  const [hasStoredCustomTheme, setHasStoredCustomTheme] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  useEffect(() => {
    setDisplayName(typeof user?.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '');
    const storedTheme = resolvePersonalTheme(user?.user_metadata);
    const fallbackTheme = storedTheme.id === CUSTOM_THEME_ID ? THEME_PRESETS[0] : storedTheme;
    const storedCustomTheme = user?.user_metadata?.theme_custom;
    setThemePreset(storedTheme.id);
    setCustomTheme(toCustomThemeColors(resolveStoredCustomTheme(user?.user_metadata, fallbackTheme)));
    setHasStoredCustomTheme(Boolean(storedCustomTheme && typeof storedCustomTheme === 'object' && !Array.isArray(storedCustomTheme)));
  }, [user]);

  if (authLoading || identityLoading) {
    return <AppState copy={t('home.loadingCopy')} title={t('home.loadingTitle')} tone="loading" />;
  }
  if (!user) {
    return <AppState action={<NavLink className="primary-action" to="/login?mode=signin">{t('beta.action')}</NavLink>} copy={t('home.signedOutCopy')} title={t('profile.signedOutTitle')} />;
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

  function selectCustomTheme() {
    if (!hasStoredCustomTheme && themePreset !== CUSTOM_THEME_ID) {
      const currentPreset = THEME_PRESETS.find((theme) => theme.id === themePreset) ?? THEME_PRESETS[0];
      setCustomTheme(toCustomThemeColors(currentPreset));
    }
    setThemePreset(CUSTOM_THEME_ID);
    setThemeFeedback(null);
  }

  function patchCustomTheme(key: keyof CustomThemeColors, value: string) {
    setCustomTheme((current) => ({ ...current, [key]: value.toUpperCase() }));
    setThemeFeedback(null);
  }

  async function saveCustomTheme() {
    if (!customThemeHasAccessibleContrast(customTheme)) return;
    setThemeSaving(true);
    setThemeFeedback(null);
    try {
      await updateCustomTheme(customTheme);
      setHasStoredCustomTheme(true);
      setThemeFeedback('saved');
    } catch {
      setThemeFeedback('error');
    } finally {
      setThemeSaving(false);
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

  const selectedTheme = themePreset === CUSTOM_THEME_ID
    ? resolveTheme({ theme_id: CUSTOM_THEME_ID, ...customThemeMetadata(customTheme) })
    : THEME_PRESETS.find((theme) => theme.id === themePreset) ?? THEME_PRESETS[0];
  const customThemeContrastSafe = customThemeHasAccessibleContrast(customTheme);

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
            {THEME_PRESETS.map((theme) => <label key={theme.id} className={themePreset === theme.id ? 'theme-option theme-option--active' : 'theme-option'}><input type="radio" name="personal-theme" checked={themePreset === theme.id} onChange={() => void selectTheme(theme.id)} /><span className="theme-swatches" aria-hidden="true">{[theme.primary, theme.secondary, theme.accent, theme.accent2].map((color) => <i key={color} style={{ background: color }} />)}</span><span><strong>{theme.name}</strong><small>{theme.subtitle}</small></span></label>)}
            <label className={themePreset === CUSTOM_THEME_ID ? 'theme-option theme-option--active' : 'theme-option'}><input type="radio" name="personal-theme" checked={themePreset === CUSTOM_THEME_ID} onChange={selectCustomTheme} /><span className="theme-swatches" aria-hidden="true">{[customTheme.primary, customTheme.secondary, customTheme.accent, customTheme.accent2].map((color, index) => <i key={`${index}-${color}`} style={{ background: color }} />)}</span><span><strong>{t('profile.customTheme')}</strong><small>{t('profile.customThemeCopy')}</small></span></label>
            {themePreset === CUSTOM_THEME_ID && <div className="profile-custom-theme-editor" role="group" aria-label={t('profile.customTheme')}>
              <p>{t('profile.customThemeHint')}</p>
              <div className="profile-custom-theme-fields">
                {CUSTOM_THEME_FIELDS.map(([key, label]) => <label className="profile-custom-theme-field" key={key}><span><strong>{t(label)}</strong><small>{customTheme[key]}</small></span><input aria-label={t(label)} type="color" value={customTheme[key]} onChange={(event) => patchCustomTheme(key, event.target.value)} /></label>)}
              </div>
              {!customThemeContrastSafe && <p className="form-error" role="status">{t('profile.customThemeContrast')}</p>}
              <button className="primary-action" disabled={themeSaving || !customThemeContrastSafe} onClick={() => void saveCustomTheme()} type="button">{themeSaving ? t('pending') : t('profile.customThemeSave')}</button>
            </div>}
          </fieldset>
          {themeFeedback === 'saved' && <p className="form-success" role="status">{t('profile.themeSaved')}</p>}
          {themeFeedback === 'error' && <p className="form-error" role="alert">{t('profile.themeError')}</p>}
        </article>
        <aside className="profile-theme-preview" style={{ '--preview-primary': selectedTheme.primary, '--preview-secondary': selectedTheme.surface, '--preview-accent': selectedTheme.accent, '--preview-background': selectedTheme.background, '--preview-text': selectedTheme.text, '--preview-on-primary': selectedTheme.textOnPrimary } as CSSProperties}>
          <span className="preview-mark" aria-hidden="true">RV</span><h2>RaceVora</h2><small>{themePreset === CUSTOM_THEME_ID ? t('profile.customTheme') : selectedTheme.name}</small><span className="profile-preview-button">{t('profile.themeTitle')}</span>
        </aside>
        <article className="profile-create-league"><div><p className="section-label">RaceVora</p><h2>{t('profile.createLeague')}</h2><p>{t('profile.createLeagueCopy')}</p></div><div className="profile-league-actions"><NavLink className="text-action" to="/onboarding">{t('onboarding.leagueStep')}</NavLink><NavLink className="primary-action" to="/leagues/new">{t('profile.createLeague')}</NavLink></div></article>
        <article className="profile-create-league profile-active-league">
          <div><p className="section-label">RaceVora</p><h2>{t('leagueSwitcher.active')}</h2><p>{t('leagueSwitcher.change')}</p></div>
          <LeagueSwitcher isPlatformOwner={role === 'platform_owner'} userId={user.id} />
        </article>
        <article className="profile-join-requests">
          <header><p className="section-label">{t('joinRequests.kicker')}</p><h2>{t('joinRequests.title')}</h2><p>{t('joinRequests.intro')}</p></header>
          <LeagueJoinRequestStatusList />
        </article>
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
