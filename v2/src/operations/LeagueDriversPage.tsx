import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { AppState, EmptyState } from '../components/AppState';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { loadDriverAdminWorkspace, type DriverAdminWorkspace, type LeagueDriver, type LeagueDriverInput } from './operations';
import { useOperationsCopy } from './operationsCopy';
import { RosterWorkflowPanel } from './RosterWorkflowPanel';
import { isHumanDriver } from './roster';
import { loadTeamDirectory, type TeamDirectory } from './leagueTeams';
import { loadTeamManager, type TeamManager } from './teamManager';
import { LeagueTeamPanel } from './LeagueTeamPanel';
import './league-teams.css';
import { LeagueDriverEditor } from './LeagueDriverEditor';
import { DriverSetupFlow } from './DriverSetupFlow';

const EMPTY_DRIVER: LeagueDriverInput = { displayName: '', gamertag: '', number: null, nationalityCode: '', leagueTeam: '', carName: '', isActive: true };

function toInput(driver: LeagueDriver): LeagueDriverInput {
  return { id: driver.id, displayName: driver.display_name, gamertag: driver.gamertag ?? '', number: driver.number, nationalityCode: driver.nationality_code ?? '', leagueTeam: driver.league_team ?? '', carName: driver.car_name ?? '', isActive: driver.is_active };
}

