import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { AppState } from '../components/AppState';
import { buildReverseGrid, loadReverseGrid, type ReverseGridSnapshot } from './reverseGrid';
import { draftChampionshipError } from './draftChampionship';
import './reverse-grid.css';

export function ReverseGridPage() {
  const { client } = useLeague();
  const { role } = useRole();
  const allowed = role === 'league_admin' || role === 'platform_owner';
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ data: ReverseGridSnapshot | null; error: string; loading: boolean }>({ data: null, error: '', loading: true });
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    setState({ data: null, error: '', loading: true });
    void loadReverseGrid(client, includeDrafts, controller.signal).then(data => {
      buildReverseGrid(data); // Validate before rendering; never keep stale rows on failure.
      if (!controller.signal.aborted) setState({ data, error: '', loading: false });
    }).catch(error => { if (!controller.signal.aborted) setState({ data: null, error: draftChampionshipError(error, 'de'), loading: false }); });
    return () => controller.abort();
  }, [allowed, client, includeDrafts, revision]);
  if (!allowed) return <AppState title="Zugriff verweigert" copy="Die Reversegrid-Aufstellung ist für Ligaleitung und Owner verfügbar." tone="denied" />;
  const rows = state.data ? buildReverseGrid(state.data) : [];
  return <main className="operations-page reverse-grid-page" id="main-content">
    <header className="operations-header"><div><h1>Reversegrid-Aufstellung</h1><p>Die Fahrer-WM in umgekehrter Reihenfolge – mit KI-Fahrer und Gamertag für eure Startaufstellung.</p></div><Link className="text-action" to="/admin">Zur Ligaleitung</Link></header>
    <div className="reverse-grid-controls"><label>Wertungsstand<select aria-label="Wertungsstand" value={includeDrafts ? 'drafts' : 'official'} onChange={event => setIncludeDrafts(event.target.value === 'drafts')}>
      <option value="official">Veröffentlichte Fahrer-WM</option><option value="drafts">Vorläufige Fahrer-WM mit Entwürfen</option>
    </select></label><button type="button" className="text-action" disabled={state.loading} onClick={() => setRevision(value => value + 1)}>Aktualisieren</button></div>
    <p className="reverse-grid-note">{includeDrafts ? 'Pro Rennen zählt der neueste gespeicherte Entwurf. Er ersetzt ein bereits veröffentlichtes Ergebnis nur in dieser Vorschau; vorgemerkte Zeitkorrekturen werden berücksichtigt.' : 'Es zählen ausschließlich veröffentlichte Ergebnisse.'} Bei Punktegleichstand wird die vorhandene WM-Reihenfolge vollständig umgekehrt. Startplatzstrafen sind hier nicht eingerechnet.</p>
    {state.loading && <p role="status">Aufstellung wird geladen …</p>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.data && !state.data.data?.season && <p>Richte zuerst eine Saison ein, um die Aufstellung zu sehen.</p>}
    {state.data?.data?.season && <>
      <div className="reverse-grid-summary"><h2>{state.data.data.season.name}</h2><span>{includeDrafts ? 'Vorläufig' : 'Offiziell'} · {rows.length} Fahrer</span></div>
      {state.data.drafts.length > 0 && <details className="reverse-grid-sources"><summary>{state.data.drafts.length} Ergebnisentwürfe einbezogen</summary><ul>{[...state.data.drafts].sort((a,b) => a.round-b.round).map(draft => <li key={draft.versionId}>R{draft.round} · {draft.raceName} · V{draft.versionNumber}</li>)}</ul></details>}
      {rows.length ? <table className="reverse-grid-table"><caption className="visually-hidden">Startaufstellung aus der umgekehrten Fahrer-WM</caption><thead><tr><th>Start</th><th>KI-Fahrer / Gamertag</th><th>WM</th><th>Punkte</th></tr></thead><tbody>{rows.map(row => <tr key={row.driverId}>
        <td>{row.gridPosition}</td><td><strong>{row.aiName || 'Keine KI-Zuordnung'}</strong><span>{row.isAi ? 'KI-Fahrer' : row.gamertag || 'Kein Gamertag hinterlegt'}</span>{!row.isAi && <small>{row.driverName}</small>}</td><td>{row.championshipPosition}</td><td>{row.points.toLocaleString('de-DE')}</td>
      </tr>)}</tbody></table> : <p>In dieser Saison sind noch keine Fahrer für die WM vorhanden.</p>}
      {rows.some(row => !row.aiName) && <p>Bei einzelnen Fahrern fehlt eine aktuelle KI-Zuordnung. Prüfe diese unter <Link to="/admin/drivers">Fahrer &amp; Teams</Link>, bevor du die Startaufstellung übernimmst.</p>}
    </>}
  </main>;
}
