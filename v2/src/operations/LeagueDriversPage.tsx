import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { loadDriverAdminWorkspace, upsertLeagueDriver, type DriverAdminWorkspace, type LeagueDriver, type LeagueDriverInput } from './operations';

const EMPTY_DRIVER: LeagueDriverInput = { displayName: '', gamertag: '', number: null, nationalityCode: '', leagueTeam: '', carName: '', isActive: true };

function toInput(driver: LeagueDriver): LeagueDriverInput {
  return { id: driver.id, displayName: driver.display_name, gamertag: driver.gamertag ?? '', number: driver.number, nationalityCode: driver.nationality_code ?? '', leagueTeam: driver.league_team ?? '', carName: driver.car_name ?? '', isActive: driver.is_active };
}

export function LeagueDriversPage() {
  const { client, leagueSlug } = useLeague();
  const { role } = useRole();
  const [workspace, setWorkspace] = useState<DriverAdminWorkspace | null>(null);
  const [editing, setEditing] = useState<LeagueDriverInput | null>(null);
  const [saving, setSaving] = useState(false);
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
    void loadDriverAdminWorkspace(client).then((data) => { if (active) setWorkspace(data); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Fahrer konnten nicht geladen werden.'); });
    return () => { active = false; };
  }, [allowed, client]);

  function patch<K extends keyof LeagueDriverInput>(key: K, value: LeagueDriverInput[K]) {
    setEditing((current) => current ? { ...current, [key]: value } : current);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true); setError(''); setSaved('');
    try {
      await upsertLeagueDriver(client, editing);
      await reload();
      setSaved(editing.id ? 'Fahrer wurde aktualisiert.' : 'Fahrer wurde angelegt.');
      setEditing(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Fahrer konnte nicht gespeichert werden.'); }
    finally { setSaving(false); }
  }

  if (!allowed) return <main className="driver-state" id="main-content"><span className="state-mark">17</span><div><h1>Zugriff verweigert</h1></div></main>;
  if (!workspace && !error) return <main className="driver-state" id="main-content"><span className="state-mark">D</span><div><h1>Fahrer werden geladen …</h1></div></main>;

  return <main className="operations-page admin-management-page" id="main-content">
    <header className="operations-header"><div><p className="section-label">Ligaleitung · {leagueSlug}</p><h1>Fahrer verwalten</h1><p>Startnummern, Teams, Fahrzeuge und aktive Fahrer der ausgewählten Liga pflegen. Bestehende Ergebnisse werden beim Bearbeiten nicht verändert.</p></div><div className="admin-header-actions"><button className="primary-action" onClick={() => setEditing({ ...EMPTY_DRIVER })} type="button">Fahrer anlegen</button><NavLink className="text-link" to="/admin">Zur Ligaleitung</NavLink></div></header>
    {workspace && <section className="operations-metrics admin-driver-metrics" aria-label="Fahrerübersicht"><div><strong>{workspace.counts.total}</strong><span>Fahrer gesamt</span></div><div><strong>{workspace.counts.active}</strong><span>Aktiv</span></div><div><strong>{workspace.counts.linked}</strong><span>Mit Konto verknüpft</span></div></section>}
    {editing && <form className="admin-form admin-driver-form" onSubmit={(event) => void save(event)}><div className="admin-panel-heading"><div><p className="section-label">{editing.id ? 'Fahrer bearbeiten' : 'Neuer Fahrer'}</p><h2>{editing.id ? editing.displayName : 'Fahrer anlegen'}</h2></div><button className="text-action" onClick={() => setEditing(null)} type="button">Schließen</button></div><div className="admin-form-columns"><label><span>Anzeigename</span><input autoFocus maxLength={80} required value={editing.displayName} onChange={(event) => patch('displayName', event.target.value)} /></label><label><span>Gamertag</span><input maxLength={80} value={editing.gamertag} onChange={(event) => patch('gamertag', event.target.value)} /></label><label><span>Startnummer</span><input max={999} min={0} type="number" value={editing.number ?? ''} onChange={(event) => patch('number', event.target.value === '' ? null : Number(event.target.value))} /></label><label><span>Nationalität</span><input maxLength={2} placeholder="DE" value={editing.nationalityCode} onChange={(event) => patch('nationalityCode', event.target.value.toUpperCase())} /></label><label><span>Team</span><input maxLength={80} value={editing.leagueTeam} onChange={(event) => patch('leagueTeam', event.target.value)} /></label><label><span>Fahrzeug</span><input maxLength={80} value={editing.carName} onChange={(event) => patch('carName', event.target.value)} /></label></div><label className="admin-check"><input checked={editing.isActive} type="checkbox" onChange={(event) => patch('isActive', event.target.checked)} /><span><strong>Aktiver Fahrer</strong><small>In Auswahlfeldern und aktuellen Übersichten anzeigen.</small></span></label><div className="admin-form-actions"><button className="primary-action" disabled={saving} type="submit">{saving ? 'Speichern …' : 'Fahrer speichern'}</button></div></form>}
    {error && <p className="inline-error" role="alert">{error}</p>}{saved && <p className="inline-success" role="status">{saved}</p>}
    <section className="admin-data-panel" aria-labelledby="driver-list-title"><div className="admin-panel-heading"><div><p className="section-label">Starterfeld</p><h2 id="driver-list-title">Fahrer</h2></div><strong>{workspace?.drivers.length ?? 0}</strong></div>{workspace?.drivers.length ? <div className="responsive-table"><table><thead><tr><th>Nr.</th><th>Fahrer</th><th>Team / Fahrzeug</th><th>Status</th><th>Ergebnisse</th><th>Aktion</th></tr></thead><tbody>{workspace.drivers.map((driver) => <tr key={driver.id} className={driver.is_active ? '' : 'row-inactive'}><td>{driver.number ?? '—'}</td><td><strong>{driver.display_name}</strong><small>{driver.gamertag || (driver.identity_linked ? 'Konto verknüpft' : 'Kein Konto verknüpft')}</small></td><td><strong>{driver.league_team ?? '—'}</strong><small>{driver.car_name ?? 'Kein Fahrzeug'}</small></td><td>{driver.is_active ? 'Aktiv' : 'Inaktiv'}</td><td>{driver.result_count}</td><td><button onClick={() => setEditing(toInput(driver))} type="button">Bearbeiten</button></td></tr>)}</tbody></table></div> : <div className="admin-empty-state"><span aria-hidden="true">00</span><div><h3>Noch keine Fahrer</h3><p>Lege den ersten Fahrer an, um ein Starterfeld aufzubauen.</p></div></div>}</section>
  </main>;
}