export function LeagueDriversPage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const setupId = params.get('setup');
  const teamsView = location.pathname.endsWith('/teams');
  const [directory, setDirectory] = useState<TeamDirectory | null>(null);
  const [seasonRoster, setSeasonRoster] = useState<TeamManager | null>(null);
  const [search, setSearch] = useState('');
  const [showAi, setShowAi] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const { client, leagueSlug } = useLeague();
  const { role } = useRole();
  const copy = useOperationsCopy();
  const [workspace, setWorkspace] = useState<DriverAdminWorkspace | null>(null);
  const [editing, setEditing] = useState<LeagueDriverInput | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const allowed = role === 'league_admin' || role === 'platform_owner';
  const setupDriver = workspace?.drivers.find(driver => driver.id === setupId);
  const matches = (driver: LeagueDriver) => (showInactive || driver.is_active) && (showAi || isHumanDriver(driver)) && `${driver.name ?? ''} ${driver.public_name ?? ''} ${driver.display_name} ${directory?.profiles.find(item => item.id === driver.id)?.gamertag ?? driver.gamertag ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim());

  const reload = useCallback(async () => {
    const [data, teamData, roster] = await Promise.all([loadDriverAdminWorkspace(client), loadTeamDirectory(client), teamsView ? null : loadTeamManager(client, 'current', null).catch(() => null)]);
    setWorkspace(data); setDirectory(teamData); setSeasonRoster(roster);
  }, [client, teamsView]);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void Promise.all([loadDriverAdminWorkspace(client), loadTeamDirectory(client), teamsView ? null : loadTeamManager(client, 'current', null).catch(() => null)]).then(([data, teamData, roster]) => { if (active) { setWorkspace(data); setDirectory(teamData); setSeasonRoster(roster); } }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : copy('drivers.loadError')); });
    return () => { active = false; };
  }, [allowed, client, copy, teamsView]);

  function beginEdit(driver: LeagueDriver) {
    setEditing(toInput(driver));
    setError('');
    setSaved('');
  }

  if (!allowed) return <AppState copy={copy('drivers.denied')} title={copy('shared.deniedTitle')} tone="denied" />;
  if (!workspace && !error) return <AppState copy={copy('drivers.loading')} title={copy('drivers.loadingTitle')} tone="loading" />;
  if (!workspace && error) return <AppState action={<button className="text-action" onClick={() => { setError(''); void reload().catch((reason) => setError(reason instanceof Error ? reason.message : copy('drivers.loadError'))); }} type="button">{copy('shared.retry')}</button>} copy={error} title={copy('drivers.loadErrorTitle')} tone="error" />;

  return <main className="operations-page admin-management-page league-driver-directory" id="main-content">
    <header className="operations-header"><div><h1>Fahrer &amp; Teams</h1><p>Fahrerprofile, eigene Liga-Teams und Saisonzuordnungen für {leagueSlug}.</p></div><div className="admin-header-actions">{!teamsView && !setupDriver && <button className="primary-action" onClick={() => setEditing({ ...EMPTY_DRIVER })} type="button">{copy('drivers.create')}</button>}<NavLink className="text-link" to="/admin">{copy('shared.back')}</NavLink></div></header>
    <nav className="driver-directory-nav" aria-label="Fahrer und Teams"><NavLink to="/admin/drivers">Fahrerübersicht</NavLink><NavLink to="/admin/teams">Liga-Teams</NavLink></nav>
    {!teamsView && setupDriver && workspace && <DriverSetupFlow key={`${leagueSlug}-${setupDriver.id}`} driver={setupDriver} workspace={workspace} onSaved={reload} onClose={() => { const next = new URLSearchParams(params); next.delete('setup'); setParams(next); }} />}
    {!teamsView && setupId && workspace && !setupDriver && <p role="alert">Dieser Fahrer gehört nicht zur aktiven Liga. Wähle einen Fahrer aus der Übersicht.</p>}
    {teamsView && directory && <LeagueTeamPanel key={leagueSlug} onSaved={reload} />}
    {!teamsView && !setupDriver && editing && workspace && <LeagueDriverEditor key={editing.id ?? 'new'} driverId={editing.id} workspace={workspace} onClose={() => setEditing(null)} onSaved={async () => { await reload(); setEditing(null); setSaved(copy('drivers.updated')); }} />}
    {error && <p className="inline-error" role="alert">{error}</p>}{saved && <p className="inline-success" role="status">{saved}</p>}
    {location.search.includes('seasonStarted=1') && <p role="status">Saison eingerichtet. Wähle bei „Bearbeiten“ die KI-Sitze und unter „Liga-Teams“ die Team-Besetzung.</p>}

    {!teamsView && !setupDriver && <section className="admin-data-panel" aria-labelledby="driver-list-title">
      <div className="admin-panel-heading"><h2 id="driver-list-title">Fahrerübersicht</h2><span>{workspace?.drivers.filter(isHumanDriver).length ?? 0} Fahrerprofile</span></div>
      <div className="driver-directory-filters"><label><span>Fahrer suchen</span><input type="search" placeholder="Name oder Gamertag" value={search} onChange={event => setSearch(event.target.value)} /></label><label className="admin-check"><input checked={showAi} type="checkbox" onChange={event => setShowAi(event.target.checked)} /><span>Auch KI-Fahrer anzeigen</span></label><label className="admin-check"><input type="checkbox" checked={showInactive} onChange={event => setShowInactive(event.target.checked)} /><span>Auch inaktive Fahrer anzeigen</span></label></div>
      {workspace?.drivers.length ? <div className="responsive-table responsive-table--records"><table><thead><tr><th>Fahrerprofil</th><th>Team dieser Saison</th><th>KI-Zuordnung</th><th>Status</th><th>Aktion</th></tr></thead><tbody>{workspace.drivers.filter(matches).map(driver => {
        const profile = directory?.profiles.find(item => item.id === driver.id);
        const member = seasonRoster?.profiles.find(item => item.id === driver.id);
        const currentAi = workspace.ai_assignments.find(item => item.human_driver_id === driver.id && item.is_current);
        const scheduledAi = workspace.ai_assignments.filter(item => item.human_driver_id === driver.id && !item.is_current && item.effective_from_round > (seasonRoster?.view_round ?? 0));
        return <tr key={driver.id} className={driver.is_active ? '' : 'row-inactive'}>
          <td data-label="Fahrerprofil" data-mobile-primary="true"><strong>{driver.public_name || driver.display_name}</strong><small>{profile?.gamertag || driver.gamertag || 'Gamertag fehlt'} · #{driver.number ?? '—'}</small>{driver.name && driver.name !== (driver.public_name || driver.display_name) && <small>Name: {driver.name}</small>}</td>
          <td data-label="Team dieser Saison"><strong>{!seasonRoster ? 'Zuordnung nicht geladen' : !seasonRoster.season ? 'Keine laufende Saison' : member?.team_display_name || member?.team_name || 'Noch nicht zugeordnet'}</strong><small>{seasonRoster?.season?.name}{member?.car_name ? ` · ${member.car_name}` : ''}</small></td>
          <td data-label="KI-Zuordnung"><strong>{!isHumanDriver(driver) ? 'KI-Fahrer' : member?.ai_driver_name ?? currentAi?.ai_driver_name ?? 'Noch nicht zugeordnet'}</strong>{scheduledAi.map(item => <small key={item.id}>Ab Rennen {item.effective_from_round}: {item.ai_driver_name}</small>)}</td>
          <td data-label="Status">{!driver.is_active ? copy('shared.inactive') : !seasonRoster ? 'Status wird geladen' : !seasonRoster.season ? 'Saison fehlt' : (!member?.car_name || !member?.ai_driver_id) ? 'KI-Sitz / Fahrzeug fehlt' : !member?.team_name ? 'Team fehlt' : 'Im Rennbetrieb zugeordnet'}<small>{driver.result_count} Ergebnisse · {driver.identity_linked ? 'Konto verknüpft' : isHumanDriver(driver) ? 'Ohne Konto-Verknüpfung' : 'KI-Fahrer'}</small></td>
          <td data-label="Aktion">{isHumanDriver(driver) && driver.is_active && <NavLink className="primary-action" to={`/admin/drivers?setup=${driver.id}`}>Startklar machen</NavLink>}<button className="table-action-button" onClick={() => beginEdit(driver)} type="button">{copy('shared.edit')}</button>{isHumanDriver(driver) && <NavLink className="text-link" to={`/admin/teams?driver=${driver.id}`}>Team zuordnen</NavLink>}</td>
        </tr>;
      })}</tbody></table></div> : <EmptyState action={<button className="primary-action" onClick={() => setEditing({ ...EMPTY_DRIVER })} type="button">{copy('drivers.create')}</button>} copy={copy('drivers.emptyCopy')} title={copy('drivers.emptyTitle')} />}
      {workspace?.drivers.length !== 0 && !workspace?.drivers.some(matches) && <p role="status">Keine passenden Fahrer. Ändere die Suche oder blende KI-Fahrer beziehungsweise inaktive Fahrer ein.</p>}
      <p><NavLink className="text-link" to="/admin/users">Mitglieder mit Fahrerprofilen verknüpfen</NavLink></p>
    </section>}
    {!teamsView && !setupDriver && workspace && <details id="driver-roster-workflows" className="driver-roster-disclosure"><summary>Ersatzfahrer &amp; Fahrzeugwechsel in der laufenden Saison</summary><RosterWorkflowPanel drivers={workspace} onSaved={async () => { await reload(); setEditing(null); }} /></details>}
  </main>;
}
