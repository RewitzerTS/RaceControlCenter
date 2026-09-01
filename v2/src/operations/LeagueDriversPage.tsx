import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AppState, EmptyState } from '../components/AppState';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { assignSeasonDriverAi, loadDriverAdminWorkspace, upsertLeagueDriver, type DriverAdminWorkspace, type LeagueDriver, type LeagueDriverInput } from './operations';
import { useOperationsCopy } from './operationsCopy';

const EMPTY_DRIVER: LeagueDriverInput = { displayName: '', gamertag: '', number: null, nationalityCode: '', leagueTeam: '', carName: '', isActive: true };

function toInput(driver: LeagueDriver): LeagueDriverInput {
  return { id: driver.id, displayName: driver.display_name, gamertag: driver.gamertag ?? '', number: driver.number, nationalityCode: driver.nationality_code ?? '', leagueTeam: driver.league_team ?? '', carName: driver.car_name ?? '', isActive: driver.is_active };
}

export function LeagueDriversPage() {
  const { client, leagueSlug } = useLeague();
  const { role } = useRole();
  const copy = useOperationsCopy();
  const [workspace, setWorkspace] = useState<DriverAdminWorkspace | null>(null);
  const [editing, setEditing] = useState<LeagueDriverInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentAiId, setAssignmentAiId] = useState('');
  const [assignmentRound, setAssignmentRound] = useState(1);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const allowed = role === 'league_admin' || role === 'platform_owner';

  const reload = useCallback(async () => {
    const data = await loadDriverAdminWorkspace(client);
    setWorkspace(data);
  }, [client]);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void loadDriverAdminWorkspace(client).then((data) => { if (active) setWorkspace(data); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : copy('drivers.loadError')); });
    return () => { active = false; };
  }, [allowed, client, copy]);

  function patch<K extends keyof LeagueDriverInput>(key: K, value: LeagueDriverInput[K]) {
    setEditing((current) => current ? { ...current, [key]: value } : current);
  }

  function beginEdit(driver: LeagueDriver) {
    const currentAssignment = workspace?.ai_assignments.find((assignment) => assignment.human_driver_id === driver.id && assignment.is_current);
    setEditing(toInput(driver));
    setAssignmentAiId(currentAssignment?.ai_driver_id ?? '');
    setAssignmentRound(workspace?.active_season?.next_round ?? 1);
    setError('');
    setSaved('');
  }

  async function saveAssignment() {
    if (!editing?.id || !assignmentAiId) return;
    setAssignmentSaving(true); setError(''); setSaved('');
    try {
      await assignSeasonDriverAi(client, editing.id, assignmentAiId, assignmentRound);
      await reload();
      setSaved(copy('drivers.aiAssignmentSaved'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : copy('drivers.aiAssignmentError')); }
    finally { setAssignmentSaving(false); }
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

  return <main className="operations-page admin-management-page" id="main-content">
    <header className="operations-header"><div><p className="section-label">{copy('shared.scope', { league: leagueSlug })}</p><h1>{copy('drivers.title')}</h1><p>{copy('drivers.copy')}</p></div><div className="admin-header-actions"><button className="primary-action" onClick={() => setEditing({ ...EMPTY_DRIVER })} type="button">{copy('drivers.create')}</button><NavLink className="text-link" to="/admin">{copy('shared.back')}</NavLink></div></header>
    {workspace && <section className="operations-metrics admin-driver-metrics" aria-label={copy('drivers.list')}><div><strong>{workspace.counts.total}</strong><span>{copy('drivers.total')}</span></div><div><strong>{workspace.counts.active}</strong><span>{copy('shared.active')}</span></div><div><strong>{workspace.counts.linked}</strong><span>{copy('drivers.linked')}</span></div></section>}
    {editing && <form className="admin-form admin-driver-form" onSubmit={(event) => void save(event)}><div className="admin-panel-heading"><div><p className="section-label">{editing.id ? copy('drivers.edit') : copy('drivers.new')}</p><h2>{editing.id ? editing.displayName : copy('drivers.create')}</h2></div><button className="text-action" onClick={() => setEditing(null)} type="button">{copy('shared.close')}</button></div><div className="admin-form-columns"><label><span>{copy('drivers.displayName')}</span><input autoFocus maxLength={80} required value={editing.displayName} onChange={(event) => patch('displayName', event.target.value)} /></label><label><span>{copy('drivers.gamertag')}</span><input maxLength={80} value={editing.gamertag} onChange={(event) => patch('gamertag', event.target.value)} /></label><label><span>{copy('drivers.number')}</span><input max={999} min={0} type="number" value={editing.number ?? ''} onChange={(event) => patch('number', event.target.value === '' ? null : Number(event.target.value))} /></label><label><span>{copy('drivers.nationality')}</span><input maxLength={2} placeholder="DE" value={editing.nationalityCode} onChange={(event) => patch('nationalityCode', event.target.value.toUpperCase())} /></label><label><span>{copy('drivers.team')}</span><input maxLength={80} value={editing.leagueTeam} onChange={(event) => patch('leagueTeam', event.target.value)} /></label><label><span>{copy('drivers.car')}</span><input maxLength={80} value={editing.carName} onChange={(event) => patch('carName', event.target.value)} /></label></div>{editing.id && workspace?.active_season && !workspace.drivers.find((driver) => driver.id === editing.id)?.ai_driver_reference && <fieldset className="admin-ai-assignment"><legend>{copy('drivers.aiAssignment')}</legend><p>{copy('drivers.aiAssignmentHint', { season: workspace.active_season.name })}</p><div className="admin-form-columns"><label><span>{copy('drivers.aiDriver')}</span><select value={assignmentAiId} onChange={(event) => setAssignmentAiId(event.target.value)}><option value="">{copy('drivers.aiDriverChoose')}</option>{workspace.ai_drivers.map((driver) => <option disabled={Boolean(driver.assigned_human_id && driver.assigned_human_id !== editing.id)} key={driver.id} value={driver.id}>{driver.display_name} · {driver.league_team ?? driver.car_name ?? '—'}{driver.assigned_human_name && driver.assigned_human_id !== editing.id ? ` · ${copy('drivers.assignedTo', { driver: driver.assigned_human_name })}` : ''}</option>)}</select></label><label><span>{copy('drivers.effectiveFromRound')}</span><input max={workspace.active_season.max_round} min={1} type="number" value={assignmentRound} onChange={(event) => setAssignmentRound(Number(event.target.value))} /></label></div><div className="admin-ai-assignment-history">{workspace.ai_assignments.filter((assignment) => assignment.human_driver_id === editing.id).map((assignment) => <small key={assignment.id}>{assignment.ai_driver_name} · {copy('drivers.roundRange', { from: assignment.effective_from_round, to: assignment.effective_to_round ?? copy('drivers.seasonEnd') })}</small>)}</div><button className="secondary-action" disabled={!assignmentAiId || assignmentSaving} onClick={() => void saveAssignment()} type="button">{assignmentSaving ? copy('shared.saving') : copy('drivers.aiAssignmentSave')}</button></fieldset>}<label className="admin-check"><input checked={editing.isActive} type="checkbox" onChange={(event) => patch('isActive', event.target.checked)} /><span><strong>{copy('drivers.active')}</strong><small>{copy('drivers.activeHint')}</small></span></label><div className="admin-form-actions"><button className="primary-action" disabled={saving} type="submit">{saving ? copy('shared.saving') : copy('drivers.save')}</button></div></form>}
    {error && <p className="inline-error" role="alert">{error}</p>}{saved && <p className="inline-success" role="status">{saved}</p>}
    <section className="admin-data-panel" aria-labelledby="driver-list-title"><div className="admin-panel-heading"><div><p className="section-label">{copy('drivers.grid')}</p><h2 id="driver-list-title">{copy('drivers.list')}</h2></div></div>{workspace?.drivers.length ? <div className="responsive-table responsive-table--records"><table><thead><tr><th>{copy('drivers.number')}</th><th>{copy('drivers.list')}</th><th>{copy('drivers.teamCar')}</th><th>{copy('shared.status')}</th><th>{copy('drivers.results')}</th><th>{copy('shared.action')}</th></tr></thead><tbody>{workspace.drivers.map((driver) => <tr key={driver.id} className={driver.is_active ? '' : 'row-inactive'}><td data-label={copy('drivers.number')}>{driver.number ?? '—'}</td><td data-label={copy('drivers.list')} data-mobile-primary="true"><strong>{driver.display_name}</strong><small>{driver.gamertag || (driver.identity_linked ? copy('drivers.accountLinked') : copy('drivers.noAccount'))}</small></td><td data-label={copy('drivers.teamCar')}><strong>{driver.league_team ?? '—'}</strong><small>{driver.car_name ?? copy('drivers.noCar')}</small></td><td data-label={copy('shared.status')}>{driver.is_active ? copy('shared.active') : copy('shared.inactive')}</td><td data-label={copy('drivers.results')}>{driver.result_count}</td><td data-label={copy('shared.action')}><button className="table-action-button" onClick={() => beginEdit(driver)} type="button">{copy('shared.edit')}</button></td></tr>)}</tbody></table></div> : <EmptyState action={<button className="primary-action" onClick={() => setEditing({ ...EMPTY_DRIVER })} type="button">{copy('drivers.create')}</button>} copy={copy('drivers.emptyCopy')} title={copy('drivers.emptyTitle')} />}</section>
  </main>;
}
