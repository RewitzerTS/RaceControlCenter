import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';

type OnboardingResult = {
  league_name?: string;
  request_status?: 'already_member' | 'not_requested' | 'pending';
};

function resultObject(value: unknown): OnboardingResult {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as OnboardingResult : {};
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { completeOnboarding, loading: authLoading, user } = useAuth();
  const { t } = useI18n();
  const { client } = useLeague();
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(() => String(user?.user_metadata?.display_name ?? ''));
  const [gamertag, setGamertag] = useState(() => String(user?.user_metadata?.gamertag ?? ''));
  const [realName, setRealName] = useState(() => String(user?.user_metadata?.real_name ?? ''));
  const [nationalityCode, setNationalityCode] = useState(() => String(user?.user_metadata?.nationality_code ?? ''));
  const [leagueIdentifier, setLeagueIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (authLoading) return <main className="driver-state" id="main-content"><span className="state-mark">01</span><div><h1>{t('pending')}</h1></div></main>;
  if (!user) return <Navigate replace to="/login?mode=signin" />;

  function continueToLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (displayName.trim().length < 2 || gamertag.trim().length < 2) {
      setError(t('onboarding.profileError'));
      return;
    }
    setStep(2);
  }

  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const profile = {
      displayName: displayName.trim(),
      gamertag: gamertag.trim(),
      realName: realName.trim(),
      nationalityCode: nationalityCode.trim().toUpperCase(),
    };
    try {
      const response = await client.rpc('complete_driver_onboarding', {
        p_display_name: profile.displayName,
        p_gamertag: profile.gamertag,
        p_real_name: profile.realName,
        p_nationality_code: profile.nationalityCode,
        p_league_identifier: leagueIdentifier.trim(),
      });
      if (response.error) throw response.error;
      await completeOnboarding(profile);
      const result = resultObject(response.data);
      navigate('/home', {
        replace: true,
        state: {
          onboardingComplete: true,
          leagueName: result.league_name ?? '',
          requestStatus: result.request_status ?? 'not_requested',
        },
      });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '';
      setError(message.includes('League ID') ? t('onboarding.leagueNotFound') : t('onboarding.submitError'));
      setBusy(false);
    }
  }

  return (
    <main className="onboarding-page" id="main-content">
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <header className="onboarding-header">
          <div>
            <p className="section-label">{t('onboarding.kicker')}</p>
            <h1 id="onboarding-title">{t('onboarding.title')}</h1>
            <p>{t('onboarding.copy')}</p>
          </div>
          <span className="onboarding-progress" aria-label={t('onboarding.progress', { step })}>{step}/2</span>
        </header>
        <ol className="onboarding-steps" aria-label={t('onboarding.steps')}>
          <li aria-current={step === 1 ? 'step' : undefined} className={step >= 1 ? 'is-active' : ''}><span>1</span>{t('onboarding.profileStep')}</li>
          <li aria-current={step === 2 ? 'step' : undefined} className={step >= 2 ? 'is-active' : ''}><span>2</span>{t('onboarding.leagueStep')}</li>
        </ol>

        {step === 1 ? (
          <form className="onboarding-form" onSubmit={continueToLeague}>
            <div className="onboarding-section-heading"><h2>{t('onboarding.profileTitle')}</h2><p>{t('onboarding.profileCopy')}</p></div>
            <div className="onboarding-fields">
              <label><span>{t('onboarding.displayName')}</span><input autoComplete="nickname" maxLength={60} minLength={2} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} /><small>{t('onboarding.displayNameHint')}</small></label>
              <label><span>{t('onboarding.gamertag')}</span><input autoComplete="off" maxLength={60} minLength={2} onChange={(event) => setGamertag(event.target.value)} required value={gamertag} /><small>{t('onboarding.gamertagHint')}</small></label>
              <label><span>{t('onboarding.realName')}</span><input autoComplete="name" maxLength={100} onChange={(event) => setRealName(event.target.value)} value={realName} /><small>{t('onboarding.optional')}</small></label>
              <label><span>{t('onboarding.country')}</span><input aria-describedby="country-code-hint" autoCapitalize="characters" maxLength={2} onChange={(event) => setNationalityCode(event.target.value.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase())} pattern="[A-Za-z]{2}" placeholder="DE" value={nationalityCode} /><small id="country-code-hint">{t('onboarding.countryHint')}</small></label>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="onboarding-actions"><button className="primary-action" type="submit">{t('onboarding.continue')}<span aria-hidden="true">→</span></button></div>
          </form>
        ) : (
          <form className="onboarding-form" onSubmit={(event) => void finish(event)}>
            <div className="onboarding-section-heading"><h2>{t('onboarding.leagueTitle')}</h2><p>{t('onboarding.leagueCopy')}</p></div>
            <label className="onboarding-league-field"><span>{t('onboarding.leagueId')}</span><input autoComplete="off" maxLength={80} onChange={(event) => setLeagueIdentifier(event.target.value)} placeholder={t('onboarding.leaguePlaceholder')} value={leagueIdentifier} /><small>{t('onboarding.leagueHint')}</small></label>
            <aside className="onboarding-approval-note"><span aria-hidden="true">✓</span><div><strong>{t('onboarding.approvalTitle')}</strong><p>{t('onboarding.approvalCopy')}</p></div></aside>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="onboarding-actions onboarding-actions--split"><button className="text-action" disabled={busy} onClick={() => { setError(''); setStep(1); }} type="button">{t('onboarding.back')}</button><button className="primary-action" disabled={busy} type="submit">{busy ? t('onboarding.saving') : leagueIdentifier.trim() ? t('onboarding.requestJoin') : t('onboarding.finishWithoutLeague')}</button></div>
          </form>
        )}
      </section>
    </main>
  );
}

