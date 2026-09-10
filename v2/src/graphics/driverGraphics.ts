import { buildStandings } from '../racing/standingsData';
import { currentResults } from '../racing/resultsData';
import { driverStats, type HistoryData } from '../racing/profileData';
import { raceResultTime, type GraphicModel } from './graphics';

export type DriverGraphicKind = 'race_result' | 'driver_standings' | 'team_standings' | 'statistics';
export const driverGraphicCopy = {
  de: { title: 'Grafik erstellen', copy: 'Rennergebnisse, Tabellen und deine Statistiken als Bild herunterladen.', race_result: 'Rennergebnis', driver_standings: 'Fahrerwertung', team_standings: 'Teamwertung', statistics: 'Meine Statistik', season: 'Saison', race: 'Rennen', starts: 'Starts', wins: 'Siege', podiums: 'Podien', points: 'Punkte', noLink: 'Deinem Konto ist in dieser Liga noch kein Fahrer zugeordnet. Bitte wende dich an die Ligaleitung.', empty: 'Für diese Auswahl liegen noch keine veröffentlichten Ergebnisse vor.', source: 'Veröffentlichte Ergebnisse', back: 'Zum Profil', retry: 'Erneut versuchen', error: 'Die Grafik konnte nicht geladen oder erstellt werden.', format: 'Format', preview: 'Vorschau', download: 'PNG herunterladen', busy: 'Grafik wird erstellt …', done: 'Download vorbereitet.', page: 'Seite', all: 'Alle Seiten herunterladen' },
  en: { title: 'Create graphic', copy: 'Download race results, standings and your statistics as images.', race_result: 'Race result', driver_standings: 'Driver standings', team_standings: 'Team standings', statistics: 'My statistics', season: 'Season', race: 'Race', starts: 'Starts', wins: 'Wins', podiums: 'Podiums', points: 'Points', noLink: 'No driver is linked to your account in this league yet. Please contact your league administrator.', empty: 'There are no published results for this selection yet.', source: 'Published results', back: 'Back to profile', retry: 'Try again', error: 'The graphic could not be loaded or created.', format: 'Format', preview: 'Preview', download: 'Download PNG', busy: 'Creating graphic …', done: 'Download prepared.', page: 'Page', all: 'Download all pages' },
  es: { title: 'Crear gráfico', copy: 'Descarga resultados, clasificaciones y tus estadísticas como imágenes.', race_result: 'Resultado', driver_standings: 'Clasificación de pilotos', team_standings: 'Clasificación de equipos', statistics: 'Mis estadísticas', season: 'Temporada', race: 'Carrera', starts: 'Participaciones', wins: 'Victorias', podiums: 'Podios', points: 'Puntos', noLink: 'Tu cuenta aún no tiene un piloto vinculado en esta liga. Contacta con la administración.', empty: 'No hay resultados publicados para esta selección.', source: 'Resultados publicados', back: 'Volver al perfil', retry: 'Reintentar', error: 'No se pudo cargar o crear el gráfico.', format: 'Formato', preview: 'Vista previa', download: 'Descargar PNG', busy: 'Creando gráfico …', done: 'Descarga preparada.', page: 'Página', all: 'Descargar todas las páginas' },
  fr: { title: 'Créer un visuel', copy: 'Télécharge les résultats, classements et tes statistiques en images.', race_result: 'Résultat', driver_standings: 'Classement pilotes', team_standings: 'Classement équipes', statistics: 'Mes statistiques', season: 'Saison', race: 'Course', starts: 'Départs', wins: 'Victoires', podiums: 'Podiums', points: 'Points', noLink: 'Aucun pilote n’est encore lié à ton compte dans cette ligue. Contacte la direction.', empty: 'Aucun résultat publié pour cette sélection.', source: 'Résultats publiés', back: 'Retour au profil', retry: 'Réessayer', error: 'Impossible de charger ou créer le visuel.', format: 'Format', preview: 'Aperçu', download: 'Télécharger le PNG', busy: 'Création du visuel …', done: 'Téléchargement préparé.', page: 'Page', all: 'Télécharger toutes les pages' },
};

export function buildDriverGraphic(data: HistoryData, kind: DriverGraphicKind, seasonId: string, raceId: string, ownDriverId: string, leagueName: string, copy: typeof driverGraphicCopy.en): GraphicModel | null {
  const season = data.seasons.find((item) => item.id === seasonId);
  if (!season) return null;
  const races = data.races.filter((race) => race.season_id === seasonId);
  const results = currentResults(races, data.results);
  const base: GraphicModel = { type: kind === 'statistics' ? 'driver_standings' : kind, eyebrow: copy[kind], title: leagueName, subtitle: season.name, footer: copy.source, rows: [], resultVersionId: null, source: {} };
  if (kind === 'race_result') {
    const race = races.find((item) => item.id === raceId);
    if (!race?.current_result_version_id) return null;
    base.title = race.grand_prix_name;
    base.subtitle = `${season.name} · ${copy.race} ${race.round_number}`;
    base.resultVersionId = race.current_result_version_id;
    base.source.result = { race_date: race.race_date, round: race.round_number, country_code: race.country_code };
    const winner = results.find((row) => row.race_id === race.id && row.finish_position === 1);
    base.rows = results.filter((row) => row.race_id === race.id).sort((a, b) => (a.finish_position || 999) - (b.finish_position || 999)).map((row) => {
      const driver = data.drivers.find((item) => item.id === row.driver_id);
      const detail = raceResultTime({ position: row.finish_position ?? null, driver: '', team: '', points: row.awarded_points, status: 'classified', raceTime: row.race_time, raceTimeMs: row.race_time_ms }, winner?.race_time_ms ?? null);
      return { rank: row.finish_position ? String(row.finish_position) : '—', primary: driver?.gamertag || driver?.display_name || '—', secondary: row.points_team_name || row.car_name_snapshot || '', detail, value: `${row.awarded_points} ${copy.points}` };
    });
  } else if (kind === 'statistics') {
    if (!ownDriverId || !data.drivers.some((item) => item.id === ownDriverId)) return null;
    const stats = driverStats(data, ownDriverId, seasonId);
    if (!stats.starts && !stats.points) return null;
    const driver = data.drivers.find((item) => item.id === ownDriverId)!;
    base.title = driver.gamertag || driver.display_name;
    base.source.statistics = true;
    base.rows = [['starts', stats.starts], ['wins', stats.wins], ['podiums', stats.podiums], ['points', stats.points]].map(([key, value]) => ({ rank: '', primary: copy[key as 'starts'], secondary: '', value: String(value) }));
  } else {
    if (!results.length) return null;
    const standings = buildStandings({ season, drivers: data.drivers, races, results, assignments: data.assignments.filter((item) => item.season_id === seasonId) });
    base.rows = kind === 'driver_standings' ? standings.driverStandings.map((row, index) => ({ rank: String(index + 1), primary: data.drivers.find((item) => item.id === row.driverId)?.gamertag || row.driverName, secondary: `${row.wins} ${copy.wins}`, value: `${row.points} ${copy.points}` })) : standings.teamStandings.map((row, index) => ({ rank: String(index + 1), primary: row.teamName, secondary: '', value: `${row.points} ${copy.points}` }));
  }
  return base.rows.length ? base : null;
}
