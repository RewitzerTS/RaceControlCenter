import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useLeague } from '../league/LeagueProvider';
import { useI18n } from '../i18n/I18nProvider';
import { loadResults, type ResultsData } from './resultsData';
import { racingHref } from './calendarData';
import { buildGrid } from './gridData';
import { CarLogo } from './RacingStandings';
import './racing.css';
import './grid.css';

const messages = {
  de: { seats: 'Sitze', loading: 'Grid wird geladen …', error: 'Das Grid konnte nicht geladen werden.', retry: 'Erneut versuchen', noSeason: 'Keine aktive Saison', empty: 'Für diese Saison sind noch keine Fahrer eingetragen.', player: 'Spieler', bot: 'KI-Fahrer', unknown: 'Fahrer', noTeam: 'Ohne Team', ai: 'KI-Sitz' },
  en: { seats: 'seats', loading: 'Loading grid …', error: 'The grid could not be loaded.', retry: 'Try again', noSeason: 'No active season', empty: 'No drivers have been added to this season yet.', player: 'Player', bot: 'AI driver', unknown: 'Driver', noTeam: 'No team', ai: 'AI seat' },
  es: { seats: 'plazas', loading: 'Cargando parrilla …', error: 'No se pudo cargar la parrilla.', retry: 'Reintentar', noSeason: 'No hay temporada activa', empty: 'Todavía no hay pilotos en esta temporada.', player: 'Jugador', bot: 'Piloto IA', unknown: 'Piloto', noTeam: 'Sin equipo', ai: 'Plaza IA' },
  fr: { seats: 'places', loading: 'Chargement de la grille …', error: 'Impossible de charger la grille.', retry: 'Réessayer', noSeason: 'Aucune saison active', empty: 'Aucun pilote inscrit pour cette saison.', player: 'Joueur', bot: 'Pilote IA', unknown: 'Pilote', noTeam: 'Sans équipe', ai: 'Place IA' },
};

export function RacingGrid() {
  const { client, leagueSlug } = useLeague();
  const { user, loading } = useAuth();
  const { language } = useI18n();
  const copy = messages[language];
  const [data, setData] = useState<ResultsData | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const userId = user?.id || '';
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(false);
    if (!loading) void loadResults(client, leagueSlug, Boolean(userId), controller.signal).then((value) => { if (!controller.signal.aborted) setData(value); }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [client, leagueSlug, userId, loading, retry]);
  const grid = data ? buildGrid(data) : null;
  return <section className="native-racing native-grid" data-native-racing="grid" aria-labelledby="grid-title">
    <header><h1 id="grid-title">Grid</h1>{data?.season && <p>{data.season.name} · {grid!.seats.length} {copy.seats}</p>}</header>
    {error ? <div role="alert"><p>{copy.error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button></div> : !data ? <p role="status">{copy.loading}</p> : !data.season ? <h2>{copy.noSeason}</h2> : !grid!.seats.length ? <p>{copy.empty}</p> : <div className="native-grid-teams">{grid!.groups.map((group) => <section key={group.name} className="native-grid-team">
      <CarLogo candidates={[group.members[0]?.car, group.name]} label={group.members[0]?.car || group.name || copy.noTeam} />
      <h2>{group.name ? <Link to={racingHref('/racing/teams/profile', leagueSlug, { team: group.name })}>{group.name}</Link> : copy.noTeam}</h2>
      <ul>{group.members.map((seat) => <li key={seat.key}><div className="native-grid-seat-heading"><h3>{seat.driverId ? <Link to={racingHref('/racing/drivers/profile', leagueSlug, { driver: seat.driverId })}>{seat.name}</Link> : seat.name}</h3><span>{seat.number != null ? `#${seat.number}` : '—'}</span></div><p>{copy[seat.type as 'player' | 'bot' | 'unknown']}{seat.gamertag ? ` · ${seat.gamertag}` : ''}</p>{seat.car && <p>{seat.car}</p>}{seat.type === 'player' && seat.ai && <p>{copy.ai}: {seat.ai}</p>}</li>)}</ul>
    </section>)}</div>}
  </section>;
}
