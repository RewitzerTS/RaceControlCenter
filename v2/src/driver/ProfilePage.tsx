import { useEffect, useState, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useDriverIdentity } from './DriverIdentityProvider';

export function ProfilePage() {
  const { loading: authLoading, updateDisplayName, user } = useAuth();
  const { identity, loading: identityLoading } = useDriverIdentity();
  const { leagueSlug } = useLeague();
  const { plural, t } = useI18n();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<'error' | 'saved' | null>(null);

  useEffect(() => {
    setDisplayName(typeof user?.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '');
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

  return (
    <main className="profile-page dashboard-shell" id="main-content">
      <section className="storyline-strip"><strong>{t('route.profileTitle')}</strong><span>{user.email ?? t('notConfirmed')}</span><i aria-hidden="true">•</i><span>{t('profile.leagueContext', { league: leagueSlug })}</span></section>
      <section className="profile-layout">
        <article className="hero-main profile-summary">
          <p className="hero-kicker">{t('profile.account')}</p>
          <h1>{displayName || user.email?.split('@')[0] || t('home.defaultDriver')}</h1>
          <p className="hero-subcopy">{t('route.profileCopy')}</p>
          <dl className="profile-facts">
            <div><dt>{t('beta.email')}</dt><dd>{user.email ?? t('notConfirmed')}</dd></div>
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
      </section>
    </main>
  );
}
