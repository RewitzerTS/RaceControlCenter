import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AppState, EmptyState } from '../components/AppState';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { loadDriverAdminWorkspace, upsertLeagueDriver, type DriverAdminWorkspace, type LeagueDriver, type LeagueDriverInput } from './operations';
import { useOperationsCopy } from './operationsCopy';
import { RosterWorkflowPanel } from './RosterWorkflowPanel';
import { useI18n } from '../i18n/I18nProvider';
import { rosterCopies } from './rosterCopy';
import { isHumanDriver } from './roster';
import { loadTeamDirectory, type TeamDirectory } from './leagueTeams';
import { LeagueTeamPanel } from './LeagueTeamPanel';
import './league-teams.css';
import { GamertagAliasesEditor } from '../driver/GamertagAliasesEditor';

const EMPTY_DRIVER: LeagueDriverInput = { displayName: '', gamertag: '', number: null, nationalityCode: '', leagueTeam: '', carName: '', isActive: true };

function toInput(driver: LeagueDriver): LeagueDriverInput {
  return { id: driver.id, displayName: driver.display_name, gamertag: driver.gamertag ?? '', number: driver.number, nationalityCode: driver.nationality_code ?? '', leagueTeam: driver.league_team ?? '', carName: driver.car_name ?? '', isActive: driver.is_active };
}

