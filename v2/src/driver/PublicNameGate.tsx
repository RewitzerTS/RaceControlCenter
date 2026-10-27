import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import raceVoraMark from '../../../assets/images/racevora-logo-color.svg';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { PublicNameChoice } from './ProfileNameSettings';
import { loadNameSettings, nameCopy, saveNameSettings, type NameSettings, type PublicNameMode } from './nameSettings';
import './entry.css';
import './publicNameGate.css';

export const confirmationCopy = {
  de: { title: 'Wie möchtest du angezeigt werden?', intro: 'Bitte bestätige einmalig deinen Namen und deine öffentliche Anzeige, bevor du RaceVora weiter nutzt.', save: 'Speichern und weiter', loading: 'Deine Namenseinstellung wird geprüft …', missing: 'Richte zuerst deinen Namen und Gamertag ein. Danach kannst du RaceVora weiter nutzen.', unchanged: 'Deine Fahrerzuordnungen, Ergebnisse und Statistiken bleiben erhalten.', tagMissing: 'Noch kein Haupt-Gamertag hinterlegt. Du kannst zunächst deinen Namen wählen und später im Profil einen Gamertag ergänzen.' },
  en: { title: 'How would you like to appear?', intro: 'Confirm your name and public appearance once before continuing in RaceVora.', save: 'Save and continue', loading: 'Checking your name settings …', missing: 'Set up your name and gamertag first. You can then continue in RaceVora.', unchanged: 'Your driver links, results and statistics stay unchanged.', tagMissing: 'No main gamertag saved yet. You can choose your name now and add a gamertag in your profile later.' },
  es: { title: '¿Cómo quieres aparecer?', intro: 'Confirma una vez tu nombre e identidad pública antes de continuar en RaceVora.', save: 'Guardar y continuar', loading: 'Comprobando tus datos de nombre …', missing: 'Configura primero tu nombre y gamertag. Después podrás continuar en RaceVora.', unchanged: 'Se conservan tus vínculos de piloto, resultados y estadísticas.', tagMissing: 'Aún no tienes un gamertag principal. Puedes elegir tu nombre y añadir un gamertag en tu perfil más tarde.' },
  fr: { title: 'Comment souhaitez-vous apparaître ?', intro: 'Confirmez une fois votre nom et votre identité publique avant de continuer dans RaceVora.', save: 'Enregistrer et continuer', loading: 'Vérification des paramètres de votre nom …', missing: 'Configurez d’abord votre nom et votre gamertag. Vous pourrez ensuite continuer dans RaceVora.', unchanged: 'Vos liens pilote, résultats et statistiques sont conservés.', tagMissing: 'Aucun gamertag principal enregistré. Vous pouvez choisir votre nom puis ajouter un gamertag dans votre profil.' },
};

export function hasConfirmedPublicName(settings: NameSettings | null): boolean {
  return Boolean(settings && !settings.needs_confirmation && settings.public_name_mode && settings.name.trim().length >= 2);
}

// Recovery and setup remain reachable; their navigation back into the app is gated again.
export function isNameConfirmationExempt(pathname: string) {
  return ['/login', '/beta', '/auth/confirm', '/auth/reset', '/onboarding',
    '/impressum.html', '/datenschutz.html', '/agb.html', '/widerruf.html'].includes(pathname.replace(/\/$/, '') || '/');
}

export function PublicNameGate({ children }: PropsWithChildren) {
  const { user, loading, signOut } = useAuth();
  const { client } = useLeague();
  const { pathname } = useLocation();
  const { language } = useI18n();
  if (loading) return <main className="entry-page name-confirmation"><p role="status">{confirmationCopy[language].loading}</p></main>;
  if (!user || isNameConfirmationExempt(pathname)) return children;
  // Neither auth metadata nor browser storage may substitute for the saved server choice.
  return <PublicNameConfirmation key={user.id} client={client} signOut={signOut}>{children}</PublicNameConfirmation>;
}

