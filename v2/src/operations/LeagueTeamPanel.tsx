import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { useLeague } from '../league/LeagueProvider';
import { assignLeagueTeam, createLeagueTeam, type TeamDirectory } from './leagueTeams';
import { loadRosterWorkspace, vehicleChangeRounds, type RosterWorkspace } from './roster';

export function LeagueTeamPanel({ directory, onSaved }: { directory: TeamDirectory; onSaved: () => Promise<void> }) {
  const { client } = useLeague();
  const [params] = useSearchParams();
  const [name, setName] = useState('');
  const [driverId, setDriverId] = useState(() => directory.profiles.find(profile => profile.id === params.get('driver') && profile.is_active)?.id ?? '');
  const [teamId, setTeamId] = useState(() => directory.preferences.find(item => item.driver_id === params.get('driver'))?.team_id ?? '');
  const [round, setRound] = useState('');
  const [roster, setRoster] = useState<RosterWorkspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  useEffect(() => {
    let active = true;
    void loadRosterWorkspace(client).then(value => { if (active) setRoster(value); }).catch(() => { if (active) setError('Saisonstand konnte nicht geladen werden. Bitte die Seite neu laden.'); });
    return () => { active = false; };
  }, [client]);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSaved('');
    try { const id = await createLeagueTeam(client, name); await onSaved(); setName(''); setTeamId(id); setSaved('Liga-Team angelegt. Du kannst jetzt Fahrer zuordnen.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Team konnte nicht angelegt werden.'); }
    finally { setBusy(false); }
  }
  async function assign(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSaved('');
    try {
      await assignLeagueTeam(client, driverId, teamId || null, round ? Number(round) : null);
      await onSaved();
      setRoster(await loadRosterWorkspace(client));
      setSaved(round ? `Teamwechsel ab Rennen ${round} gespeichert. Das Fahrzeug bleibt unverändert.` : 'Team-Vorgabe gespeichert. Die laufende Saison bleibt unverändert.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Zuordnung konnte nicht gespeichert werden.'); }
    finally { setBusy(false); }
  }
  return <section className="league-team-panel" aria-labelledby="league-teams-heading">
    <h2 id="league-teams-heading">Eigene Liga-Teams</h2>
    <p>Dein Teamname ist unabhängig vom F1-Fahrzeug. Beispielsweise kann „RCC Racing“ mit Mercedes fahren.</p>
    <form className="team-create-form" onSubmit={event => void create(event)}>
      <label><span>Neuer Teamname</span><input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>
      <button className="primary-action" disabled={busy || name.trim().length < 2} type="submit">Team erstellen</button>
    </form>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {saved && <p className="inline-success" role="status">{saved}</p>}
    {directory.teams.length === 0 ? <p>Noch keine eigenen Liga-Teams. Erstelle oben das erste Team.</p> : <ul className="league-team-directory">{directory.teams.map(team => {
      const members = directory.profiles.filter(profile => directory.preferences.some(preference => preference.driver_id === profile.id && preference.team_id === team.id));
      return <li key={team.id}><strong>{team.name}</strong><span>{members.length ? members.map(profile => `${profile.display_name}${profile.gamertag ? ` · ${profile.gamertag}` : ''}`).join(', ') : 'Noch keine Fahrer zugeordnet'}</span></li>;
    })}</ul>}
    <form className="team-assignment-form" onSubmit={event => void assign(event)}>
      <h3>Fahrer einem Team zuordnen</h3>
      <div className="admin-form-columns">
        <label><span>Fahrerprofil</span><select required value={driverId} onChange={event => { const id = event.target.value; setDriverId(id); setTeamId(directory.preferences.find(item => item.driver_id === id)?.team_id ?? ''); setRound(''); setSaved(''); }}><option value="">Fahrer auswählen</option>{directory.profiles.filter(profile => profile.is_active).map(profile => <option key={profile.id} value={profile.id}>{profile.display_name} · {profile.gamertag || 'Gamertag fehlt'}</option>)}</select></label>
        <label><span>Liga-Team</span><select value={teamId} onChange={event => { setTeamId(event.target.value); if (!event.target.value) setRound(''); }}><option value="">Keine eigene Team-Vorgabe</option>{directory.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        <label><span>Gültigkeit</span><select disabled={!teamId || !roster} value={round} onChange={event => setRound(event.target.value)}><option value="">Nur als Vorgabe für die nächste Saison</option>{roster && vehicleChangeRounds(roster.races).map(race => <option key={race.id} value={race.round}>Aktive Saison: ab Rennen {race.round} · {race.name}</option>)}</select></label>
      </div>
      <p>{round ? 'Der Teamwechsel gilt ab dem gewählten Rennen und wird für die nächste Saison vorgemerkt. Frühere Ergebnisse bleiben erhalten.' : 'Diese Vorgabe wird bei der nächsten Saison-Einrichtung vorausgewählt. Sie ändert keine laufenden Wertungen.'}</p>
      <button className="primary-action" disabled={busy || !driverId || !roster} type="submit">{busy ? 'Wird gespeichert …' : 'Team zuordnen'}</button>
    </form>
    <details className="driver-roster-disclosure"><summary>Bisherige Teamdaten</summary><p>Die bisherige Sammelbearbeitung von Teamnamen und Fahrzeugen bleibt verfügbar. Für zeitlich begrenzte Saisonwechsel verwende die neue Zuordnung oben.</p><NavLink className="text-link" to="/admin/teams/legacy">Bisherige Teamdaten bearbeiten</NavLink></details>
  </section>;
}
