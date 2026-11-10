import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLeague } from '../league/LeagueProvider';
import type { LeagueRace } from './operations';
import './race-annulment.css';

export function annulmentError(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (message.includes('ANNUL_STALE')) return 'Das Rennen wurde inzwischen geändert. Schließe dieses Fenster, lade die Rennliste neu und prüfe den aktuellen Stand.';
  if (message.includes('ANNUL_REASON_REQUIRED')) return 'Bitte gib eine Begründung mit 3 bis 500 Zeichen ein.';
  if (message.includes('ANNUL_RECALCULATION_FAILED')) return 'Die Rückrechnung konnte nicht vollständig abgeschlossen werden. Das Rennen wurde nicht verändert. Bitte erneut versuchen.';
  if (message.includes('ANNUL_ACCESS_DENIED')) return 'Du kannst nur Rennen der aktiven Saison deiner Liga annullieren.';
  return 'Das Rennen konnte nicht annulliert werden. Bitte lade den aktuellen Stand und versuche es erneut.';
}

export function RaceAnnulmentDialog({ race, onClose, onSaved }: {
  race: LeagueRace; onClose: () => void; onSaved: () => void;
}) {
  const { client } = useLeague();
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !race.updated_at || reason.trim().length < 3) return;
    setBusy(true); setError('');
    try {
      const response = await client.rpc('annul_league_race', {
        p_race_id: race.id, p_expected_version_id: race.current_result_version_id ?? null,
        p_expected_updated_at: race.updated_at, p_reason: reason.trim(),
      });
      if (response.error) throw response.error;
      onSaved();
    } catch (error) { setError(annulmentError(error)); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="race-annulment-dialog" aria-labelledby="annul-title"
    onCancel={event => { if (busy) event.preventDefault(); }} onClose={onClose}>
    <form onSubmit={event => void submit(event)}>
      <h2 id="annul-title">Rennen annullieren</h2>
      <p><strong>R{race.round_number} · {race.grand_prix_name}</strong></p>
      <p>Dieses Rennen zählt danach nicht mehr zur Fahrer- und Team-WM, zu Statistiken, XP oder zugehörigen Belohnungen. Gespeicherte Ergebnisentwürfe werden verworfen.</p>
      <p>Es bleibt als „Annulliert“ im Kalender. Alle anderen Termine und Rundennummern bleiben unverändert. Diese Aktion kann hier nicht rückgängig gemacht werden.</p>
      <label>Begründung<textarea autoFocus required minLength={3} maxLength={500} rows={3} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="race-annulment-actions">
        <button type="button" className="text-action" disabled={busy} onClick={onClose}>Abbrechen</button>
        <button type="submit" className="text-action race-annulment-confirm" disabled={busy || reason.trim().length < 3 || !race.updated_at}>{busy ? 'Wertung wird zurückgerechnet …' : 'Rennen endgültig annullieren'}</button>
      </div>
    </form>
  </dialog>;
}
