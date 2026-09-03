import { useCallback, useEffect, useState } from 'react';
import { useLeague } from '../league/LeagueProvider';
import { useI18n } from '../i18n/I18nProvider';
import type { DriverAdminWorkspace } from './operations';
import { isHumanDriver, loadRosterWorkspace, saveSubstitution, saveVehicleChange, vehicleChangeRounds, type RosterWorkspace } from './roster';
import { rosterCopies, rosterError } from './rosterCopy';
import './roster.css';

export function RosterWorkflowPanel({ drivers, onSaved }: { drivers: DriverAdminWorkspace; onSaved: () => Promise<void> }) {
  const { client } = useLeague();
  const { language } = useI18n();
  const copy = rosterCopies[language];
  const [workspace, setWorkspace] = useState<RosterWorkspace | null>(null);
  const [mode, setMode] = useState<'substitute' | 'vehicle'>('substitute');
  const [raceId, setRaceId] = useState('');
  const [primaryId, setPrimaryId] = useState('');
  const [subId, setSubId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [round, setRound] = useState('');
  const [aiId, setAiId] = useState('');
  const [team, setTeam] = useState('');
  const [car, setCar] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const load = useCallback(async () => { setWorkspace(await loadRosterWorkspace(client)); }, [client]);
  useEffect(() => {
    let active = true;
    setWorkspace(null); setError(''); setRaceId(''); setPrimaryId(''); setSubId(''); setDriverId(''); setRound('');
    void loadRosterWorkspace(client).then((data) => { if (active) setWorkspace(data); })
      .catch((reason) => { if (active) setError(rosterError(reason, language)); });
    return () => { active = false; };
  }, [client, language]);
  const humans = drivers.drivers.filter(isHumanDriver);
  const name = (id: string) => drivers.drivers.find((driver) => driver.id === id)?.display_name ?? '—';
  const race = workspace?.races.find((item) => item.id === raceId);
  const openRounds = vehicleChangeRounds(workspace?.races ?? []);
  const existing = workspace?.substitutions.find((sub) => sub.race_id === raceId && sub.primary_driver_id === primaryId);
  const validSub = Boolean(race && !race.locked && primaryId && subId && primaryId !== subId);
  const validVehicle = Boolean(driverId && openRounds.some((item) => item.round === Number(round)) && team.trim() && car.trim());

  async function mutate(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setSaved(false);
    try { await action(); setSaved(true); await Promise.all([load(), onSaved()]); }
    catch (reason) { setError(rosterError(reason, language)); }
    finally { setBusy(false); }
  }
  function chooseDriver(id: string) {
    setDriverId(id); setAiId('');
    const driver = drivers.drivers.find((item) => item.id === id);
    setTeam(driver?.league_team ?? ''); setCar(driver?.car_name ?? '');
  }
  return <section className="admin-data-panel roster-panel" aria-labelledby="roster-title">
    <div className="admin-panel-heading"><div><h2 id="roster-title">{copy.title}</h2><p>{copy.hint}</p></div></div>
    {error && <p className="inline-error" role="alert">{error} <button type="button" className="text-action" disabled={busy} onClick={() => { setError(''); void load().catch((reason) => setError(rosterError(reason, language))); }}>{copy.retry}</button></p>}
    {saved && <p className="inline-success" role="status">{copy.saved}</p>}
    {!workspace && !error && <p role="status">{copy.loading}</p>}
    {workspace && !workspace.season_id && <p>{copy.empty}</p>}
    {workspace?.season_id && <>
      <div className="roster-mode" role="group" aria-label={copy.title}>
        <button className={mode === 'substitute' ? 'primary-action' : 'text-action'} aria-pressed={mode === 'substitute'} type="button" disabled={busy} onClick={() => { setMode('substitute'); setSaved(false); }}>{copy.substitute}</button>
        <button className={mode === 'vehicle' ? 'primary-action' : 'text-action'} aria-pressed={mode === 'vehicle'} type="button" disabled={busy} onClick={() => { setMode('vehicle'); setSaved(false); }}>{copy.vehicle}</button>
      </div>
      {mode === 'substitute' ? <form className="admin-form" onSubmit={(event) => { event.preventDefault(); if (validSub) void mutate(() => saveSubstitution(client, raceId, primaryId, subId)); }}>
        <p>{copy.subHint}</p>
        <fieldset disabled={busy} className="roster-fields"><legend className="visually-hidden">{copy.substitute}</legend>
          <label><span>{copy.race}</span><select required value={raceId} onChange={(event) => { setRaceId(event.target.value); setPrimaryId(''); setSubId(''); setSaved(false); }}><option value="">{copy.choose}</option>{workspace.races.map((item) => <option key={item.id} value={item.id}>{copy.round} {item.round} · {item.name}{item.locked ? ' 🔒' : ''}</option>)}</select></label>
          <label><span>{copy.primary}</span><select required value={primaryId} disabled={!race || race.locked} onChange={(event) => { setPrimaryId(event.target.value); setSubId(workspace.substitutions.find((sub) => sub.race_id === raceId && sub.primary_driver_id === event.target.value)?.substitute_driver_id ?? ''); setSaved(false); }}><option value="">{copy.choose}</option>{humans.map((driver) => <option key={driver.id} value={driver.id}>{driver.display_name}</option>)}</select></label>
          <label><span>{copy.replacement}</span><select required value={subId} disabled={!primaryId || race?.locked} onChange={(event) => { setSubId(event.target.value); setSaved(false); }}><option value="">{copy.choose}</option>{humans.filter((driver) => driver.id !== primaryId).map((driver) => <option key={driver.id} value={driver.id}>{driver.display_name}</option>)}</select></label>
        </fieldset>
        {race?.locked && <p>{copy.locked}</p>}
        {validSub && <p className="roster-summary"><strong>{name(subId)}</strong> {copy.for} <strong>{name(primaryId)}</strong> · {race?.name}</p>}
        <div className="admin-form-actions"><button className="primary-action" type="submit" disabled={busy || !validSub}>{busy ? copy.saving : copy.saveSub}</button>{existing && !race?.locked && <button className="text-action" type="button" disabled={busy} onClick={() => void mutate(async () => { await saveSubstitution(client, raceId, primaryId, null); setSubId(''); })}>{copy.remove}</button>}</div>
      </form> : <form className="admin-form" onSubmit={(event) => { event.preventDefault(); if (validVehicle) void mutate(() => saveVehicleChange(client, driverId, Number(round), team, car, aiId || null)); }}>
        <p>{copy.vehicleHint}</p>
        {!openRounds.length && <p>{copy.noOpen}</p>}
        <fieldset disabled={busy || !openRounds.length} className="roster-fields"><legend className="visually-hidden">{copy.vehicle}</legend>
          <label><span>{copy.driver}</span><select required value={driverId} onChange={(event) => { chooseDriver(event.target.value); setSaved(false); }}><option value="">{copy.choose}</option>{humans.map((driver) => <option key={driver.id} value={driver.id}>{driver.display_name}</option>)}</select></label>
          <label><span>{copy.from}</span><select required value={round} onChange={(event) => { setRound(event.target.value); setSaved(false); }}><option value="">{copy.choose}</option>{openRounds.map((item) => <option key={item.id} value={item.round}>{copy.round} {item.round} · {item.name}</option>)}</select></label>
          {drivers.ai_drivers.length > 0 && <label><span>{copy.seat}</span><select value={aiId} onChange={(event) => { setAiId(event.target.value); const ai = drivers.ai_drivers.find((item) => item.id === event.target.value); if (ai) { setTeam(ai.league_team ?? ''); setCar(ai.car_name ?? ''); } setSaved(false); }}><option value="">{copy.custom}</option>{drivers.ai_drivers.map((ai) => <option key={ai.id} value={ai.id}>{ai.display_name} · {ai.car_name}</option>)}</select></label>}
          <label><span>{copy.team}</span><input maxLength={80} required value={team} onChange={(event) => { setTeam(event.target.value); setSaved(false); }} /></label>
          <label><span>{copy.car}</span><input maxLength={80} required value={car} onChange={(event) => { setCar(event.target.value); setSaved(false); }} /></label>
        </fieldset>
        {validVehicle && <p className="roster-summary"><strong>{name(driverId)}</strong> · {team} · {car} · {copy.round} {round} →</p>}
        <div className="admin-form-actions"><button className="primary-action" type="submit" disabled={busy || !validVehicle}>{busy ? copy.saving : copy.saveVehicle}</button></div>
      </form>}
      <details className="roster-history"><summary>{copy.history}</summary>
        {!workspace.substitutions.length && !workspace.vehicles.length && <p>{copy.noHistory}</p>}
        <ul>{workspace.substitutions.map((sub) => { const item = workspace.races.find((entry) => entry.id === sub.race_id); return <li key={sub.id}>{copy.round} {item?.round} · {item?.name}: <strong>{name(sub.substitute_driver_id)}</strong> {copy.for} {name(sub.primary_driver_id)}</li>; })}
          {workspace.vehicles.map((entry) => <li key={entry.id}>{copy.round} {entry.from_round} → · <strong>{name(entry.driver_id)}</strong> · {entry.team_name} · {entry.car_name}</li>)}
        </ul>
      </details>
    </>}
  </section>;
}
