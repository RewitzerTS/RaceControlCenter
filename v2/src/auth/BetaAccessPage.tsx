import { type FormEvent, useState } from 'react';
import { Navigate, NavLink } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from './AuthProvider';

type AccessMode = 'sign-in' | 'sign-up';

export function BetaAccessPage() {
  const { loading: authLoading, signIn, signUp, user } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<AccessMode>('sign-up');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'confirmation' | 'error' | null>(null);

  if (!authLoading && user) return <Navigate replace to="/" />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');

    setBusy(true);
    setFeedback(null);
    try {
      if (mode === 'sign-in') {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password);
        if (result === 'confirmation-required') setFeedback('confirmation');
      }
    } catch {
      setFeedback('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="beta-access dashboard-shell" id="main-content">
      <div className="beta-dashboard-grid">
      <section className="beta-access-intro hero-main" aria-labelledby="beta-access-title">
        <div className="hero-topline">
          <p className="hero-kicker">{t('beta.kicker')}</p>
          <span className="live-badge">V2 Beta</span>
        </div>
        <h1 id="beta-access-title">{t(mode === 'sign-up' ? 'beta.signUpTitle' : 'beta.signInTitle')}</h1>
        <p className="hero-subcopy">{t('beta.copy')}</p>
        <div className="beta-safety-note">
          <strong>{t('protectedCopy')}</strong>
          <span>{t('isolationDetails', { projectRef: 'staging' })}</span>
        </div>
        <NavLink className="btn-secondary-ghost text-link" to="/">{t('route.backHome')}<span aria-hidden="true">→</span></NavLink>
      </section>

      <form className="beta-access-form hero-side" onSubmit={(event) => void submit(event)}>
        <div className="beta-form-heading">
          <p className="hero-kicker">{t('beta.action')}</p>
          <h2>{t(mode === 'sign-up' ? 'beta.signUpTitle' : 'beta.signInTitle')}</h2>
        </div>
        <label htmlFor="beta-email">{t('beta.email')}</label>
        <input
          autoComplete="email"
          id="beta-email"
          inputMode="email"
          name="email"
          required
          type="email"
        />
        <label htmlFor="beta-password">{t('beta.password')}</label>
        <input
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          id="beta-password"
          minLength={8}
          name="password"
          required
          type="password"
        />
        <small>{t('beta.passwordHint')}</small>

        {feedback && (
          <p className={feedback === 'error' ? 'beta-feedback beta-feedback--error' : 'beta-feedback'} role={feedback === 'error' ? 'alert' : 'status'}>
            {t(feedback === 'error' ? 'beta.error' : 'beta.confirmation')}
          </p>
        )}

        <button className="primary-action beta-submit" disabled={busy} type="submit">
          {busy ? t('pending') : t(mode === 'sign-up' ? 'beta.signUp' : 'beta.signIn')}
        </button>
        <button
          className="text-action beta-mode"
          disabled={busy}
          onClick={() => {
            setFeedback(null);
            setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up');
          }}
          type="button"
        >
          {t(mode === 'sign-up' ? 'beta.haveAccount' : 'beta.needAccount')}
        </button>
      </form>
      </div>
    </main>
  );
}
