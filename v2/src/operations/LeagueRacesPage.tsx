import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AppState } from '../components/AppState';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { completeLeagueSeason, loadRaceAdminWorkspace, type RaceAdminWorkspace } from './operations';

type ViewMode = 'races' | 'results' | 'standings';
const STATUS_LABELS: Record<string, string> = { upcoming: 'Geplant', completed: 'Abgeschlossen', cancelled: 'Abgesagt', active: 'Offiziell', draft: 'Entwurf', validated: 'Geprüft', superseded: 'Ersetzt', void: 'Ungültig' };

export function seasonCompletionBlockers(races: RaceAdminWorkspace['races'], seasonId: string) {
  return races
    .filter((race) => race.season_id === seasonId)
    .filter((race) => race.status === 'upcoming' || (race.status === 'completed' && race.result_status !== 'active'))
    .map((race) => ({
      id: race.id,
      name: race.grand_prix_name,
      reason: race.status === 'upcoming' ? 'Rennen noch nicht abgeschlossen' : 'Offizielles Ergebnis fehlt',
      round: race.round_number,
    }));
}

export function activeSeasonRaces(workspace: RaceAdminWorkspace) {
  const activeSeason = workspace.seasons.find((season) => season.is_active);
  return activeSeason ? workspace.races.filter((race) => race.season_id === activeSeason.id) : [];
}

function MobileRaceRows({ races, formatDate }: {
  races: RaceAdminWorkspace['races'];
  formatDate: ReturnType<typeof useI18n>['formatDate'];
}) {
  return <ol className="mobile-admin-data-list">{races.map((race) => <li key={race.id}>
    <div className="mobile-admin-data-heading"><span>R{race.round_number}</span><div><strong>{race.grand_prix_name}</strong><small>{race.circuit_name || race.season_name}{race.has_sprint ? ' · Sprint' : ''}</small></div><span className={`admin-status admin-status--${race.status}`}>{STATUS_LABELS[race.status] ?? race.status}</span></div>
    <dl><div><dt>Termin</dt><dd>{race.race_date ? formatDate(race.race_date) : 'Offen'}</dd></div><div><dt>Ergebnis</dt><dd>{race.result_status ? `V${race.result_version} · ${STATUS_LABELS[race.result_status] ?? race.result_status}` : 'Noch offen'}</dd></div><div><dt>Starter</dt><dd>{race.result_count}</dd></div></dl>
  </li>)}</ol>;
}

function MobileDriverStandings({ workspace, formatNumber }: {
  workspace: RaceAdminWorkspace;
  formatNumber: ReturnType<typeof useI18n>['formatNumber'];
}) {
  return <ol className="mobile-standing-list">{workspace.driver_standings.map((entry, index) => <li key={entry.driver_id}>
    <span>{index + 1}</span><div><strong>{entry.display_name}</strong><small>{entry.gamertag ?? `${entry.starts} Starts`}</small></div><b>{formatNumber(entry.points)} Pkt.</b><small>{entry.wins} Siege · {entry.podiums} Podien</small>
  </li>)}</ol>;
}

function MobileTeamStandings({ workspace, formatNumber }: {
  workspace: RaceAdminWorkspace;
  formatNumber: ReturnType<typeof useI18n>['formatNumber'];
}) {
  return <ol className="mobile-standing-list">{workspace.team_standings.map((entry, index) => <li key={entry.team_name}>
    <span>{index + 1}</span><div><strong>{entry.team_name}</strong><small>{entry.podiums} Podien</small></div><b>{formatNumber(entry.points)} Pkt.</b><small>{entry.wins} Siege</small>
  </li>)}</ol>;
}

