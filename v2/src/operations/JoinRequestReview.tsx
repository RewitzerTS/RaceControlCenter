import { useEffect, useRef, useState } from 'react';
import { useLeague } from '../league/LeagueProvider';
import { memberDriverLinkError, type LinkableDriver } from './driverLinkApi';
import './member-driver-link.css';

type Candidate = LinkableDriver & { matched: boolean };
export function JoinRequestReview({ requestId, name, onReviewed }: { requestId: string; name: string; onReviewed: () => Promise<void> }) {
  const { client } = useLeague();
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const selection = useRef<HTMLSelectElement>(null);
  useEffect(() => { if (candidates && open) selection.current?.focus(); }, [candidates, open]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError(''); setCandidates(null); setSelected('');
    void Promise.resolve(client.rpc('get_join_request_driver_candidates', { p_request_id: requestId })).then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError || !Array.isArray(data)) { setError('Die Fahrer konnten nicht geladen werden. Bitte erneut versuchen.'); return; }
      setCandidates((data as Candidate[]).sort((a, b) => Number(b.matched) - Number(a.matched) || a.display_name.localeCompare(b.display_name)));
    }).catch(() => { if (active) setError('Die Fahrer konnten nicht geladen werden. Bitte erneut versuchen.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, requestId, open, retry]);

  async function review(decision: 'approved' | 'rejected') {
    if (lock.current || done || (decision === 'approved' && !selected)) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const { error: saveError } = await client.rpc('review_league_join_request_explicit', {
        p_request_id: requestId, p_decision: decision,
        ...(selected && selected !== 'new' ? { p_driver_id: selected } : {}),
        p_create_driver: decision === 'approved' && selected === 'new',
      });
      if (saveError) throw saveError;
      setDone(true);
      await onReviewed().catch(() => undefined);
    } catch (reason) {
      const code = reason && typeof reason === 'object' && 'code' in reason ? String(reason.code) : '';
      setError(code === '23505' ? 'Ein passender Fahrer besteht bereits oder wurde inzwischen verknüpft. Bitte lade die Auswahl neu und prüfe den vorhandenen Fahrer.' : memberDriverLinkError(reason));
    } finally { lock.current = false; setBusy(false); }
  }
  if (done) return <p role="status">Entscheidung gespeichert.</p>;
  return <div className="member-driver-link join-request-review">
    {!open ? <button className="primary-action" type="button" onClick={() => setOpen(true)}>Beitritt prüfen</button> : <form aria-label={`Beitritt von ${name} prüfen`} onSubmit={event => { event.preventDefault(); void review('approved'); }}>
      <p>Bestätige, welcher Fahrer zu <strong>{name}</strong> gehört. Ein passender Gamertag ist nur ein Hinweis, kein Identitätsnachweis.</p>
      {loading && <p role="status">Fahrer werden geladen …</p>}
      {candidates && <label>Fahrerzuordnung<select ref={selection} required disabled={busy} value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">Bitte ausdrücklich auswählen</option>
        {candidates.map(driver => <option key={driver.id} value={driver.id}>{driver.matched ? 'Passender Gamertag · ' : ''}{driver.display_name}{driver.gamertag ? ` / ${driver.gamertag}` : ''}</option>)}
        <option value="new">Neuen Ligafahrer anlegen</option>
      </select></label>}
      {selected && <p>{selected === 'new' ? 'Ein neuer Ligafahrer ohne bisherige Ergebnisse wird angelegt. Nur wählen, wenn es noch kein passendes Fahrerprofil gibt.' : 'Der bestehende Fahrer behält seine Ergebnisse und Historie. Das Konto erhält Zugriff auf diese Fahrerkarriere.'}</p>}
      <div className="member-driver-actions"><button className="primary-action" disabled={busy || !selected || loading} type="submit">{busy ? 'Wird gespeichert …' : 'Beitritt und Zuordnung bestätigen'}</button><button className="text-action" disabled={busy} type="button" onClick={() => setOpen(false)}>Abbrechen</button></div>
    </form>}
    {error && <p role="alert">{error}</p>}
    {error && open && <button className="text-action" disabled={busy} type="button" onClick={() => setRetry(value => value + 1)}>Auswahl neu laden</button>}
    <button className="text-action" disabled={busy} type="button" onClick={() => void review('rejected')}>Ablehnen</button>
  </div>;
}
