import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { loadRaceAdminWorkspace, type RaceAdminWorkspace } from './operations';

type ViewMode = 'races' | 'results' | 'standings';
const STATUS_LABELS: Record<string, string> = { upcoming: 'Geplant', completed: 'Abgeschlossen', cancelled: 'Abgesagt', active: 'Offiziell', draft: 'Entwurf', validated: 'Geprüft', superseded: 'Ersetzt', void: 'Ungültig' };

export function LeagueRacesPage() {
  const { client, leagueSlug } = useLeague();
  const { role } = useRole();
  const { formatDate, formatNumber } = useI18n();
  const { pathname } = useLocation();
  const [workspace, setWorkspace] = useState<RaceAdminWorkspace | null>(null);
  const [error, setError] = useState('');
  const allowed = role === 'league_admin' || role === 'platform_owner';
  const mode: ViewMode = pathname.endsWith('/results') ? 'results' : pathname.endsWith('/standings') ? 'standings' : 'races';

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void loadRaceAdminWorkspace(client).then((data) => { if (active) setWorkspace(data); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Rennverwaltung konnte nicht geladen werden.'); });
    return () => { active = false; };
  }, [allowed, client]);

  if (!allowed) return <main className="driver-state" id="main-content"><span className="state-mark">17</span><div><h1>Zugriff verweigert</h1></div></main>;
  if (!workspace && !error) return <main className="driver-state" id="main-content"><span className="state-mark">R</span><div><h1>Rennverwaltung wird geladen …</h1></div></main>;
  if (!workspace) return <main className="driver-state" id="main-content"><span className="state-mark">!</span><div><h1>Rennverwaltung nicht verfügbar</h1><p>{error}</p></div></main>;

  const officialRaces = workspace.races.filter((race) => race.result_status === 'active').length;
  const currentSeason = workspace.seasons.find((season) => season.is_active);

  return <main className="operations-page admin-management-page" id="main-content">
    <header className="operations-header"><div><p className="section-label">V1 Admin · {leagueSlug}</p><h1>{mode === 'races' ? 'Rennen' : mode === 'results' ? 'Ergebnisse' : 'Wertungen'}</h1><p>Rennkalender, offizielle Ergebnisstände und Meisterschaft der aktiven Liga in einer gemeinsamen, revisionssicheren Übersicht.</p></div><NavLink className="text-link" to="/admin">Zum Admin-Menü</NavLink></header>
    <nav className="admin-view-tabs" aria-label="Rennverwaltung"><NavLink to="/admin/races">Rennen</NavLink><NavLink to="/admin/results">Ergebnisse</NavLink><NavLink to="/admin/standings">Wertungen</NavLink></nav>
    <section className="operations-metrics admin-race-metrics" aria-label="Saisonübersicht"><div><strong>{formatNumber(workspace.races.length)}</strong><span>Rennen</span></div><div><strong>{formatNumber(officialRaces)}</strong><span>Offizielle Ergebnisse</span></div><div><strong>{formatNumber(workspace.driver_standings.length)}</strong><span>Gewertete Fahrer</span></div><div><strong>{currentSeason?.name ?? '—'}</strong><span>Aktive Saison</span></div></section>
    {mode !== 'standings' ? <section className="admin-data-panel"><div className="admin-panel-heading"><div><p className="section-label">{mode === 'races' ? 'Kalender' : 'Revisionsstatus'}</p><h2>{mode === 'races' ? 'Rennwochenenden' : 'Veröffentlichte Ergebnisse'}</h2></div><strong>{workspace.races.length}</strong></div><div className="responsive-table"><table><thead><tr><th>Rd.</th><th>Grand Prix</th><th>Termin</th><th>Rennen</th><th>Ergebnis</th><th>Starter</th></tr></thead><tbody>{workspace.races.map((race) => <tr key={race.id}><td>{race.round_number}</td><td><strong>{race.grand_prix_name}</strong><small>{race.circuit_name || race.season_name}{race.has_sprint ? ' · Sprint' : ''}</small></td><td>{race.race_date ? formatDate(race.race_date) : 'Offen'}</td><td><span className={`admin-status admin-status--${race.status}`}>{STATUS_LABELS[race.status] ?? race.status}</span></td><td>{race.result_status ? <><strong>V{race.result_version}</strong><small>{STATUS_LABELS[race.result_status] ?? race.result_status}</small></> : <span className="admin-status">Noch offen</span>}</td><td>{race.result_count}</td></tr>)}</tbody></table></div></section> : <div className="standings-grid"><section className="admin-data-panel"><div className="admin-panel-heading"><div><p className="section-label">Fahrer-WM</p><h2>Fahrerwertung</h2></div><strong>{workspace.driver_standings.length}</strong></div><div className="responsive-table"><table><thead><tr><th>Pos.</th><th>Fahrer</th><th>Punkte</th><th>Siege</th><th>Podien</th></tr></thead><tbody>{workspace.driver_standings.map((entry, index) => <tr key={entry.driver_id}><td>{index + 1}</td><td><strong>{entry.display_name}</strong><small>{entry.gamertag ?? `${entry.starts} Starts`}</small></td><td><strong>{formatNumber(entry.points)}</strong></td><td>{entry.wins}</td><td>{entry.podiums}</td></tr>)}</tbody></table></div></section><section className="admin-data-panel"><div className="admin-panel-heading"><div><p className="section-label">Team-WM</p><h2>Teamwertung</h2></div><strong>{workspace.team_standings.length}</strong></div><div className="responsive-table"><table><thead><tr><th>Pos.</th><th>Team</th><th>Punkte</th><th>Siege</th></tr></thead><tbody>{workspace.team_standings.map((entry, index) => <tr key={entry.team_name}><td>{index + 1}</td><td><strong>{entry.team_name}</strong><small>{entry.podiums} Podien</small></td><td><strong>{formatNumber(entry.points)}</strong></td><td>{entry.wins}</td></tr>)}</tbody></table></div></section></div>}
  </main>;
}
