import { useEffect, useState } from 'react';
import { useLeague } from '../league/LeagueProvider';
import type { DriverAdminWorkspace } from './operations';
import { isHumanDriver, loadRosterWorkspace, vehicleChangeRounds, type RosterWorkspace } from './roster';
import { editableAliases, loadDriverEditor, occupiedAi, platformLabels, saveDriverEditor, type DriverEditorState, type EditorAlias } from './driverEditor';
import type { AliasPlatform } from '../driver/gamertagAliases';

export function LeagueDriverEditor({ driverId, workspace, onClose, onSaved }: {
  driverId?: string; workspace: DriverAdminWorkspace; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const { client } = useLeague();
  const [state, setState] = useState<DriverEditorState | null>(null);
  const [roster, setRoster] = useState<RosterWorkspace | null>(null);
  const [profile, setProfile] = useState({ display_name: '', gamertag: '', nationality_code: '', is_active: true });
  const [aliases, setAliases] = useState<EditorAlias[]>([]);
  const [aiId, setAiId] = useState('');
  const [round, setRound] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [stale, setStale] = useState(false);
  const [committed, setCommitted] = useState(false);
  useEffect(() => {
    let active = true;
    setState(null); setError(''); setStale(false); setAiId(''); setRound('');
    void Promise.all([loadDriverEditor(client, driverId), loadRosterWorkspace(client)]).then(([data, races]) => {
      if (!active) return;
      setState(data); setRoster(races); setAliases(editableAliases(data.gamertags));
      setProfile({ display_name: data.driver?.display_name ?? '', gamertag: data.driver?.gamertag ?? '', nationality_code: data.driver?.nationality_code ?? '', is_active: data.driver?.is_active ?? true });
    }).catch(() => { if (active) setError('Das Fahrerformular konnte nicht geladen werden. Bitte erneut laden.'); });
    return () => { active = false; };
  }, [client, driverId, retry]);
  const rounds = vehicleChangeRounds(roster?.races ?? []);
  const human = !state?.driver || isHumanDriver(state.driver);
  const current = workspace.ai_assignments.find(a => a.human_driver_id === driverId && a.is_current);
  const scheduled = workspace.ai_assignments.filter(a => a.human_driver_id === driverId && !a.is_current);
  const chosen = workspace.ai_drivers.find(a => a.id === aiId);
  const occupied = aiId && round ? occupiedAi(workspace.ai_assignments, aiId, driverId, Number(round)) : undefined;
  const validSeat = !aiId || Boolean(round && !occupied && profile.is_active);
  function patchAlias(index: number, value: Partial<EditorAlias>) { setAliases(rows => rows.map((row, i) => i === index ? { ...row, ...value } : row)); }
  async function finish() {
    try { await onSaved(); } catch { setError('Gespeichert. Die Übersicht konnte nicht aktualisiert werden. Bitte Übersicht erneut laden.'); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!state || busy || stale || committed || !validSeat) return;
    setBusy(true); setError('');
    try {
      await saveDriverEditor(client, { id: driverId, profile, aliases, aiId: aiId || null, round: aiId ? Number(round) : null, revision: state.revision });
      setCommitted(true); await finish();
    } catch (reason) {
      const message = reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : '';
      const isStale = message.includes('DRIVER_EDITOR_STALE'); setStale(isStale);
      setError(isStale ? 'Das Profil wurde zwischenzeitlich geändert. Lade den aktuellen Stand vor dem Bearbeiten neu.'
        : message.includes('ROSTER_RACE_LOCKED') ? 'Für dieses Rennen liegen bereits Ergebnisse vor. Wähle ein noch ungefahrenes Rennen.'
        : message.includes('ROSTER_LATER_CHANGE_EXISTS') ? 'Es ist bereits eine spätere Zuordnung geplant. Diese darf nicht überschrieben werden.'
        : message.includes('TEAM_FULL') ? 'Durch diese Zuordnung hätte ein Team mehr als zwei Fahrer. Passe zuerst die Team-Besetzung für dieses Rennen an.'
        : message.includes('already assigned') ? 'Dieser KI-Fahrer ist im gewählten Zeitraum bereits vergeben. Wähle einen freien Fahrer.'
        : message || 'Speichern fehlgeschlagen. Deine Eingaben bleiben erhalten; bitte erneut versuchen.');
    } finally { setBusy(false); }
  }
  return <section className="admin-form driver-profile-editor" aria-labelledby="driver-editor-title">
    <div className="admin-panel-heading"><h2 id="driver-editor-title">{driverId ? 'Fahrer bearbeiten' : 'Fahrer anlegen'}</h2><button type="button" className="text-action" disabled={busy} onClick={onClose}>Schließen</button></div>
    {!state && !error && <p role="status">Fahrerprofil wird geladen …</p>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {(!state || stale) && error && <button type="button" className="text-action" onClick={() => setRetry(value => value + 1)}>Formular neu laden</button>}
    {committed && <button type="button" className="text-action" onClick={() => void finish()}>Übersicht erneut laden</button>}
    {state && <form onSubmit={event => void save(event)}>
      <fieldset disabled={busy || stale || committed} className="driver-editor-fields"><legend className="sr-only">Fahrerprofil</legend>
        <div className="admin-form-columns">
          <label><span>Anzeigename</span><input autoFocus required minLength={2} maxLength={80} value={profile.display_name} onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} /></label>
          <label><span>Gamertag (allgemein)</span><input maxLength={80} autoCapitalize="none" spellCheck={false} value={profile.gamertag} onChange={e => setProfile(p => ({ ...p, gamertag: e.target.value }))} /></label>
          <label><span id="driver-number-label">Startnummer</span><input readOnly value={state.driver?.number ?? 'Noch nicht zugeordnet'} aria-labelledby="driver-number-label" aria-describedby="driver-number-hint" /><small id="driver-number-hint">Nicht bearbeitbar. Die Nummer wird bei der ersten Sitzzuordnung aus dem Spiel übernommen.</small></label>
          <label><span id="driver-nationality-label">Nationalität</span><input maxLength={2} pattern="[A-Za-z]{2}" placeholder="DE" aria-labelledby="driver-nationality-label" aria-describedby="driver-nationality-hint" value={profile.nationality_code} onChange={e => setProfile(p => ({ ...p, nationality_code: e.target.value.toUpperCase() }))} /><small id="driver-nationality-hint">Länderkürzel, z. B. DE, AT oder CH.</small></label>
        </div>
        {human && <fieldset className="driver-editor-gamertags"><legend>Gamertags nach Plattform</legend><p>Diese Namen werden beim Ergebnisimport für dieses Fahrerprofil erkannt.</p>
          <div className="driver-editor-aliases">{aliases.map((row, index) => <div className="driver-editor-alias" key={index}>
            <label><span>Plattform {index + 1}</span><select value={row.platform} onChange={e => patchAlias(index, { platform: e.target.value as AliasPlatform })}>{Object.entries(platformLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label><span>{platformLabels[row.platform]}-Gamertag {index + 1}</span><input minLength={2} maxLength={60} autoComplete="off" autoCapitalize="none" spellCheck={false} value={row.alias} onChange={e => patchAlias(index, { alias: e.target.value })} /></label>
            <button type="button" className="text-action" aria-label={`Gamertag ${index + 1} entfernen`} onClick={() => setAliases(rows => rows.filter((_, i) => i !== index))}>Entfernen</button>
          </div>)}</div>
          <button type="button" className="text-action" disabled={aliases.length >= 20} onClick={() => setAliases(rows => [...rows, { alias: '', platform: 'other' }])}>Gamertag ergänzen</button>
          {state.gamertags.aliases.some(a => !a.editable) && <div className="driver-editor-personal"><p>Zusätzlich aus dem verknüpften Konto erkannt (vom Fahrer selbst verwaltet):</p><ul>{state.gamertags.aliases.filter(a => !a.editable).map(a => <li key={a.id}>{a.alias} · {platformLabels[a.platform]}</li>)}</ul></div>}
        </fieldset>}
        {human && <fieldset className="driver-editor-ai"><legend>KI-Zuordnung</legend>
          <p>Aktuell: <strong>{current?.ai_driver_name ?? 'Keine KI-Zuordnung'}</strong></p>
          {scheduled.length > 0 && <ul>{scheduled.map(a => <li key={a.id}>{a.ai_driver_name} · ab Runde {a.effective_from_round}{a.effective_to_round ? ` bis ${a.effective_to_round}` : ''}</li>)}</ul>}
          <div className="admin-form-columns"><label><span>KI-Fahrer</span><select value={aiId} disabled={!roster?.season_id || !rounds.length} onChange={e => setAiId(e.target.value)}><option value="">Zuordnung nicht ändern</option>{workspace.ai_drivers.map(ai => {
            const used = round ? occupiedAi(workspace.ai_assignments, ai.id, driverId, Number(round)) : undefined;
            return <option key={ai.id} value={ai.id} disabled={Boolean(used)}>{ai.display_name} · {ai.car_name}{used ? ` · vergeben an ${used.human_driver_name}` : ''}</option>;
          })}</select></label>
          <label><span>Zuordnung gültig ab</span><select required={Boolean(aiId)} disabled={!roster?.season_id || !rounds.length} value={round} onChange={e => setRound(e.target.value)}><option value="">Rennen ausdrücklich auswählen</option>{rounds.map(r => <option key={r.id} value={r.round}>Runde {r.round} · {r.name}</option>)}</select></label></div>
          {!roster?.season_id ? <p>Richte zuerst eine Saison ein. Danach erscheinen die KI-Fahrer des gewählten Spiels.</p> : !rounds.length ? <p>In dieser Saison ist kein ungefahrenes Rennen mehr verfügbar.</p> : <p>Der KI-Fahrer bestimmt den F1-Sitz und das Fahrzeug. Ein bereits zugeordnetes Liga-Team bleibt erhalten. Vergangene Ergebnisse bleiben unverändert.</p>}
          {chosen && <p role="status">{chosen.display_name} · {chosen.car_name}{round ? ` · ab Runde ${round}` : ' · bitte ein Rennen auswählen'}</p>}
          {occupied && <p role="alert">Der KI-Fahrer ist im gewählten Zeitraum bereits vergeben.</p>}
        </fieldset>}
        <label className="admin-check"><input type="checkbox" checked={profile.is_active} onChange={e => setProfile(p => ({ ...p, is_active: e.target.checked }))} /><span>Fahrer aktiv</span></label>
        {aiId && !profile.is_active && <p role="alert">Aktiviere den Fahrer vor der KI-Zuordnung.</p>}
        <div className="admin-form-actions"><button className="primary-action" type="submit" disabled={!validSeat}>{busy ? 'Wird gespeichert …' : 'Fahrer speichern'}</button></div>
      </fieldset>
    </form>}
  </section>;
}