export function LeagueDriversPage() {
  const { language } = useI18n();
  const location = useLocation();
  const teamsView = location.pathname.endsWith('/teams');
  const [directory, setDirectory] = useState<TeamDirectory | null>(null);
  const [search, setSearch] = useState('');
  const [showAi, setShowAi] = useState(false);
  const { client, leagueSlug } = useLeague();
  const { role } = useRole();
  const copy = useOperationsCopy();
  const [workspace, setWorkspace] = useState<DriverAdminWorkspace | null>(null);
  const [editing, setEditing] = useState<LeagueDriverInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const allowed = role === 'league_admin' || role === 'platform_owner';

  const reload = useCallback(async () => {
    const [data, teamData] = await Promise.all([loadDriverAdminWorkspace(client), loadTeamDirectory(client)]);
    setWorkspace(data); setDirectory(teamData);
  }, [client]);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void Promise.all([loadDriverAdminWorkspace(client), loadTeamDirectory(client)]).then(([data, teamData]) => { if (active) { setWorkspace(data); setDirectory(teamData); } }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : copy('drivers.loadError')); });
    return () => { active = false; };
  }, [allowed, client, copy]);

  function patch<K extends keyof LeagueDriverInput>(key: K, value: LeagueDriverInput[K]) {
    setEditing((current) => current ? { ...current, [key]: value } : current);
  }

  function beginEdit(driver: LeagueDriver) {
    setEditing(toInput(driver));
    setError('');
    setSaved('');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true); setError(''); setSaved('');
    try {
      await upsertLeagueDriver(client, editing);
      await reload();
      setSaved(editing.id ? copy('drivers.updated') : copy('drivers.created'));
      setEditing(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : copy('drivers.saveError')); }
    finally { setSaving(false); }
  }

  if (!allowed) return <AppState copy={copy('drivers.denied')} title={copy('shared.deniedTitle')} tone="denied" />;
  if (!workspace && !error) return <AppState copy={copy('drivers.loading')} title={copy('drivers.loadingTitle')} tone="loading" />;
  if (!workspace && error) return <AppState action={<button className="text-action" onClick={() => { setError(''); void reload().catch((reason) => setError(reason instanceof Error ? reason.message : copy('drivers.loadError'))); }} type="button">{copy('shared.retry')}</button>} copy={error} title={copy('drivers.loadErrorTitle')} tone="error" />;

  return <main className="operations-page admin-management-page league-driver-directory" id="main-content">
    <header className="operations-header"><div><h1>Fahrer &amp; Teams</h1><p>Fahrerprofile, eigene Liga-Teams und Saisonzuordnungen für {leagueSlug}.</p></div><div className="admin-header-actions">{!teamsView && <button className="primary-action" onClick={() => setEditing({ ...EMPTY_DRIVER })} type="button">{copy('drivers.create')}</button>}<NavLink className="text-link" to="/admin">{copy('shared.back')}</NavLink></div></header>
    <nav className="driver-directory-nav" aria-label="Fahrer und Teams"><NavLink to="/admin/drivers">Fahrerübersicht</NavLink><NavLink to="/admin/teams">Liga-Teams</NavLink></nav>
    {teamsView && directory && <LeagueTeamPanel key={leagueSlug} onSaved={reload} />}
    {!teamsView && editing && <form className="admin-form admin-driver-form" onSubmit={(event) => void save(event)}><div className="admin-panel-heading"><div><p className="section-label">{editing.id ? copy('drivers.edit') : copy('drivers.new')}</p><h2>{editing.id ? editing.displayName : copy('drivers.create')}</h2></div><button className="text-action" onClick={() => setEditing(null)} type="button">{copy('shared.close')}</button></div><div className="admin-form-columns"><label><span>{copy('drivers.displayName')}</span><input autoFocus maxLength={80} required value={editing.displayName} onChange={(event) => patch('displayName', event.target.value)} /></label><label><span>{copy('drivers.gamertag')}</span><input maxLength={80} value={editing.gamertag} onChange={(event) => patch('gamertag', event.target.value)} /></label><label><span>{copy('drivers.number')}</span><input max={999} min={0} type="number" value={editing.number ?? ''} onChange={(event) => patch('number', event.target.value === '' ? null : Number(event.target.value))} /></label><label><span>{copy('drivers.nationality')}</span><input maxLength={2} placeholder="DE" value={editing.nationalityCode} onChange={(event) => patch('nationalityCode', event.target.value.toUpperCase())} /></label><label><span>{copy('drivers.team')}</span><input maxLength={80} readOnly={Boolean(editing.id && workspace?.active_season)} value={editing.leagueTeam} onChange={(event) => patch('leagueTeam', event.target.value)} /></label><label><span>{copy('drivers.car')}</span><input maxLength={80} readOnly={Boolean(editing.id && workspace?.active_season)} value={editing.carName} onChange={(event) => patch('carName', event.target.value)} /></label></div><label className="admin-check"><input checked={editing.isActive} type="checkbox" onChange={(event) => patch('isActive', event.target.checked)} /><span><strong>{copy('drivers.active')}</strong><small>{copy('drivers.activeHint')}</small></span></label><div className="admin-form-actions"><button className="primary-action" disabled={saving} type="submit">{saving ? copy('shared.saving') : copy('drivers.save')}</button></div></form>}
    {error && <p className="inline-error" role="alert">{error}</p>}{saved && <p className="inline-success" role="status">{saved}</p>}
    {!teamsView && editing?.id && isHumanDriver(workspace!.drivers.find(driver => driver.id === editing.id)!) && <GamertagAliasesEditor key={`${leagueSlug}-${editing.id}`} driverId={editing.id} driverName={editing.displayName} />}
    {editing?.id && workspace?.active_season && <p><a className="text-link" href="#roster-title" onClick={() => { const disclosure = document.getElementById('driver-roster-workflows'); if (disclosure instanceof HTMLDetailsElement) disclosure.open = true; }}>{rosterCopies[language].profileHint}</a></p>}

    {!teamsView && <section className="admin-data-panel" aria-labelledby="driver-list-title">
      <div className="admin-panel-heading"><h2 id="driver-list-title">Fahrerübersicht</h2><span>{workspace?.drivers.filter(isHumanDriver).length ?? 0} Fahrerprofile</span></div>
      <div className="driver-directory-filters"><label><span>Fahrer suchen</span><input type="search" placeholder="Name oder Gamertag" value={search} onChange={event => setSearch(event.target.value)} /></label><label className="admin-check"><input checked={showAi} type="checkbox" onChange={event => setShowAi(event.target.checked)} /><span>Auch KI-Fahrer anzeigen</span></label></div>
      {workspace?.drivers.length ? <div className="responsive-table responsive-table--records"><table><thead><tr><th>Fahrerprofil</th><th>Team-Vorgabe</th><th>Aktuell im Rennbetrieb</th><th>Status</th><th>Aktion</th></tr></thead><tbody>{workspace.drivers.filter(driver => (showAi || isHumanDriver(driver)) && `${driver.display_name} ${directory?.profiles.find(item => item.id === driver.id)?.gamertag ?? driver.gamertag ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())).map(driver => {
        const profile = directory?.profiles.find(item => item.id === driver.id);
        const preferredTeamId = directory?.preferences.find(item => item.driver_id === driver.id)?.team_id;
        const team = directory?.teams.find(item => item.id === preferredTeamId);
        return <tr key={driver.id} className={driver.is_active ? '' : 'row-inactive'}>
          <td data-label="Fahrerprofil" data-mobile-primary="true"><strong>{driver.display_name}</strong><small>{profile?.gamertag || driver.gamertag || 'Gamertag fehlt'} · #{driver.number ?? '—'}</small></td>
          <td data-label="Team-Vorgabe"><strong>{team?.name ?? 'Keine eigene Vorgabe'}</strong><small>Für die nächste Saison</small></td>
          <td data-label="Aktuell im Rennbetrieb"><strong>{driver.league_team ?? 'Ohne Team'}</strong><small>{driver.car_name || 'Kein Fahrzeug'}</small></td>
          <td data-label="Status">{driver.is_active ? copy('shared.active') : copy('shared.inactive')}<small>{driver.result_count} Ergebnisse · {driver.identity_linked ? 'Konto verknüpft' : isHumanDriver(driver) ? 'Ohne Konto-Verknüpfung' : 'KI-Fahrer'}</small></td>
          <td data-label="Aktion"><button className="table-action-button" onClick={() => beginEdit(driver)} type="button">{copy('shared.edit')}</button>{isHumanDriver(driver) && <NavLink className="text-link" to={`/admin/teams?driver=${driver.id}`}>Team zuordnen</NavLink>}</td>
        </tr>;
      })}</tbody></table></div> : <EmptyState action={<button className="primary-action" onClick={() => setEditing({ ...EMPTY_DRIVER })} type="button">{copy('drivers.create')}</button>} copy={copy('drivers.emptyCopy')} title={copy('drivers.emptyTitle')} />}
      {workspace?.drivers.length !== 0 && !workspace?.drivers.some(driver => (showAi || isHumanDriver(driver)) && `${driver.display_name} ${directory?.profiles.find(item => item.id === driver.id)?.gamertag ?? driver.gamertag ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())) && <p role="status">Keine passenden Fahrer. Ändere die Suche oder blende KI-Fahrer ein.</p>}
      <p><NavLink className="text-link" to="/admin/users">Mitglieder mit Fahrerprofilen verknüpfen</NavLink></p>
    </section>}
    {workspace && <details id="driver-roster-workflows" className="driver-roster-disclosure"><summary>Besetzung &amp; Fahrzeugwechsel in der laufenden Saison</summary><RosterWorkflowPanel drivers={workspace} onSaved={async () => { await reload(); setEditing(null); }} /></details>}
  </main>;
}
