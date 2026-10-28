import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AppState } from '../components/AppState';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { resolvePersonalTheme, THEME_PRESETS } from '../league/leagueBranding';
import { LeagueJoinRequestStatusList } from './LeagueJoinRequestStatusList';
import { advanceEntry, loadEntry, requestEntryLeague, saveEntryProfile, type EntryState } from './entry';
import { entryCopy } from './entryCopy';
import './entry.css';
import { PublicNameChoice } from './ProfileNameSettings';
import { nameCopy, type PublicNameMode } from './nameSettings';

export function OnboardingPage() {
  const { loading, user } = useAuth();
  const { t } = useI18n();
  if (loading) return <AppState title={t('pending')} copy="" tone="loading" />;
  if (!user) return <Navigate replace to="/login?mode=signin" />;
  return <EntryFlow key={user.id} />;
}

function EntryFlow() {
  const navigate = useNavigate();
  const { user, updateThemePreset } = useAuth();
  const { client } = useLeague();
  const { language, t } = useI18n();
  const c = entryCopy[language];
  const [entry, setEntry] = useState<EntryState | null>(null);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [publicNameMode, setPublicNameMode] = useState<PublicNameMode | ''>('gamertag');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [themeSaved, setThemeSaved] = useState(false);
  const [request, setRequest] = useState<{ league_name: string; request_status: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const saving = useRef(false);
  const selectedTheme = resolvePersonalTheme(user?.user_metadata);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void loadEntry(client).then(data => {
      if (!active) return;
      setEntry(data); setStep(data.step);
      setName(data.real_name ?? data.display_name ?? ''); setTag(data.gamertag ?? '');
      setPublicNameMode(data.public_name_mode ?? 'gamertag');
    }).catch(() => { if (active) setError(c.error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, retry, c.error]);

  useEffect(() => { if (entry) heading.current?.focus(); }, [step, Boolean(entry)]);

  async function run(action: () => Promise<void>) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (reason) {
      const message = reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : '';
      setError(message.includes('ENTRY_CODE') ? c.codeError : c.error);
    } finally { saving.current = false; setBusy(false); }
  }

  async function leave(to: string) {
    await advanceEntry(client, 3, true);
    // A refresh failure must not present the committed server save as a failed write.
    await client.auth.refreshSession().catch(() => undefined);
    navigate(to);
  }

  if (loading) return <AppState title={t('pending')} copy="" tone="loading" />;
  if (!entry) return <AppState title={c.identityError} copy={error} tone="error" action={<button className="text-action" onClick={() => setRetry(value => value + 1)} type="button">{c.retry}</button>} />;

  return <main className="entry-page" id="main-content">
    <header className="entry-heading"><h1>{c.title}</h1><p>{c.intro}</p></header>
    <div className="entry-identity"><span>{c.id}</span><strong>{entry.racevora_id}</strong><small>{c.idHint}</small></div>
    <ol className="entry-steps" aria-label={t('onboarding.steps')}>
      {c.steps.map((label, index) => <li key={index} aria-current={step === index + 1 ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}
    </ol>
    <section className="entry-body" aria-busy={busy}>
      <h2 ref={heading} tabIndex={-1}>{step === 1 ? c.profile : step === 2 ? c.style : c.league}</h2>
      {step === 1 && <form onSubmit={event => { event.preventDefault(); void run(async () => {
        if (!publicNameMode) return;
        const saved = await saveEntryProfile(client, name, tag, publicNameMode); setEntry(saved); setStep(2);
      }); }}>
        <fieldset disabled={busy} className="entry-fields">
          <label>{nameCopy[language].name}<input autoComplete="given-name" minLength={2} maxLength={60} required value={name} onChange={event => setName(event.target.value)} /></label>
          <small>{nameCopy[language].hint}</small>
          <label>{c.tag}<input autoComplete="off" autoCapitalize="none" spellCheck={false} minLength={2} maxLength={60} required value={tag} onChange={event => setTag(event.target.value)} /></label>
          <PublicNameChoice name={name} tag={tag} value={publicNameMode} onChange={setPublicNameMode} />
        </fieldset>
        <p>{c.profileHint}</p>
        <button disabled={busy} className="primary-action" type="submit">{busy ? c.saving : c.continue}</button>
      </form>}
      {step === 2 && <>
        <p>{c.styleHint}</p>
        <fieldset disabled={busy} className="entry-themes"><legend>{t('profile.themeTitle')}</legend>
          {THEME_PRESETS.slice(0, 4).map(theme => <label key={theme.id} className="entry-theme">
            <input type="radio" name="entry-theme" checked={selectedTheme.id === theme.id} onChange={() => void run(async () => { await updateThemePreset(theme.id); setThemeSaved(true); })} />
            <span className="theme-swatches" aria-hidden="true">{[theme.primary, theme.secondary, theme.accent].map((color, index) => <i key={index} style={{ background: color }} />)}</span><span>{theme.name}</span>
          </label>)}
          {!THEME_PRESETS.slice(0, 4).some(theme => theme.id === selectedTheme.id) && <p>{t('profile.themeTitle')}: {selectedTheme.name}</p>}
        </fieldset>
        {themeSaved && <p role="status">{c.saved}</p>}

        <div className="entry-actions"><button className="text-action" disabled={busy} type="button" onClick={() => { setError(''); setStep(1); }}>{c.back}</button><button className="primary-action" disabled={busy} type="button" onClick={() => void run(async () => { setEntry(await advanceEntry(client, 3)); setStep(3); })}>{c.next}</button></div>
      </>}
      {step === 3 && <>
        <p>{c.leagueHint}</p>
        {!entry.profile_complete ? <button className="primary-action" type="button" onClick={() => setStep(1)}>{c.setup}</button> : <form onSubmit={event => { event.preventDefault(); void run(async () => { setRequest(await requestEntryLeague(client, code)); }); }}>
          <label className="entry-code">{c.code}<input inputMode="numeric" autoComplete="off" pattern="[0-9]{5}" minLength={5} maxLength={5} required value={code} disabled={busy} onChange={event => { setCode(event.target.value.replace(/\D/g, '')); setRequest(null); }} /></label>
          <button className="primary-action" type="submit" disabled={busy || Boolean(request)}>{busy ? c.saving : c.join}</button>
          <p className="entry-hint">{c.approval}</p>
        </form>}
        {request && <div role="status"><p>{request.request_status === 'already_member' ? c.member : c.sent} <strong>{request.league_name}</strong>.</p><button className="primary-action" type="button" disabled={busy} onClick={() => void run(() => leave('/home'))}>{c.home}</button></div>}
        <div className="entry-actions"><button className="text-action" disabled={busy} type="button" onClick={() => { setError(''); setStep(2); }}>{c.back}</button><button className="text-action" disabled={busy} type="button" onClick={() => void run(() => leave('/leagues/new'))}>{c.create}</button></div>
        <details className="entry-requests"><summary>{c.requests}</summary><LeagueJoinRequestStatusList refreshKey={request ? 1 : 0} /></details>
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="entry-later text-action" disabled={busy} onClick={() => void run(() => leave('/home'))} type="button">{step === 3 ? c.explore : c.later}</button>
    </section>
  </main>;
}
