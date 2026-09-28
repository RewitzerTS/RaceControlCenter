import { useEffect, useState, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { normalizeGamertag } from './gamertag';

export function ProfileGamertagEditor() {
  const { user, updateGamertag } = useAuth();
  const { client } = useLeague();
  const { t } = useI18n();
  const [saved, setSaved] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [missingIdentity, setMissingIdentity] = useState(false);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'invalid' | 'error' | 'saved' | null>(null);
  const userId = user?.id;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    setMissingIdentity(false);
    setFeedback(null);
    if (!userId) return () => { active = false; };
    void (async () => {
      try {
        const { data, error } = await client.from('driver_identities').select('gamertag').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        if (!active) return;
        setMissingIdentity(!data);
        setSaved(data?.gamertag ?? '');
        setDraft(data?.gamertag ?? '');
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [client, userId, retry]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || loadError || missingIdentity) return;
    const normalized = normalizeGamertag(draft);
    if (!normalized) { setFeedback('invalid'); return; }
    setBusy(true);
    setFeedback(null);
    try {
      await updateGamertag(normalized);
      setSaved(normalized);
      setDraft(normalized);
      setFeedback('saved');
    } catch {
      setFeedback('error');
    } finally {
      setBusy(false);
    }
  }

  return <details className="profile-personalization profile-gamertag-card">
    <summary className="profile-setting-summary"><strong>{t('profile.gamertagEdit')}</strong><span className="profile-setting-current">{saved || '–'}</span></summary>
    {loading ? <p role="status">{t('pending')}</p> : loadError ? <div><p className="form-error" role="alert">{t('profile.gamertagLoadError')}</p><button className="text-action" onClick={() => setRetry(value => value + 1)} type="button">{t('profile.gamertagRetry')}</button></div> : missingIdentity ? <p><NavLink className="text-action" to="/onboarding">{t('profile.gamertagSetup')}</NavLink></p> : <form className="profile-form profile-form--expanded" onSubmit={(event) => void save(event)} aria-busy={busy}>
      <p id="profile-gamertag-hint">{t('profile.gamertagCopy')}</p>
      <label htmlFor="profile-gamertag">{t('onboarding.gamertag')}</label>
      <input id="profile-gamertag" aria-describedby="profile-gamertag-hint profile-gamertag-rules" aria-invalid={feedback === 'invalid'} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={60} minLength={2} disabled={busy} required value={draft} onChange={(event) => { setDraft(event.target.value); setFeedback(null); }} />
      <small id="profile-gamertag-rules">{t('profile.gamertagRules')}</small>
      {feedback === 'invalid' && <p className="form-error" role="alert">{t('profile.gamertagInvalid')}</p>}
      {feedback === 'error' && <p className="form-error" role="alert">{t('profile.gamertagSaveError')}</p>}
      {feedback === 'saved' && <p className="form-success" role="status">{t('profile.gamertagSaved')}</p>}
      <button className="primary-action" disabled={busy || draft.trim() === saved} type="submit">{busy ? t('pending') : t('profile.gamertagSave')}</button>
    </form>}
  </details>;
}
