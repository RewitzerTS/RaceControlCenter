import { type FormEvent, useState } from 'react';
import { Navigate, NavLink } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from './AuthProvider';

export function AuthLinkPage({ mode }: { mode: 'confirm' | 'reset' }) {
  const { loading, signOut, updatePassword, user } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'complete' | 'error' | null>(null);

  if (mode === 'confirm' && !loading && user) return <Navigate replace to="/" />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    setBusy(true);
    setFeedback(null);
    try {
      await updatePassword(password);
      await signOut();
      setFeedback('complete');
    } catch {
      setFeedback('error');
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'confirm' ? t('beta.confirmLinkTitle') : t('beta.resetTitle');
  return (
    <main className="beta-access dashboard-shell" id="main-content">
      <div className="beta-dashboard-grid">
        <section className="beta-access-intro hero-main">
          <p className="hero-kicker">{t('beta.action')}</p>
          <h1>{title}</h1>
          <p>{mode === 'confirm' ? t('beta.confirmLinkCopy') : t('beta.resetCopy')}</p>
        </section>
        <section className="beta-access-form hero-side" aria-live="polite">
          {loading && <p>{t('pending')}</p>}
          {!loading && mode === 'confirm' && !user && <p className="beta-feedback beta-feedback--error" role="alert">{t('beta.linkError')}</p>}
          {!loading && mode === 'reset' && !user && !feedback && <p className="beta-feedback beta-feedback--error" role="alert">{t('beta.linkError')}</p>}
          {!loading && mode === 'reset' && user && !feedback && (
            <form className="beta-reset-form" onSubmit={(event) => void submit(event)}>
              <label htmlFor="beta-new-password">{t('beta.newPassword')}</label>
              <input autoComplete="new-password" id="beta-new-password" minLength={8} name="password" required type="password" />
              <small>{t('beta.passwordHint')}</small>
              <button className="primary-action" disabled={busy} type="submit">{busy ? t('pending') : t('beta.resetSubmit')}</button>
            </form>
          )}
          {feedback === 'complete' && <p className="beta-feedback" role="status">{t('beta.resetComplete')}</p>}
          {feedback === 'error' && <p className="beta-feedback beta-feedback--error" role="alert">{t('beta.error')}</p>}
          {!loading && <NavLink className="text-action" to="/beta">{t('beta.backToAccess')}</NavLink>}
        </section>
      </div>
    </main>
  );
}

