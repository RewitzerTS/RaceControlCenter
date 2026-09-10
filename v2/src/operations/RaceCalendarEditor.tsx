import { useState, type FormEvent } from 'react';
import { useLeague } from '../league/LeagueProvider';
import type { Json } from '../types/database';
import type { SeasonCalendarEntry, SeasonTrackPreset } from './operations';
import './race-calendar-editor.css';

type EditableRace = SeasonCalendarEntry & { id: string; round: number; name: string; locked: boolean; updated_at: string };
type CalendarWorkspace = { season_id: string | null; races: EditableRace[]; tracks: SeasonTrackPreset[] };
function errorMessage(error: unknown) {
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Kalender konnte nicht gespeichert werden. Bitte erneut versuchen.';
}

export function RaceCalendarEditor({ onSaved }: { onSaved: () => Promise<void> }) {
  const { client } = useLeague();
  const [workspace, setWorkspace] = useState<CalendarWorkspace | null>(null);
  const [editing, setEditing] = useState<EditableRace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function load() {
    setBusy(true); setError('');
    try {
      const { data, error } = await client.rpc('get_editable_race_calendar');
      if (error) throw error;
      setWorkspace(data as unknown as CalendarWorkspace);
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await client.rpc('update_league_calendar_race', {
        p_race_id: editing.id, p_expected_updated_at: editing.updated_at,
        p_entry: { track_key: editing.track_key, date: editing.date, time: editing.time, weather: editing.weather, has_sprint: editing.has_sprint } as Json,
      });
      if (error) throw error;
      setEditing(null); setMessage('Änderungen gespeichert. Bestehende Ergebnisse bleiben unverändert.');
      await load(); await onSaved();
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <details className="admin-data-panel race-calendar-editor" onToggle={(event) => { if (event.currentTarget.open && !workspace && !busy) void load(); }}>
    <summary>Rennkalender bearbeiten</summary>
    <p>Termine, Strecken, Wetter und Sprint für geplante Rennen ändern. Rennen mit Ergebnisentwürfen oder abgeschlossenem Status sind geschützt.</p>
    {error && <div><p className="inline-error" role="alert">{error}</p>{workspace && <button type="button" className="text-action" disabled={busy} onClick={() => { setEditing(null); void load(); }}>Eingaben verwerfen und aktuellen Stand laden</button>}</div>}
    {message && <p className="inline-success" role="status">{message}</p>}
    {busy && <p role="status">Kalender wird verarbeitet …</p>}
    {!workspace && !busy && <button type="button" className="text-action" onClick={() => void load()}>Erneut laden</button>}
    {workspace && !editing && <div className="workflow-list">{workspace.races.map((race) => <article key={race.id}>
      <div><strong>R{race.round} · {race.name}</strong><p>{race.date || 'Termin offen'} · {race.time}</p>{race.locked && <small>Geschützt: Rennen oder Ergebnis bereits vorhanden</small>}</div>
      <button className="text-action" type="button" disabled={busy || race.locked} onClick={() => { setEditing({ ...race, time: (race.time ?? '').slice(0, 5), has_sprint: Boolean(race.has_sprint) }); setError(''); setMessage(''); }}>Rennen bearbeiten</button>
    </article>)}{!workspace.races.length && <p>Keine Rennen in der aktiven Saison.</p>}</div>}
    {workspace && editing && <form className="admin-form" onSubmit={(event) => void save(event)}>
      <h3>R{editing.round} · {editing.name}</h3>
      <div className="admin-form-columns">
        <label>Strecke<select required disabled={busy} value={editing.track_key ?? ''} onChange={(event) => setEditing({ ...editing, track_key: event.target.value })}><option value="">Strecke wählen</option>{workspace.tracks.map((track) => <option key={track.key} value={track.key} disabled={workspace.races.some((race) => race.id !== editing.id && race.track_key === track.key)}>{track.grand_prix_name}</option>)}</select></label>
        <label>Datum<input required disabled={busy} type="date" value={editing.date ?? ''} onChange={(event) => setEditing({ ...editing, date: event.target.value })}/></label>
        <label>Startzeit (Berlin)<input required disabled={busy} type="time" value={editing.time} onChange={(event) => setEditing({ ...editing, time: event.target.value })}/></label>
        <label>Wetter<select disabled={busy} value={editing.weather} onChange={(event) => setEditing({ ...editing, weather: event.target.value as SeasonCalendarEntry['weather'] })}><option value="dynamisch">Wechselhaft</option><option value="klar">Trocken</option><option value="regen">Regen</option></select></label>
        <label className="calendar-sprint-toggle"><input disabled={busy} type="checkbox" checked={editing.has_sprint} onChange={(event) => setEditing({ ...editing, has_sprint: event.target.checked })}/><span>Sprint-Wochenende</span></label>
      </div>
      <div className="admin-form-actions"><button className="text-action" type="button" disabled={busy} onClick={() => setEditing(null)}>Abbrechen</button><button className="primary-action" disabled={busy} type="submit">Änderungen speichern</button></div>
    </form>}
  </details>;
}
