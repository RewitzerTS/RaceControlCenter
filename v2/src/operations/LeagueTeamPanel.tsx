import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLeague } from '../league/LeagueProvider';
import { useI18n } from '../i18n/I18nProvider';
import { vehicleChangeRounds } from './roster';
import { departingMembers, loadTeamManager, saveTeamManager, teamEditReady, type TeamEdit, type TeamManager, type TeamMode } from './teamManager';
import { teamManagerCopy, teamManagerError, teamAssignmentCopy } from './teamManagerCopy';

export function LeagueTeamPanel({ onSaved }: { onSaved: () => Promise<void> }) {
  const { client } = useLeague();
  const { language } = useI18n();
  const copy = teamManagerCopy[language];
  const assignmentCopy = teamAssignmentCopy[language];
  const [params] = useSearchParams();
  const [assigningId, setAssigningId] = useState(params.get('driver') ?? '');
  const assignmentRef = useRef<HTMLSelectElement>(null);
  const [mode, setMode] = useState<TeamMode>('current');
  const [round, setRound] = useState('');
  const [state, setState] = useState<TeamManager | null>(null);
  const [edit, setEdit] = useState<TeamEdit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [retry, setRetry] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let active = true;
    setState(null); setEdit(null); setError(''); setSaved(false); setLoadFailed(false); setNeedsReload(false);
    void loadTeamManager(client, mode, round ? Number(round) : null)
      .then(value => { if (active) setState(value); })
      .catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [client, mode, round, retry]);
  function begin(name: string | null, driverId = '') {
    if (!state) return;
    const members = name === null ? [] : state.profiles.filter(p => p.team_name === name);
    const ids = members.map(p => p.id);
    if (driverId && !ids.includes(driverId) && ids.length < 2) ids.push(driverId);
    setEdit({ original: name, name: name ?? '', drivers: [ids[0] ?? '', ids[1] ?? ''], departures: {} });
    setError(''); setSaved(false);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ block: 'center' });
      formRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>('input:not([readonly]), select')?.focus({ preventScroll: true });
    });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!state || !edit || busy || needsReload) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      const value = await saveTeamManager(client, state, edit, round ? Number(round) : null);
      setState(value); setEdit(null); setAssigningId(''); setSaved(true);
      // A failed refresh of the separate driver list cannot undo a committed lineup.
      void onSaved().catch(() => undefined);
    } catch (reason) {
      setError(teamManagerError(reason, copy));
      const message = reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : '';
      setNeedsReload(message.includes('TEAM_STATE_CHANGED') || message.includes('ROSTER_'));
    } finally { setBusy(false); }
  }
  const rounds = state ? vehicleChangeRounds(state.races) : [];
  const canEdit = Boolean(state && (mode === 'next' || (state.season && round && rounds.some(r => r.round === Number(round)))));
  const unassigned = state?.profiles.filter(p => !p.team_name) ?? [];
  const race = state?.races.find(r => r.round === Number(round));
  const assigning = state?.profiles.find(p => p.id === assigningId);
  return <section className="league-team-panel team-manager" aria-labelledby="league-teams-heading">
    <header className="team-manager-heading"><div><h2 id="league-teams-heading">{copy.title}</h2><p>{copy.intro}</p></div>
      <button className="primary-action" type="button" disabled={!canEdit || Boolean(edit) || busy} onClick={() => begin(null, assigning?.id)}>{copy.create}</button>
    </header>
    <div className="team-manager-context">
      <div className="team-manager-tabs" role="group" aria-label={copy.title}>
        {(['current', 'next'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} disabled={Boolean(edit) || busy} onClick={() => { setMode(value); setRound(''); }}>{copy[value]}</button>)}
      </div>
      {mode === 'current' && <label><span>{copy.round}</span><select value={round} disabled={!state || Boolean(edit) || busy || !rounds.length} onChange={event => setRound(event.target.value)}>
        <option value="">{copy.chooseRound}</option>{rounds.map(r => <option key={r.id} value={r.round}>{copy.roundWord} {r.round} · {r.name}</option>)}
      </select></label>}
    </div>
    {!state && (loadFailed ? <div role="alert"><p>{copy.loadError}</p><button type="button" className="text-action" onClick={() => setRetry(value => value + 1)}>{copy.retry}</button></div> : <p role="status">{copy.loading}</p>)}
    {state && <>
      <p className="team-context-note">{mode === 'next' ? copy.nextHint : !state.season ? copy.noSeason : !rounds.length ? copy.noRounds : round ? copy.raceHint : copy.chooseHint}</p>
      {mode === 'current' && state.season && <p className="team-view-label"><strong>{state.season.name}</strong> · {race ? `${copy.roundWord} ${race.round} · ${race.name}` : copy.view}</p>}
      {error && <div role="alert"><p className="inline-error">{error}</p>{needsReload && <button className="text-action" type="button" onClick={() => { setRound(''); setRetry(value => value + 1); }}>{copy.reload}</button>}</div>}
      {saved && <p className="inline-success" role="status">{copy.saved}</p>}
      {assigning && !edit && <div className="team-assignment-choice">
        <label><span>{assignmentCopy.target}: {assigning.display_name}</span><select ref={assignmentRef} value="" disabled={!canEdit || busy || (mode === 'current' && !assigning.car_name)} onChange={event => { if (event.target.value) begin(event.target.value, assigning.id); }}>
          <option value="">{assignmentCopy.choose}</option>{state.teams.map(team => <option key={team.name} value={team.name} disabled={state.profiles.filter(p => p.team_name === team.name && p.id !== assigning.id).length >= 2}>{team.name}</option>)}
        </select></label><p>{assignmentCopy.hint}</p>
        <button className="text-action" type="button" onClick={() => setAssigningId('')}>{copy.cancel}</button>
      </div>}
      {edit && <form ref={formRef} className="team-lineup-editor" onSubmit={event => void save(event)}>
        <fieldset disabled={busy || needsReload}><legend>{copy.editor}</legend>
          <label><span>{copy.name}</span><input required minLength={2} maxLength={80} value={edit.name} onChange={event => setEdit({ ...edit, name: event.target.value })} /></label>
          {state.teams.some(t => t.name !== edit.original && t.name.toLocaleLowerCase() === edit.name.trim().toLocaleLowerCase()) && <p role="alert">{copy.duplicate}</p>}
          <div className="team-editor-slots">{([0, 1] as const).map(index => {
            const selected = state.profiles.find(p => p.id === edit.drivers[index]);
            return <div key={index}><label><span>{index === 0 ? copy.driver1 : copy.driver2}</span>
              <select value={edit.drivers[index]} onChange={event => {
                const drivers: [string, string] = [...edit.drivers]; drivers[index] = event.target.value;
                setEdit({ ...edit, drivers });
              }}><option value="">{copy.free}</option>{state.profiles.map(p => <option key={p.id} value={p.id} disabled={edit.drivers[1 - index] === p.id || (mode === 'current' && !p.car_name)}>{p.display_name}{p.gamertag ? ` · ${p.gamertag}` : ''}</option>)}</select>
            </label>{selected && <p className="team-driver-detail">{selected.car_name || copy.noCar}{selected.team_name && selected.team_name !== edit.original && <><br />{copy.move}: <strong>{selected.team_name}</strong></>}</p>}</div>;
          })}</div>
          {departingMembers(state, edit).length > 0 && <div className="team-editor-departures"><p>{copy.departureHint}</p>{departingMembers(state, edit).map(p => <label key={p.id}>
            <span>{copy.departure} {p.display_name}</span><select required value={edit.departures[p.id] ?? ''} onChange={event => setEdit({ ...edit, departures: { ...edit.departures, [p.id]: event.target.value } })}>
              <option value="">{copy.destination}</option>{state.teams.filter(t => t.name !== edit.original && t.name !== edit.name.trim()).map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select></label>)}</div>}
          <p>{copy.vehicles}</p>
          <div className="team-editor-actions"><button className="primary-action" type="submit" disabled={!teamEditReady(state, edit, round ? Number(round) : null)}>{busy ? copy.saving : copy.save}</button>
            <button className="text-action" type="button" onClick={() => { setEdit(null); setError(''); }}>{copy.cancel}</button></div>
        </fieldset>
      </form>}
      {state.teams.length === 0 && <p>{copy.empty}</p>}
      <div className="team-lineup-list">{state.teams.map(team => {
        const members = state.profiles.filter(p => p.team_name === team.name);
        return <article className="team-lineup" key={team.name} aria-label={team.name}>
          <header><h3>{team.name}</h3><span>{members.length} / 2</span></header>
          <ul>{members.map(p => <li key={p.id}><div><strong>{p.display_name}</strong><span>{p.gamertag}</span></div><span className="team-driver-car">{p.car_name || copy.noCar}</span></li>)}
            {Array.from({ length: Math.max(0, 2 - members.length) }, (_, index) => <li className="team-empty-seat" key={index}>{copy.free}</li>)}</ul>
          {members.length > 2 && <p>{copy.overfull}</p>}
          <button className="text-action" type="button" disabled={!canEdit || Boolean(edit) || busy || members.length > 2} onClick={() => begin(team.name)}>{copy.edit}</button>
        </article>;
      })}</div>
      <details className="team-unassigned" open={unassigned.length > 0}><summary>{copy.unassigned} ({unassigned.length})</summary>
        {unassigned.length ? <ul>{unassigned.map(p => <li key={p.id}><div><strong>{p.display_name}</strong><span>{p.gamertag} · {p.car_name || copy.noCar}</span></div>
          <button className="text-action" type="button" disabled={!canEdit || Boolean(edit) || busy || (mode === 'current' && !p.car_name)} onClick={() => { setAssigningId(p.id); requestAnimationFrame(() => { assignmentRef.current?.scrollIntoView({ block: 'center' }); assignmentRef.current?.focus({ preventScroll: true }); }); }}>{assignmentCopy.assign}</button></li>)}</ul> : <p>{copy.unassignedEmpty}</p>}
      </details>
    </>}
  </section>;
}
