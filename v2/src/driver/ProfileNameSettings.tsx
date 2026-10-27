import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { loadNameSettings, saveNameSettings, nameCopy, type NameSettings, type PublicNameMode } from './nameSettings';
import './nameSettings.css';

export function PublicNameChoice({ name, tag, value, onChange }: { name: string; tag: string; value: PublicNameMode | ''; onChange: (value: PublicNameMode | '') => void }) {
  const { language } = useI18n(); const c = nameCopy[language];
  return <>
    <label>{c.choice}<select required value={value} onChange={event => onChange(event.target.value as PublicNameMode | '')}>
      <option value="">{c.choose}</option><option value="name">{c.name}</option><option value="gamertag" disabled={!tag.trim()}>{c.tag}</option>
    </select></label>
    {value && <p>{c.preview}: <strong>{value === 'name' ? name.trim() || '—' : tag.trim() || '—'}</strong></p>}
  </>;
}

export function ProfileNameSettings({ onName }: { onName: (name: string) => void }) {
  const { client } = useLeague(); const { user } = useAuth(); const { language, t } = useI18n(); const c = nameCopy[language];
  const [saved, setSaved] = useState<NameSettings | null>(null);
  const [name, setName] = useState(''); const [mode, setMode] = useState<PublicNameMode | ''>('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [loadError, setLoadError] = useState(false); const [stale, setStale] = useState(false);
  const [success, setSuccess] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setLoadError(false); setStale(false); setSuccess(false);
    void loadNameSettings(client).then(data => {
      if (!active) return; setSaved(data); setName(data?.name ?? ''); setMode(data?.public_name_mode ?? '');
      if (data?.name) onName(data.name);
    }).catch(() => { if (active) setLoadError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, user?.id, retry, onName]);
  return <details className="profile-personalization profile-name-card">
    <summary className="profile-setting-summary"><strong>{c.title}</strong><span className="profile-setting-current">{saved?.name || '—'}</span></summary>
    {loading ? <p role="status">{t('pending')}</p> : loadError ? <><p role="alert">{c.loadError}</p><button className="text-action" type="button" onClick={() => setRetry(n => n + 1)}>{c.retry}</button></> : !saved ? <NavLink to="/onboarding" className="text-action">{c.setup}</NavLink> : <form className="profile-form profile-form--expanded" aria-busy={busy} onSubmit={event => {
      event.preventDefault(); if (busy || stale || !mode) return; setBusy(true); setError(''); setSuccess(false);
      void saveNameSettings(client, name, mode, saved.revision).then(data => {
        setSaved(data); setName(data.name); onName(data.name); setSuccess(true);
        void client.auth.refreshSession().catch(() => undefined);
      }).catch(reason => {
        const code = String(reason?.message ?? ''); const changed = code.includes('NAME_SETTINGS_STALE'); setStale(changed);
        setError(changed ? c.stale : code.includes('NAME_SETTINGS_INVALID') ? c.invalid : code.includes('NAME_SETTINGS_TAG_REQUIRED') ? c.tagRequired : c.error);
      }).finally(() => setBusy(false));
    }}>
      {saved.needs_confirmation && <p>{c.legacy}</p>}
      <fieldset disabled={busy || stale} className="entry-fields">
        <label>{c.name}<input autoComplete="given-name" minLength={2} maxLength={60} required value={name} onChange={event => { setName(event.target.value); setSuccess(false); }} /></label>
        <small>{c.hint}</small>
        <PublicNameChoice name={name} tag={saved.gamertag ?? ''} value={mode} onChange={value => { setMode(value); setSuccess(false); }} />
        <p>{c.scope}</p>
        <button className="primary-action" type="submit" disabled={!mode || (!saved.needs_confirmation && name.trim() === saved.name && mode === saved.public_name_mode)}>{busy ? t('pending') : c.save}</button>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      {stale && <button className="text-action" type="button" onClick={() => setRetry(n => n + 1)}>{c.retry}</button>}
      {success && <p role="status">{c.saved}</p>}
    </form>}
  </details>;
}
