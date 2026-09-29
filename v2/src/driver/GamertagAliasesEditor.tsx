import { useEffect, useId, useState } from 'react';
import { useLeague } from '../league/LeagueProvider';
import { useI18n } from '../i18n/I18nProvider';
import { addGamertagAlias, loadGamertagAliases, removeGamertagAlias, type AliasPlatform, type GamertagAliases } from './gamertagAliases';
import { aliasCopy } from './gamertagAliasesCopy';
import './gamertag-aliases.css';

export function GamertagAliasesEditor({ driverId, driverName }: { driverId?: string; driverName?: string }) {
  const { client, leagueSlug } = useLeague();
  const { language } = useI18n();
  const c = aliasCopy[language];
  const id = useId();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<GamertagAliases | null>(null);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [alias, setAlias] = useState('');
  const [platform, setPlatform] = useState<AliasPlatform>('other');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setData(null); setError(''); setMessage('');
    void loadGamertagAliases(client, driverId).then(value => { if (active) setData(value); })
      .catch(() => { if (active) setError(c.loadError); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, leagueSlug, driverId, open, retry, c]);
  async function mutate(removeId?: string) {
    if (busy || !data) return;
    setBusy(true); setError(''); setMessage('');
    try {
      setData(removeId ? await removeGamertagAlias(client, removeId, driverId) : await addGamertagAlias(client, alias, platform, driverId));
      if (!removeId) { setAlias(''); setPlatform('other'); }
      setMessage(removeId ? c.removed : c.saved);
    } catch (reason) {
      const text = reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : '';
      setError(text.includes('ALIAS_DUPLICATE') ? c.duplicate : text.includes('ALIAS_LIMIT') ? c.limit : text.includes('ALIAS_INVALID') ? c.invalid : c.saveError);
    } finally { setBusy(false); }
  }
  return <details className="profile-personalization gamertag-aliases" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="profile-setting-summary"><strong>{c.title}{driverName ? ` · ${driverName}` : ''}</strong></summary>
    <div className="gamertag-aliases-body" aria-busy={busy || loading}>
      <p>{driverId ? c.adminHint : c.hint}</p>
      <p>{c.matchHint}</p>
      {loading && <p role="status">{c.loading}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && !data && <button className="text-action" type="button" onClick={() => setRetry(value => value + 1)}>{c.retry}</button>}
      {data && <>
        <p>{c.main}: <strong>{data.main || '–'}</strong></p>
        {data.aliases.length ? <ul className="gamertag-alias-list">{data.aliases.map(item => <li key={item.id}>
          <div><strong>{item.alias}</strong><small>{c.platforms[item.platform] ?? c.platforms.other} · {item.scope === 'personal' ? c.personal : c.league}</small></div>
          {item.editable ? <button type="button" className="text-action" disabled={busy} aria-label={`${c.remove} ${item.alias}`} onClick={() => void mutate(item.id)}>{c.remove}</button> : <small>{c.readOnly}</small>}
        </li>)}</ul> : <p>{c.empty}</p>}
        <form className="gamertag-alias-form" onSubmit={event => { event.preventDefault(); void mutate(); }}>
          <label htmlFor={`${id}-name`}>{c.name}<input id={`${id}-name`} required minLength={2} maxLength={60} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy} value={alias} onChange={event => setAlias(event.target.value)} /></label>
          <label htmlFor={`${id}-platform`}>{c.platform}<select id={`${id}-platform`} disabled={busy} value={platform} onChange={event => setPlatform(event.target.value as AliasPlatform)}>{Object.entries(c.platforms).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="primary-action" type="submit" disabled={busy || !alias.trim()}>{busy ? c.saving : c.add}</button>
        </form>
      </>}
      {message && <p className="form-success" role="status">{message}</p>}
    </div>
  </details>;
}
