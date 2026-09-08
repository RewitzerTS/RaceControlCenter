import { currentResults, fastestLapDriver, type ResultsData, type ResultsRace } from './resultsData';

export type Trend = 'up' | 'down' | 'flat' | 'new';
export interface DriverStanding { driverId: string; driverName: string; leagueTeam: string; carName: string; wins: number; podiums: number; fastestLaps: number; points: number; trend: Trend }
export interface TeamStanding { teamName: string; points: number; drivers: { id: string; name: string; car: string }[]; trend: Trend }
const normalized = (name: string) => name.trim().toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function standingSnapshot(data: ResultsData, driverId: string, race?: ResultsRace) {
  const driver = data.drivers.find((entry) => entry.id === driverId);
  if (!driver) return null;
  const assignment = data.assignments.filter((entry) => entry.driver_id === driverId && (entry.effective_round_number ?? 0) <= (race?.round_number ?? 0))
    .sort((a, b) => (a.effective_round_number ?? 0) - (b.effective_round_number ?? 0) || a.created_at.localeCompare(b.created_at)).at(-1);
  return assignment ? { ...driver, league_team: assignment.team_name ?? '', car_name: assignment.car_name || driver.car_name } : driver;
}

function standingsForRaces(data: ResultsData, races: ResultsRace[]) {
  const raceIds = new Set(races.map((race) => race.id));
  const results = currentResults(data.races, data.results).filter((row) => raceIds.has(row.race_id));
  const fastest = new Map(races.map((race) => [race.id, fastestLapDriver(results.filter((row) => row.race_id === race.id))]));
  const drivers = new Map<string, DriverStanding>();
  const teams = new Map<string, TeamStanding>();
  for (const driver of data.drivers) {
    const snapshot = standingSnapshot(data, driver.id, races[0])!;
    drivers.set(driver.id, { driverId: driver.id, driverName: driver.display_name, leagueTeam: snapshot.league_team || 'Ohne Team', carName: snapshot.car_name || '—', wins: 0, podiums: 0, fastestLaps: 0, points: 0, trend: 'flat' });
  }
  for (const row of results) {
    const snapshot = standingSnapshot(data, row.driver_id, races.find((race) => race.id === row.race_id));
    const driver = drivers.get(row.points_owner_driver_id || row.driver_id);
    if (!snapshot || !driver) continue;
    // Exactly the published score, including substitutes, penalties and bonuses.
    const points = Number(row.awarded_points);
    driver.points += points;
    driver.leagueTeam = row.points_team_name || snapshot.league_team || driver.leagueTeam;
    driver.carName = row.points_car_name || snapshot.car_name || driver.carName;
    if (row.finish_position === 1) driver.wins++;
    if ([1, 2, 3].includes(row.finish_position ?? 0)) driver.podiums++;
    const teamName = row.points_team_name || snapshot.league_team || 'Ohne Team';
    let team = teams.get(teamName);
    if (!team) { team = { teamName, points: 0, drivers: [], trend: 'flat' }; teams.set(teamName, team); }
    team.points += points;
    if (!team.drivers.some((entry) => entry.id === snapshot.id)) team.drivers.push({ id: snapshot.id, name: snapshot.display_name, car: snapshot.car_name || '—' });
  }
  for (const [raceId, driverId] of fastest) {
    const winner = results.find((row) => row.race_id === raceId && row.driver_id === driverId);
    const owner = winner && drivers.get(winner.points_owner_driver_id || winner.driver_id);
    if (owner) owner.fastestLaps++;
  }
  const eligible = new Set(data.assignments.length ? data.assignments.map((entry) => entry.driver_id) : data.drivers.filter((entry) => entry.is_active !== false).map((entry) => entry.id));
  const driverStandings = [...drivers.values()].filter((entry) => !eligible.size || eligible.has(entry.driverId))
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums || b.fastestLaps - a.fastestLaps || normalized(a.driverName).localeCompare(normalized(b.driverName), 'de'));
  const teamStandings = [...teams.values()].map((team) => ({ ...team, drivers: team.drivers.sort((a, b) => normalized(a.name).localeCompare(normalized(b.name), 'de')).slice(0, 2) }))
    .sort((a, b) => b.points - a.points || a.teamName.localeCompare(b.teamName, 'de', { sensitivity: 'base' }));
  return { driverStandings, teamStandings };
}

export function standingTrend(current: number, previous: number, hasPreviousRace: boolean): Trend {
  if (!hasPreviousRace) return 'flat';
  if (previous < 0) return 'new';
  return current < previous ? 'up' : current > previous ? 'down' : 'flat';
}

export function buildStandings(data: ResultsData) {
  const published = new Set(currentResults(data.races, data.results).map((row) => row.race_id));
  const completed = data.races.filter((race) => race.status === 'completed' || published.has(race.id)).sort((a, b) => a.round_number - b.round_number);
  const current = standingsForRaces(data, completed);
  const previous = standingsForRaces(data, completed.slice(0, -1));
  current.driverStandings.forEach((entry, index) => { entry.trend = standingTrend(index, previous.driverStandings.findIndex((old) => old.driverId === entry.driverId), completed.length > 1); });
  current.teamStandings.forEach((entry, index) => { entry.trend = standingTrend(index, previous.teamStandings.findIndex((old) => old.teamName === entry.teamName), completed.length > 1); });
  return { ...current, latestRace: completed.at(-1) };
}
