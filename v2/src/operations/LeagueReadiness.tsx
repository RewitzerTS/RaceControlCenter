import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLeague } from '../league/LeagueProvider';
import { loadMemberAdminWorkspace } from './operations';
import { loadTeamManager, type TeamManager } from './teamManager';
import { vehicleChangeRounds } from './roster';
import './league-teams.css';

export function LeagueReadiness() {
  const { client } = useLeague();
  const [data, setData] = useState<{ roster: TeamManager; unlinked: number } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null); setError(false);
    void Promise.all([loadTeamManager(client, 'current', null), loadMemberAdminWorkspace(client)]).then(async ([roster, members]) => {
      // Check the first editable race, including assignments already scheduled for it.
      const next = vehicleChangeRounds(roster.races)[0];
      const effective = next ? await loadTeamManager(client, 'current', next.round) : roster;
      if (active) setData({ roster: effective, unlinked: members.members.filter(m => m.role === 'driver' && !m.driver_id).length });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [client, retry]);
  if (error) return <section className="league-readiness"><p>Der Zuordnungsstatus konnte nicht geladen werden.</p><button className="text-action" type="button" onClick={() => setRetry(n => n + 1)}>Erneut laden</button></section>;
  if (!data) return <section className="league-readiness" aria-busy="true"><p>Fahrerzuordnungen werden geprüft …</p></section>;
  const humans = data.roster.profiles.filter(p => p.is_active && !p.is_ai);
  const noSeat = humans.filter(p => !p.car_name || !p.ai_driver_id);
  const noTeam = humans.filter(p => p.car_name && p.ai_driver_id && !p.team_name);
  const race = data.roster.races.find(r => r.round === data.roster.view_round);
  return <section className="league-readiness" aria-labelledby="league-readiness-title"><h2 id="league-readiness-title">Fahrer für die Saison vorbereiten</h2>
    <p>{data.roster.season ? `${data.roster.season.name}${race ? ` · Runde ${race.round}: ${race.name}` : ''}` : 'Noch keine laufende Saison. Die Kontoverknüpfung ist bereits möglich.'}</p>
    <ul><li><NavLink to="/admin/users">{data.unlinked} Fahrerkonten ohne Verknüpfung</NavLink></li>{data.roster.season && <><li><NavLink to="/admin/drivers">{noSeat.length} Fahrer ohne KI-Sitz / Fahrzeug</NavLink></li><li><NavLink to="/admin/teams">{noTeam.length} Fahrer mit Sitz, aber ohne Team</NavLink></li></>}</ul>
    {data.roster.season && noSeat.length + noTeam.length === 0 && <p>{humans.length ? 'Alle aktiven Fahrer haben für diesen Stand ein Fahrzeug und ein Team.' : 'Noch keine aktiven Fahrer zugeordnet.'}</p>}
    <NavLink className="text-link" to={data.roster.season ? '/admin/drivers' : '/admin/season/setup'}>{data.roster.season ? 'Fahrer startklar machen' : 'Saison einrichten'}</NavLink>
  </section>;
}
