import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AppState, EmptyState } from '../components/AppState';
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
import { useOperationsCopy } from './operationsCopy';
import { DEFAULT_RESULT_POINTS, type ResultScoringRules } from './resultScoring';

export function resultScoringRulesForRace(workspace: RaceAdminWorkspace | null, raceId: string): ResultScoringRules {
  const race = workspace?.races.find((item) => item.id === raceId);
  const season = workspace?.seasons.find((item) => item.id === race?.season_id);
  return {
    points: [...(workspace?.scoring_points?.length ? workspace.scoring_points : DEFAULT_RESULT_POINTS)],
    fastestLapBonusEnabled: Boolean(season?.fastest_lap_bonus_enabled),
    fastestLapBonusPoints: Number(season?.fastest_lap_bonus_points ?? 1),
    fastestLapBonusMaxFinishPosition: Number(season?.fastest_lap_bonus_max_finish_position ?? 10),
  };
}

export function ResultImportPage() {
  const { client, leagueSlug } = useLeague();
  const { role } = useRole();
  const copy = useOperationsCopy();
  const allowed = role === 'league_admin' || role === 'platform_owner';
  const [races, setRaces] = useState<RaceAdminWorkspace | null>(null);
  const [drivers, setDrivers] = useState<DriverAdminWorkspace | null>(null);
  const [config, setConfig] = useState<ConfigurationWorkspace | null>(null);
  const [raceId, setRaceId] = useState('');
  const [csv, setCsv] = useState('driver;finish_position;grid_position;points;team_name;car_name;pit_stops;fastest_lap_time;race_time\n');
  const [reviewRows, setReviewRows] = useState<ResultReviewRow[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [importMethod, setImportMethod] = useState<'images' | 'csv'>('images');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'error' | 'success'>('error');
  const [importProgress, setImportProgress] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');

  const reload = useCallback(async () => {
    setWorkspaceError('');
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
    if (allowed) void reload().catch((error) => setWorkspaceError(error instanceof Error ? error.message : copy('import.workspaceLoadError')));
  }, [allowed, copy, reload]);

  async function analyze() {
    setBusy('analyze');
    setMessage('');
    setMessageTone('error');
    setWarnings([]);
    setReviewRows([]);
    setImportProgress(copy('import.preparing', { count: files.length }));
    try {
      const race = races?.races.find((item) => item.id === raceId);
      if (!race) throw new Error(copy('import.selectRaceError'));
      const images = await prepareRaceResultImages(files, ({ completed, total, fileName }) => {
        setImportProgress(copy('import.prepared', { completed, total, file: fileName }));
      });
      setImportProgress(copy('import.uploading'));
      const analysis = await analyzeRaceResultImages(
        client,
        leagueSlug,
        images,
        drivers?.drivers ?? [],
        `R${race.round_number} · ${race.grand_prix_name}`,
      );
      setReviewRows(buildResultReviewRows(analysis, drivers?.drivers ?? [], resultScoringRulesForRace(races, raceId)));
      setWarnings(analysis.warnings);
      setMessage(copy('import.analysisDone', { count: analysis.rows.length }));
      setMessageTone('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy('import.analysisError'));
    } finally {
      setBusy('');
      setImportProgress('');
    }
  }

  async function create() {
    setBusy('create');
    setMessage('');
    setMessageTone('error');
    try {
      const rows = reviewRows.length
        ? resultReviewRowsToImported(reviewRows, drivers?.drivers ?? [], copy)
        : parseResultCsv(csv);
      const changeReason = copy(importMethod === 'images' ? 'import.reasonImages' : 'import.reasonCsv');
      await createLeagueResultDraft(client, raceId, rows, changeReason);
      await reload();
      setMessage(copy('import.draftSaved'));
      setMessageTone('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy('import.draftError'));
    } finally {
      setBusy('');
    }
  }

  async function publish(id: string) {
    setBusy(id);
    setMessage('');
    setMessageTone('error');
    try {
      await publishLeagueResultDraft(client, id);
      await reload();
      setMessage(copy('import.published'));
      setMessageTone('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy('import.publishError'));
    } finally {
      setBusy('');
    }
  }

  if (!allowed) return <AppState copy={copy('import.denied')} title={copy('shared.deniedTitle')} tone="denied" />;
  if (workspaceError && (!races || !drivers || !config)) return <AppState action={<button className="text-action" onClick={() => void reload().catch((error) => setWorkspaceError(error instanceof Error ? error.message : copy('import.workspaceLoadError')))} type="button">{copy('shared.retry')}</button>} copy={workspaceError} title={copy('import.workspaceLoadErrorTitle')} tone="error" />;
  if (!races || !drivers || !config) return <AppState copy={copy('import.loading')} title={copy('import.loadingTitle')} tone="loading" />;

  const saveReady = reviewRows.length ? reviewRowsReady(reviewRows) : importMethod === 'csv' && csv.trim().split(/\r?\n/).length > 1;
  const availableRaces = races ? activeSeasonRaces(races) : [];
  const scoringRules = resultScoringRulesForRace(races, raceId);
  return <main className="operations-page admin-management-page" id="main-content">
    <header className="operations-header"><div><p className="section-label">{copy('shared.scope', { league: leagueSlug })}</p><h1>{copy('import.title')}</h1><p>{copy('import.copy')}</p></div><NavLink className="text-link" to="/admin">{copy('shared.back')}</NavLink></header>
    <section className="admin-form result-import-form">
      <div className="admin-form-columns result-import-race-row">
        <label><span>{copy('import.selectRace')}</span><select required value={raceId} onChange={(event) => { setRaceId(event.target.value); setReviewRows([]); setWarnings([]); }}><option value="">{copy('import.chooseRace')}</option>{availableRaces.map((race) => <option key={race.id} value={race.id}>R{race.round_number} · {race.grand_prix_name}</option>)}</select></label>
      </div>
      <fieldset className="result-import-source"><legend>{copy('import.method')}</legend><div><label className={importMethod === 'images' ? 'is-selected' : ''}><input checked={importMethod === 'images'} name="result-import-method" onChange={() => { setImportMethod('images'); setReviewRows([]); }} type="radio"/><span><strong>{copy('import.images')}</strong><small>{copy('import.imagesHint')}</small></span></label><label className={importMethod === 'csv' ? 'is-selected' : ''}><input checked={importMethod === 'csv'} name="result-import-method" onChange={() => { setImportMethod('csv'); setReviewRows([]); }} type="radio"/><span><strong>{copy('import.csv')}</strong><small>{copy('import.csvHint')}</small></span></label></div></fieldset>
      {importMethod === 'images'
        ? <section className="result-import-method result-import-method--featured"><div><h2>{copy('import.selectImages')}</h2><p>{copy('import.imagesCopy')}</p></div><label><span>{copy('import.imageLabel')}</span><input accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple onChange={(event) => { setFiles(Array.from(event.target.files ?? []).slice(0, 8)); setReviewRows([]); }} type="file"/><small>{files.length ? copy(files.length === 1 ? 'import.imageSelected.one' : 'import.imageSelected.other', { count: files.length, files: files.map((file) => file.name).join(', ') }) : copy('import.imageFormats')}</small></label>{importProgress && <small className="result-import-progress" role="status">{importProgress}</small>}<button className="primary-action" disabled={busy !== '' || !raceId || files.length === 0} onClick={() => void analyze()} type="button">{busy === 'analyze' ? copy('import.analyzing') : copy('import.analyze')}</button></section>
        : <section className="result-import-method"><div><h2>{copy('import.selectCsv')}</h2><p>{copy('import.csvCopy')}</p></div><label><span>{copy('import.csv')}</span><input accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then((text) => { setCsv(text); setReviewRows([]); }).catch(() => { setMessageTone('error'); setMessage(copy('import.csvReadError')); }); }} type="file"/><small>{copy('import.csvColumns')}</small></label></section>}
      {message && <p className={messageTone === 'success' ? 'inline-success' : 'inline-error'} role="status">{message}</p>}
      {warnings.length > 0 && <aside className="ai-import-warnings"><strong>{copy('import.aiWarnings')}</strong><ul>{warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul></aside>}
      {reviewRows.length > 0
        ? <ResultImportReviewTable drivers={drivers?.drivers ?? []} onChange={setReviewRows} rows={reviewRows} scoringRules={scoringRules}/>
        : importMethod === 'csv'
          ? <label><span>{copy('import.checkCsv')}</span><textarea aria-describedby="result-review-hint" aria-label={copy('import.checkCsv')} rows={12} value={csv} onChange={(event) => setCsv(event.target.value)}/><small id="result-review-hint">{copy('import.checkCsvHint')}</small></label>
          : <div className="result-import-waiting"><strong>{copy('import.waitingTitle')}</strong><p>{copy('import.waitingCopy')}</p></div>}
      <div className="admin-form-actions result-import-save-actions"><button className="primary-action" disabled={busy !== '' || !raceId || !saveReady} onClick={() => void create()} type="button">{copy('import.saveDraft')}</button><small>{copy('import.officialUnchanged')}</small></div>
    </section>
    <section className="admin-data-panel"><div className="admin-panel-heading"><div><p className="section-label">{copy('import.release')}</p><h2>{copy('import.reviewedDrafts')}</h2></div><strong>{config.result_drafts.length}</strong></div>{config.result_drafts.length ? <div className="workflow-list">{config.result_drafts.map((draft) => <article key={draft.id}><div><h3>{draft.race_name} · V{draft.version_number}</h3><p>{draft.change_reason}</p><small>{copy('import.rows', { count: draft.row_count, status: draft.status })}</small></div><button className="primary-action" disabled={busy !== ''} onClick={() => void publish(draft.id)} type="button">{copy('import.publishNow')}</button></article>)}</div> : <EmptyState copy={copy('import.noDraftsCopy')} title={copy('import.noDraftsTitle')} />}</section>
  </main>;
}