export function PublicNameConfirmation({ client, signOut, children }: PropsWithChildren<{
  client: LeagueSupabaseClient; signOut: () => Promise<void>;
}>) {
  const { language, t } = useI18n(); const c = nameCopy[language]; const copy = confirmationCopy[language];
  const [state, setState] = useState<{ client: LeagueSupabaseClient; settings: NameSettings | null } | null>(null);
  const [name, setName] = useState(''); const [mode, setMode] = useState<PublicNameMode | ''>('');
  const [loadError, setLoadError] = useState(false); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [stale, setStale] = useState(false); const [retry, setRetry] = useState(0);
  const pending = useRef(false); const mounted = useRef(true); const heading = useRef<HTMLHeadingElement>(null);
  const currentClient = useRef(client); currentClient.current = client;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true; setState(null); setLoadError(false); setError(''); setStale(false);
    void loadNameSettings(client).then(settings => {
      if (!active) return;
      setState({ client, settings }); setName(settings?.name ?? ''); setMode('');
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [client, retry]);
  const settings = state?.client === client ? state.settings : null;
  const allowed = state?.client === client && hasConfirmedPublicName(settings);
  useEffect(() => { if (state && !allowed) heading.current?.focus(); }, [state, allowed]);
  if (allowed) return children;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || stale || !settings || !mode) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const saved = await saveNameSettings(client, name, mode, settings.revision);
      if (!hasConfirmedPublicName(saved)) throw new Error('NAME_SETTINGS_RESPONSE');
      if (mounted.current && currentClient.current === client) setState({ client, settings: saved });
      void client.auth.refreshSession().catch(() => undefined);
    } catch (reason) {
      if (!mounted.current || currentClient.current !== client) return;
      const message = String((reason as { message?: string })?.message ?? '');
      const changed = message.includes('NAME_SETTINGS_STALE'); setStale(changed);
      setError(changed ? c.stale : message.includes('NAME_SETTINGS_INVALID') ? c.invalid : message.includes('NAME_SETTINGS_TAG_REQUIRED') ? c.tagRequired : c.error);
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }

  return <main id="main-content" className="entry-page name-confirmation" aria-labelledby="name-confirmation-title">
    <img className="name-confirmation-logo" src={raceVoraMark} alt="RaceVora" width="64" height="64" />
    <header className="entry-heading"><h1 id="name-confirmation-title" ref={heading} tabIndex={-1}>{copy.title}</h1><p>{copy.intro}</p></header>
    {loadError ? <><p role="alert">{c.loadError}</p><button type="button" className="text-action" onClick={() => setRetry(n => n + 1)}>{c.retry}</button></>
      : !state || state.client !== client ? <p role="status">{copy.loading}</p>
      : !settings ? <><p>{copy.missing}</p><NavLink className="primary-action" to="/onboarding">{c.setup}</NavLink></>
      : <form onSubmit={event => void save(event)} aria-busy={busy}>
        <fieldset className="entry-fields" disabled={busy || stale}>
          <label>{c.name}<input required minLength={2} maxLength={60} autoComplete="given-name" value={name} onChange={event => setName(event.target.value)} /></label>
          <small>{c.hint}</small>
          <p>{c.tag}: <strong>{settings.gamertag || '—'}</strong></p>
          {!settings.gamertag && <p>{copy.tagMissing}</p>}
          <PublicNameChoice name={name} tag={settings.gamertag ?? ''} value={mode} onChange={setMode} />
          <button className="primary-action" type="submit" disabled={!mode}>{busy ? t('pending') : copy.save}</button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        {stale && <button className="text-action" type="button" onClick={() => setRetry(n => n + 1)}>{c.retry}</button>}
      </form>}
    <p>{copy.unchanged}</p>
    <footer className="name-confirmation-footer">
      <button type="button" className="text-action" disabled={busy} onClick={() => {
        if (pending.current) return; pending.current = true; setBusy(true); setError('');
        void signOut().catch(() => { if (mounted.current) setError(t('profile.signOutError')); }).finally(() => { pending.current = false; if (mounted.current) setBusy(false); });
      }}>{t('shell.signOut')}</button>
      {!settings && error && <p role="alert">{error}</p>}
      <a href="/impressum.html">{t('footer.imprint')}</a><a href="/datenschutz.html">{t('footer.privacy')}</a><a href="/agb.html">{t('footer.terms')}</a><a href="/widerruf.html">{t('footer.withdrawal')}</a>
    </footer>
  </main>;
}