export function LeagueRacesPage() {
  const { client, leagueSlug } = useLeague();
  const { role } = useRole();
  const { formatDate, formatNumber } = useI18n();
  const { pathname } = useLocation();
  const [workspace, setWorkspace] = useState<RaceAdminWorkspace | null>(null);
  const [error, setError] = useState('');
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [completionMessage, setCompletionMessage] = useState('');
  const allowed = role === 'league_admin' || role === 'platform_owner';
  const mode: ViewMode = pathname.endsWith('/results') ? 'results' : pathname.endsWith('/standings') ? 'standings' : 'races';

  const reload = useCallback(async () => {
    setError('');
    setWorkspace(await loadRaceAdminWorkspace(client));
  }, [client]);

  useEffect(() => {
    if (!allowed) return;
    void reload().catch((reason) => setError(reason instanceof Error ? reason.message : 'Rennverwaltung konnte nicht geladen werden.'));
  }, [allowed, reload]);

  if (!allowed) return <AppState copy="Du benötigst die Rolle Ligaleitung, um Rennen, Ergebnisse und Wertungen zu verwalten." title="Zugriff verweigert" tone="denied" />;
  if (!workspace && !error) return <AppState copy="Rennkalender, Ergebnisstände und Wertungen werden geladen." title="Rennverwaltung wird geladen" tone="loading" />;
  if (!workspace) return <AppState action={<button className="text-action" onClick={() => void reload().catch((reason) => setError(reason instanceof Error ? reason.message : 'Rennverwaltung konnte nicht geladen werden.'))} type="button">Erneut versuchen</button>} copy={error} title="Rennverwaltung nicht verfügbar" tone="error" />;

  const visibleRaces = activeSeasonRaces(workspace);
  const officialRaces = visibleRaces.filter((race) => race.result_status === 'active').length;
  const stewardRevisions = visibleRaces.filter((race) => race.result_revision?.stewardCaseNumber);
  const currentSeason = workspace.seasons.find((season) => season.is_active);
  const completionBlockers = currentSeason ? seasonCompletionBlockers(visibleRaces, currentSeason.id) : [];

  async function finishSeason() {
    if (!currentSeason) return;
    setCompletionBusy(true);
    setError('');
    try {
      await completeLeagueSeason(client, currentSeason.id);
      const nextWorkspace = await loadRaceAdminWorkspace(client);
      setWorkspace(nextWorkspace);
      setCompletionOpen(false);
      setCompletionMessage(`${currentSeason.name} wurde abgeschlossen und ist jetzt im Kalender-Archiv verfügbar.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Die Saison konnte nicht abgeschlossen werden.');
    } finally {
      setCompletionBusy(false);
    }
  }

  return <main className="operations-page admin-management-page" id="main-content">
    <header className="operations-header"><div><p className="section-label">Ligaleitung · {leagueSlug}</p><h1>{mode === 'races' ? 'Rennen' : mode === 'results' ? 'Ergebnisse' : 'Wertungen'}</h1><p>Rennkalender, offizielle Ergebnisstände und Meisterschaft der aktiven Liga in einer gemeinsamen, revisionssicheren Übersicht.</p></div><NavLink className="text-link" to="/admin">Zur Ligaleitung</NavLink></header>
    <nav className="admin-view-tabs" aria-label="Rennverwaltung"><NavLink to="/admin/races">Rennen</NavLink><NavLink to="/admin/results">Ergebnisse</NavLink><NavLink to="/admin/standings">Wertungen</NavLink></nav>
    <section className="operations-metrics admin-race-metrics" aria-label="Saisonübersicht"><div><strong>{formatNumber(visibleRaces.length)}</strong><span>Rennen</span></div><div><strong>{formatNumber(officialRaces)}</strong><span>Offizielle Ergebnisse</span></div><div><strong>{formatNumber(workspace.driver_standings.length)}</strong><span>Gewertete Fahrer</span></div><div><strong>{currentSeason?.name ?? '—'}</strong><span>Aktive Saison</span></div></section>
    {completionMessage && <section className="season-completion-success" role="status"><p>{completionMessage}</p><NavLink className="text-link" to="/racing/history?view=seasons">Saisonarchiv öffnen</NavLink></section>}
    {mode === 'races' && currentSeason && <section className="season-completion-panel" aria-labelledby="season-completion-title">
      <div><p className="section-label">Saisonverwaltung</p><h2 id="season-completion-title">{currentSeason.name} abschließen</h2><p>Alle Rennen, Ergebnisversionen und Wertungen bleiben unverändert erhalten und werden im Kalender-Archiv verfügbar.</p></div>
      {completionBlockers.length > 0
        ? <aside className="season-completion-blocked" aria-label="Saisonabschluss gesperrt" role="status"><strong>Abschluss gesperrt</strong><p>{completionBlockers.length} {completionBlockers.length === 1 ? 'Rennen ist' : 'Rennen sind'} noch offen.</p><ul>{completionBlockers.slice(0, 5).map((blocker) => <li key={blocker.id}><span>R{blocker.round} · {blocker.name}</span><small>{blocker.reason}</small></li>)}</ul>{completionBlockers.length > 5 && <small>Weitere {completionBlockers.length - 5} offene Rennen</small>}<NavLink className="text-link" to="/admin/results">Offene Rennen bearbeiten</NavLink></aside>
        : !completionOpen ? <button className="text-action" type="button" onClick={() => setCompletionOpen(true)}>Saison abschließen</button> : <div className="season-completion-confirm" role="group" aria-label="Saisonabschluss bestätigen"><p>Danach gibt es keine aktive Saison, bis eine neue Saison gestartet wird.</p><div><button className="text-action" disabled={completionBusy} type="button" onClick={() => setCompletionOpen(false)}>Abbrechen</button><button className="primary-action" disabled={completionBusy} type="button" onClick={() => void finishSeason()}>{completionBusy ? 'Saison wird abgeschlossen …' : 'Abschluss bestätigen'}</button></div></div>}
    </section>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {mode === 'results' && stewardRevisions.length > 0 && <section className="result-revision-summary" aria-labelledby="steward-revisions-title"><div><p className="section-label">Nachvollziehbare Änderungen</p><h2 id="steward-revisions-title">Steward-Revisionen</h2><p>Diese offiziellen Ergebnisse wurden durch abgeschlossene Steward-Fälle aktualisiert.</p></div><ul>{stewardRevisions.map((race) => <li key={race.id}><span><strong>R{race.round_number} · {race.grand_prix_name}</strong><small>{race.result_revision?.stewardCaseNumber} · {race.result_revision?.stewardOutcome}</small></span><b>V{race.result_revision?.resultVersion}</b></li>)}</ul></section>}
    {mode !== 'standings' ? <section className="admin-data-panel">
      <div className="admin-panel-heading"><div><p className="section-label">{mode === 'races' ? 'Kalender' : 'Revisionsstatus'}</p><h2>{mode === 'races' ? 'Rennwochenenden' : 'Veröffentlichte Ergebnisse'}</h2></div><strong>{visibleRaces.length}</strong></div>
      <div className="responsive-table admin-data-table"><table><thead><tr><th>Rd.</th><th>Grand Prix</th><th>Termin</th><th>Rennen</th><th>Ergebnis</th><th>Starter</th></tr></thead><tbody>{visibleRaces.map((race) => <tr key={race.id}><td>{race.round_number}</td><td><strong>{race.grand_prix_name}</strong><small>{race.circuit_name || race.season_name}{race.has_sprint ? ' · Sprint' : ''}</small></td><td>{race.race_date ? formatDate(race.race_date) : 'Offen'}</td><td><span className={`admin-status admin-status--${race.status}`}>{STATUS_LABELS[race.status] ?? race.status}</span></td><td>{race.result_status ? <><strong>V{race.result_version}</strong><small>{STATUS_LABELS[race.result_status] ?? race.result_status}</small></> : <span className="admin-status">Noch offen</span>}</td><td>{race.result_count}</td></tr>)}</tbody></table></div>
      <MobileRaceRows formatDate={formatDate} races={visibleRaces}/>
    </section> : <div className="standings-grid">
      <section className="admin-data-panel"><div className="admin-panel-heading"><div><p className="section-label">Fahrer-WM</p><h2>Fahrerwertung</h2></div><strong>{workspace.driver_standings.length}</strong></div><div className="responsive-table admin-data-table"><table><thead><tr><th>Pos.</th><th>Fahrer</th><th>Punkte</th><th>Siege</th><th>Podien</th></tr></thead><tbody>{workspace.driver_standings.map((entry, index) => <tr key={entry.driver_id}><td>{index + 1}</td><td><strong>{entry.display_name}</strong><small>{entry.gamertag ?? `${entry.starts} Starts`}</small></td><td><strong>{formatNumber(entry.points)}</strong></td><td>{entry.wins}</td><td>{entry.podiums}</td></tr>)}</tbody></table></div><MobileDriverStandings formatNumber={formatNumber} workspace={workspace}/></section>
      <section className="admin-data-panel"><div className="admin-panel-heading"><div><p className="section-label">Team-WM</p><h2>Teamwertung</h2></div><strong>{workspace.team_standings.length}</strong></div><div className="responsive-table admin-data-table"><table><thead><tr><th>Pos.</th><th>Team</th><th>Punkte</th><th>Siege</th></tr></thead><tbody>{workspace.team_standings.map((entry, index) => <tr key={entry.team_name}><td>{index + 1}</td><td><strong>{entry.team_name}</strong><small>{entry.podiums} Podien</small></td><td><strong>{formatNumber(entry.points)}</strong></td><td>{entry.wins}</td></tr>)}</tbody></table></div><MobileTeamStandings formatNumber={formatNumber} workspace={workspace}/></section>
    </div>}
  </main>;
}
