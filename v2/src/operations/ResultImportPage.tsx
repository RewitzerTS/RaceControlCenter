import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { analyzeRaceResultImages, prepareRaceResultImages } from './imageResultImport';
import {
  createLeagueResultDraft,
  loadConfigurationWorkspace,
  loadDriverAdminWorkspace,
  loadRaceAdminWorkspace,
  publishLeagueResultDraft,
  type ConfigurationWorkspace,
  type DriverAdminWorkspace,
  type RaceAdminWorkspace,
} from './operations';
import {
  buildResultReviewRows,
  ResultImportReviewTable,
  resultReviewRowsToImported,
  reviewRowsReady,
  type ResultReviewRow,
} from './ResultImportReviewTable';
import { parseResultCsv } from './resultCsv';
import { activeSeasonRaces } from './LeagueRacesPage';

export function ResultImportPage() {
  const { client, leagueSlug } = useLeague();
  const { role } = useRole();
  const allowed = role === 'league_admin' || role === 'platform_owner';
  const [races, setRaces] = useState<RaceAdminWorkspace | null>(null);
  const [drivers, setDrivers] = useState<DriverAdminWorkspace | null>(null);
  const [config, setConfig] = useState<ConfigurationWorkspace | null>(null);
  const [raceId, setRaceId] = useState('');
  const [reason, setReason] = useState('');
  const [csv, setCsv] = useState('driver;finish_position;grid_position;points;team_name;car_name;pit_stops;fastest_lap_time;race_time\n');
  const [reviewRows, setReviewRows] = useState<ResultReviewRow[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [importProgress, setImportProgress] = useState('');

  const reload = useCallback(async () => {
    const [raceWorkspace, driverWorkspace, configuration] = await Promise.all([
      loadRaceAdminWorkspace(client),
      loadDriverAdminWorkspace(client),
      loadConfigurationWorkspace(client),
    ]);
    setRaces(raceWorkspace);
    setDrivers(driverWorkspace);
    setConfig(configuration);
  }, [client]);

  useEffect(() => {
    if (allowed) void reload().catch((error) => setMessage(error instanceof Error ? error.message : 'Import konnte nicht geladen werden.'));
  }, [allowed, reload]);

  async function analyze() {
    setBusy('analyze');
    setMessage('');
    setWarnings([]);
    setReviewRows([]);
    setImportProgress(`Bilder werden vorbereitet (0/${files.length}) …`);
    try {
      const race = races?.races.find((item) => item.id === raceId);
      if (!race) throw new Error('Bitte zuerst das passende Rennen auswählen.');
      const images = await prepareRaceResultImages(files, ({ completed, total, fileName }) => {
        setImportProgress(`Bild ${completed} von ${total} vorbereitet: ${fileName}`);
      });
      setImportProgress('Bilder werden sicher an die KI übertragen …');
      const analysis = await analyzeRaceResultImages(
        client,
        leagueSlug,
        images,
        drivers?.drivers ?? [],
        `R${race.round_number} · ${race.grand_prix_name}`,
      );
      setReviewRows(buildResultReviewRows(analysis, drivers?.drivers ?? []));
      setWarnings(analysis.warnings);
      setMessage(`KI-Analyse abgeschlossen: ${analysis.rows.length} Ergebniszeilen erkannt. Bitte die Tabelle kontrollieren und die Punkte bestätigen.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'KI-Bilder konnten nicht ausgewertet werden.');
    } finally {
      setBusy('');
      setImportProgress('');
    }
  }

  async function create() {
    setBusy('create');
    setMessage('');
    try {
      const rows = reviewRows.length
        ? resultReviewRowsToImported(reviewRows, drivers?.drivers ?? [])
        : parseResultCsv(csv);
      await createLeagueResultDraft(client, raceId, rows, reason);
      await reload();
      setMessage('Ergebnisentwurf wurde geprüft und gespeichert. Offizielle Daten sind noch unverändert.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Entwurf konnte nicht erstellt werden.');
    } finally {
      setBusy('');
    }
  }

  async function publish(id: string) {
    setBusy(id);
    setMessage('');
    try {
      await publishLeagueResultDraft(client, id);
      await reload();
      setMessage('Ergebnisversion wurde offiziell veröffentlicht.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ergebnis konnte nicht veröffentlicht werden.');
    } finally {
      setBusy('');
    }
  }

  if (!allowed) return <main className="driver-state" id="main-content"><span className="state-mark">17</span><div><h1>Zugriff verweigert</h1></div></main>;

  const saveReady = reviewRows.length ? reviewRowsReady(reviewRows) : csv.trim().split(/\r?\n/).length > 1;
  const availableRaces = races ? activeSeasonRaces(races) : [];
  return <main className="operations-page admin-management-page" id="main-content">
    <header className="operations-header"><div><p className="section-label">Ligaleitung · {leagueSlug}</p><h1>Ergebnisimport &amp; Freigabe</h1><p>Ergebnisbilder per KI oder eine CSV einlesen, übersichtlich prüfen und zuerst als revisionssicheren Entwurf speichern.</p></div><NavLink className="text-link" to="/admin">Zur Ligaleitung</NavLink></header>
    <section className="admin-form result-import-form">
      <div className="admin-form-columns">
        <label><span>1. Rennen auswählen</span><select required value={raceId} onChange={(event) => setRaceId(event.target.value)}><option value="">Rennen wählen</option>{availableRaces.map((race) => <option key={race.id} value={race.id}>R{race.round_number} · {race.grand_prix_name}</option>)}</select></label>
        <label><span>2. Änderungsgrund</span><input minLength={3} maxLength={500} placeholder="z. B. Ergebnisbilder vom Rennabend" value={reason} onChange={(event) => setReason(event.target.value)}/></label>
      </div>
      <div className="result-import-methods">
        <article className="result-import-method result-import-method--featured"><p className="section-label">Empfohlen</p><h2>KI-Bildimport</h2><p>1 bis 8 Screenshots der Ergebnisliste auswählen. Die Bilder werden verkleinert übertragen und automatisch ausgelesen.</p><label><span>Ergebnisbilder</span><input accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple onChange={(event) => { setFiles(Array.from(event.target.files ?? []).slice(0, 8)); setReviewRows([]); }} type="file"/><small>{files.length ? `${files.length} Bild${files.length === 1 ? '' : 'er'} ausgewählt · ${files.map((file) => file.name).join(', ')}` : 'JPG, PNG, WebP, HEIC oder HEIF · maximal 20 MB pro Bild'}</small></label>{importProgress && <small className="result-import-progress" role="status">{importProgress}</small>}<button className="primary-action" disabled={busy !== '' || !raceId || files.length === 0} onClick={() => void analyze()} type="button">{busy === 'analyze' ? 'Import läuft …' : 'Bilder mit KI auslesen'}</button></article>
        <article className="result-import-method"><p className="section-label">Alternative</p><h2>CSV importieren</h2><p>Eine bereits vorbereitete Ergebnistabelle hochladen und anschließend vor dem Speichern prüfen.</p><label><span>CSV-Datei</span><input accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then((text) => { setCsv(text); setReviewRows([]); }).catch(() => setMessage('CSV-Datei konnte nicht gelesen werden.')); }} type="file"/><small>Fahrer, Position, Grid, Punkte, Team sowie optional Stopps und Zeiten</small></label></article>
      </div>
      {message && <p className={message.includes('abgeschlossen') || message.includes('gespeichert') || message.includes('veröffentlicht') ? 'inline-success' : 'inline-error'} role="status">{message}</p>}
      {warnings.length > 0 && <aside className="ai-import-warnings"><strong>Hinweise der KI</strong><ul>{warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul></aside>}
      {reviewRows.length > 0
        ? <ResultImportReviewTable drivers={drivers?.drivers ?? []} onChange={setReviewRows} rows={reviewRows}/>
        : <label><span>3. CSV-Daten prüfen</span><textarea aria-describedby="result-review-hint" rows={12} value={csv} onChange={(event) => setCsv(event.target.value)}/><small id="result-review-hint">Nach einer KI-Auswertung erscheint an dieser Stelle automatisch die bearbeitbare Ergebnistabelle.</small></label>}
      <div className="admin-form-actions result-import-save-actions"><button className="primary-action" disabled={busy !== '' || !raceId || reason.trim().length < 3 || !saveReady} onClick={() => void create()} type="button">4. Entwurf prüfen &amp; speichern</button><small>Die offiziellen Ergebnisse bleiben bis zur separaten Freigabe unverändert.</small></div>
    </section>
    <section className="admin-data-panel"><div className="admin-panel-heading"><div><p className="section-label">5. Freigabe-Workflow</p><h2>Geprüfte Entwürfe</h2></div><strong>{config?.result_drafts.length ?? 0}</strong></div>{config?.result_drafts.length ? <div className="workflow-list">{config.result_drafts.map((draft) => <article key={draft.id}><div><h3>{draft.race_name} · V{draft.version_number}</h3><p>{draft.change_reason}</p><small>{draft.row_count} Ergebniszeilen · {draft.status}</small></div><button className="primary-action" disabled={busy !== ''} onClick={() => void publish(draft.id)} type="button">Jetzt offiziell freigeben</button></article>)}</div> : <div className="admin-empty-state"><span>✓</span><div><h3>Keine offenen Entwürfe</h3><p>Alle geprüften Ergebnisversionen sind verarbeitet.</p></div></div>}</section>
  </main>;
}
