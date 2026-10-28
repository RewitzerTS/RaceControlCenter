import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLeague } from '../league/LeagueProvider';
import type { DriverAdminWorkspace, LeagueDriver } from './operations';
import { LeagueDriverEditor } from './LeagueDriverEditor';
import { LeagueTeamPanel } from './LeagueTeamPanel';
import { loadTeamManager, teamDisplay, type TeamManager } from './teamManager';
import { vehicleChangeRounds } from './roster';

export function DriverSetupFlow({ driver, workspace, onSaved, onClose }: {
  driver: LeagueDriver; workspace: DriverAdminWorkspace; onSaved: () => Promise<void>; onClose: () => void;
}) {
  const { client } = useLeague();
  const [round, setRound] = useState('');
  const [state, setState] = useState<TeamManager | null>(null);
  const [step, setStep] = useState<'seat' | 'team' | 'summary'>('seat');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState(null); setError('');
    void loadTeamManager(client, 'current', round ? Number(round) : null).then(data => { if (active) setState(data); })
      .catch(() => { if (active) setError('Zuordnungen konnten nicht geladen werden. Bitte erneut versuchen.'); });
    return () => { active = false; };
  }, [client, round, retry]);
  const member = state?.profiles.find(p => p.id === driver.id);
  const seatReady = Boolean(member?.car_name && member.ai_driver_id);
  const rounds = vehicleChangeRounds(state?.races ?? []);
  async function refresh(next: 'team' | 'summary') {
    const data = await loadTeamManager(client, 'current', Number(round));
    setState(data);
    await onSaved();
    setStep(next);
  }
  return <section className="driver-setup" aria-labelledby="driver-setup-title">
    <header className="admin-panel-heading"><div><h2 id="driver-setup-title">{driver.public_name || driver.display_name} startklar machen</h2><p>Jeder Schritt wird einzeln gespeichert. Du kannst jederzeit hier weitermachen.</p></div><button type="button" className="text-action" onClick={onClose}>Zur Übersicht</button></header>
    <ol className="driver-setup-status" aria-label="Zuordnungsstatus">
      <li><strong>Konto</strong><span>{driver.identity_linked ? 'Verknüpft' : 'Noch nicht verknüpft'}</span></li>
      <li><strong>KI-Sitz &amp; Fahrzeug</strong><span>{state ? seatReady ? `${member?.ai_driver_name} · ${member?.car_name}` : 'Noch zuordnen' : 'Wird geladen …'}</span></li>
      <li><strong>Liga-Team</strong><span>{state ? member?.team_name ? teamDisplay(state, member.team_name) : 'Noch zuordnen' : 'Wird geladen …'}</span></li>
    </ol>
    {!driver.identity_linked && <p>Dieser Fahrer kann bereits am Rennbetrieb teilnehmen. Damit er seine Karriere im Konto sieht, <NavLink to="/admin/users">verknüpfe sein Konto unter Benutzer</NavLink>.</p>}
    {error && <p role="alert">{error} <button className="text-action" type="button" onClick={() => setRetry(n => n + 1)}>Erneut laden</button></p>}
    {state && !state.season && <p>Lege zuerst eine Saison mit Rennkalender an. <NavLink to="/admin/season/setup">Saison einrichten</NavLink></p>}
    {state?.season && <><p><strong>{state.season.name}</strong> · Änderungen gelten ab dem ausgewählten Rennen. Frühere Rennen bleiben unverändert.</p>
      <label className="driver-setup-round">Gültig ab Rennen<select value={round} disabled={!rounds.length} onChange={e => { setRound(e.target.value); setStep('seat'); }}><option value="">Rennen ausdrücklich auswählen</option>{rounds.map(r => <option key={r.id} value={r.round}>Runde {r.round} · {r.name}</option>)}</select></label>
      {!rounds.length && <p>Kein ungefahrenes Rennen ist mehr frei. Rennen mit Ergebnisentwurf sind ebenfalls gesperrt.</p>}
    </>}
    {state && round && <>
      <nav className="driver-directory-nav" aria-label="Fahrer einrichten"><button type="button" className="text-action" aria-current={step === 'seat' ? 'step' : undefined} onClick={() => setStep('seat')}>1 · KI-Sitz &amp; Fahrzeug</button><button type="button" className="text-action" disabled={!seatReady} aria-current={step === 'team' ? 'step' : undefined} onClick={() => setStep('team')}>2 · Team</button><button type="button" className="text-action" disabled={!member?.team_name || !seatReady} aria-current={step === 'summary' ? 'step' : undefined} onClick={() => setStep('summary')}>3 · Prüfen</button></nav>
      {step === 'seat' && <><LeagueDriverEditor key={`${driver.id}-${round}`} driverId={driver.id} initialRound={Number(round)} requireSeat={!seatReady} workspace={workspace} onClose={onClose} onSaved={() => refresh('team')} />{seatReady && <button className="primary-action" type="button" onClick={() => setStep('team')}>Bestehenden Sitz behalten · Weiter zum Team</button>}</>}
      {step === 'team' && <LeagueTeamPanel key={`${driver.id}-${round}`} driverId={driver.id} initialRound={Number(round)} onSaved={() => refresh('summary')} />}
      {step === 'summary' && <div className="driver-setup-summary"><h3>{member?.team_name && seatReady ? 'Für das gewählte Rennen zugeordnet' : 'Zuordnung noch unvollständig'}</h3><dl><div><dt>Ab Rennen</dt><dd>{rounds.find(r => r.round === Number(round))?.name} · Runde {round}</dd></div><div><dt>KI-Fahrer</dt><dd>{member?.ai_driver_name || 'Keine KI-Zuordnung'}</dd></div><div><dt>Fahrzeug</dt><dd>{member?.car_name || 'Noch nicht zugeordnet'}</dd></div><div><dt>Team</dt><dd>{member?.team_name ? teamDisplay(state, member.team_name) : 'Noch nicht zugeordnet'}</dd></div></dl><button type="button" className="primary-action" onClick={onClose}>Zur Fahrerübersicht</button></div>}
    </>}
  </section>;
}
