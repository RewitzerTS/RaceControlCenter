import { type FormEvent, useEffect, useState } from 'react';
import { Navigate, NavLink, useSearchParams } from 'react-router-dom';
import type { AppEnvironment } from '../config/environment';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from './AuthProvider';
import { TurnstileWidget } from './TurnstileWidget';

type AccessMode = 'sign-in' | 'sign-up' | 'recovery';
type Feedback = 'captcha' | 'confirmation' | 'error' | 'recovery' | null;

export function BetaAccessPage({ appEnvironment }: { appEnvironment: AppEnvironment }) {
  const [searchParams] = useSearchParams();
  const { captcha, loading: authLoading, requestPasswordRecovery, signIn, signUp, user } = useAuth();
  const { t } = useI18n();
  const requestedMode = searchParams.get('mode');
  const embedded = searchParams.get('embed') === '1';
  const [mode, setMode] = useState<AccessMode>(requestedMode === 'signup' ? 'sign-up' : requestedMode === 'recovery' ? 'recovery' : 'sign-in');
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!embedded || authLoading || !user || window.parent === window) return;
    window.parent.postMessage({ type: 'racevora:auth-success' }, window.location.origin);
  }, [authLoading, embedded, user]);

  if (!authLoading && user) {
    if (embedded) {
      return (
        <main className="beta-access beta-access--embedded dashboard-shell" id="main-content">
          <section className="beta-access-success" role="status" aria-live="polite">
            <p className="eyebrow">RaceVora</p>
            <h1>Anmeldung erfolgreich</h1>
            <p>Du wirst jetzt zu deinem persönlichen Bereich weitergeleitet.</p>
          </section>
        </main>
      );
    }
    return <Navigate replace to="/home" />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (captcha.enabled && !captchaToken) {
      setFeedback('captcha');
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      if (mode === 'sign-in') {
        await signIn(email, password, captchaToken);
      } else if (mode === 'sign-up') {
        const result = await signUp(email, password, captchaToken);
        if (result === 'confirmation-required') setFeedback('confirmation');
      } else {
        await requestPasswordRecovery(email, captchaToken);
        setFeedback('recovery');
      }
    } catch {
      setFeedback('error');
    } finally {
      setBusy(false);
      setCaptchaReset((current) => current + 1);
    }
  }

  const production = appEnvironment === 'production';
  const titleKey = mode === 'sign-up'
    ? production ? 'beta.productionSignUpTitle' : 'beta.signUpTitle'
    : mode === 'sign-in'
      ? production ? 'beta.productionSignInTitle' : 'beta.signInTitle'
      : 'beta.recoveryTitle';
  const submitKey = mode === 'sign-up'
    ? production ? 'beta.productionSignUp' : 'beta.signUp'
    : mode === 'sign-in' ? 'beta.signIn' : 'beta.recoverySubmit';

  function changeMode(nextMode: AccessMode) {
    setFeedback(null);
    setMode(nextMode);
    setCaptchaReset((current) => current + 1);
  }

  return (
    <main className={embedded ? 'beta-access beta-access--embedded dashboard-shell' : 'beta-access dashboard-shell'} id="main-content">
      <div className="beta-dashboard-grid">
      {!embedded && <section className="beta-access-intro hero-main" aria-labelledby="beta-access-title">
        <div className="hero-topline">
          <p className="hero-kicker">{t(production ? 'beta.productionKicker' : 'beta.kicker')}</p>
          <span className="live-badge">{production ? 'V2' : 'V2 Beta'}</span>
        </div>
        <h1 id="beta-access-title">{t(titleKey)}</h1>
        <p className="hero-subcopy">{t(production ? 'beta.productionCopy' : 'beta.copy')}</p>
        <div className="beta-safety-note">
          <strong>{t(production ? 'productionProtectedCopy' : 'protectedCopy')}</strong>
          <span>{production ? t('productionDetails') : t('isolationDetails', { projectRef: 'staging' })}</span>
        </div>
        <NavLink className="btn-secondary-ghost text-link" to="/">{t('route.backHome')}<span aria-hidden="true">→</span></NavLink>
      </section>}

      <form className="beta-access-form hero-side" onSubmit={(event) => void submit(event)}>
        <div className="beta-form-heading">
          <p className="hero-kicker">{t(production ? 'beta.productionAction' : 'beta.action')}</p>
          <h2>{t(titleKey)}</h2>
        </div>
        <label htmlFor="beta-email">{t('beta.email')}</label>
        <input autoComplete="email" id="beta-email" inputMode="email" name="email" required type="email" />

        {mode !== 'recovery' && (
          <>
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
          </>
        )}

        <TurnstileWidget
          enabled={captcha.enabled}
          errorCopy={t('beta.captchaUnavailable')}
          onTokenChange={setCaptchaToken}
          resetSignal={captchaReset}
          siteKey={captcha.turnstileSiteKey}
        />

        {feedback && (
          <p className={feedback === 'error' || feedback === 'captcha' ? 'beta-feedback beta-feedback--error' : 'beta-feedback'} role={feedback === 'error' || feedback === 'captcha' ? 'alert' : 'status'}>
            {t(feedback === 'confirmation'
              ? production ? 'beta.productionConfirmation' : 'beta.confirmation'
              : feedback === 'recovery'
                ? production ? 'beta.productionRecoverySent' : 'beta.recoverySent'
                : feedback === 'captcha' ? 'beta.captchaRequired' : 'beta.error')}
          </p>
        )}

        <button className="primary-action beta-submit" disabled={busy} type="submit">
          {busy ? t('pending') : t(submitKey)}
        </button>
        <div className="beta-mode-actions">
          {mode !== 'sign-in' && <button className="text-action beta-mode" disabled={busy} onClick={() => changeMode('sign-in')} type="button">{t(production ? 'beta.productionHaveAccount' : 'beta.haveAccount')}</button>}
          {mode !== 'sign-up' && <button className="text-action beta-mode" disabled={busy} onClick={() => changeMode('sign-up')} type="button">{t(production ? 'beta.productionNeedAccount' : 'beta.needAccount')}</button>}
          {mode !== 'recovery' && <button className="text-action beta-mode" disabled={busy} onClick={() => changeMode('recovery')} type="button">{t('beta.forgotPassword')}</button>}
        </div>
      </form>
      </div>
    </main>
  );
}

