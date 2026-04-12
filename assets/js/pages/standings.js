function getTrendIcon(currentPos, previousPos, hasPreviousRace = false) {
  if (!hasPreviousRace) return '<span class="trend-pill flat">↔</span>';
  if (!Number.isFinite(previousPos)) return '<span class="trend-pill up">↑</span>';
  if (currentPos < previousPos) return '<span class="trend-pill up">↑</span>';
  if (currentPos > previousPos) return '<span class="trend-pill down">↓</span>';
  return '<span class="trend-pill flat">↔</span>';
}

function withDriverTrends(current, previous, hasPreviousRace = false) {
  const previousPositions = new Map(previous.map((entry, index) => [entry.driverId, index + 1]));
  return current.map((entry, index) => ({
    ...entry,
    trend: getTrendIcon(index + 1, previousPositions.get(entry.driverId), hasPreviousRace)
  }));
}

function withTeamTrends(current, previous, hasPreviousRace = false) {
  const previousPositions = new Map(previous.map((entry, index) => [entry.teamName, index + 1]));
  return current.map((entry, index) => ({
    ...entry,
    trend: getTrendIcon(index + 1, previousPositions.get(entry.teamName), hasPreviousRace)
  }));
}

function renderDriverStandings(standings) {
  const tbody = document.getElementById('drivers-standings-body');
  if (!tbody) return;

  if (!standings.length) {
    tbody.innerHTML = '<tr><td colspan="9">Noch keine Fahrerdaten vorhanden.</td></tr>';
    return;
  }

  tbody.innerHTML = standings.map((entry, index) => `
    <tr class="${index < 3 ? `podium-${index + 1}` : ''}">
      <td>${index + 1}</td>
      <td class="trend-cell">${entry.trend}</td>
      <td>${window.escapeHtml(entry.driverName)}</td>
      <td>${window.escapeHtml(entry.leagueTeam)}</td>
      <td>${window.escapeHtml(entry.carName)}</td>
      <td>${entry.wins}</td>
      <td>${entry.podiums}</td>
      <td>${entry.fastestLaps}</td>
      <td><strong>${entry.points}</strong></td>
    </tr>
  `).join('');
}

function renderTeamStandings(standings) {
  const tbody = document.getElementById('teams-standings-body');
  if (!tbody) return;

  if (!standings.length) {
    tbody.innerHTML = '<tr><td colspan="8">Noch keine Teamdaten vorhanden.</td></tr>';
    return;
  }

  tbody.innerHTML = standings.map((entry, index) => `
    <tr class="${index < 3 ? `podium-${index + 1}` : ''}">
      <td>${index + 1}</td>
      <td class="trend-cell">${entry.trend}</td>
      <td>${window.escapeHtml(entry.teamName)}</td>
      <td>${window.escapeHtml(entry.driver1)}</td>
      <td>${window.escapeHtml(entry.car1)}</td>
      <td>${window.escapeHtml(entry.driver2)}</td>
      <td>${window.escapeHtml(entry.car2)}</td>
      <td><strong>${entry.points}</strong></td>
    </tr>
  `).join('');
}

async function loadStandingsPage() {
  try {
    const currentSeason = await window.RCCData.fetchCurrentSeason();
    const [drivers, races, raceResults, assignments] = await Promise.all([
      window.RCCData.fetchDrivers(),
      window.RCCData.fetchRaces({ seasonId: currentSeason?.id }),
      window.RCCData.fetchRaceResults(),
      window.RCCDriverContext.fetchDriverSeasonAssignments({ seasonId: currentSeason?.id })
    ]);

    const completedRaces = races.filter((race) => race.status === 'completed').sort((a, b) => a.round_number - b.round_number);
    const resolver = window.RCCDriverContext.createAssignmentResolver({ drivers, races, assignments });
    const currentStandings = window.RCCData.buildStandings({ drivers, races, raceResults, resolver });
    const previousRaces = completedRaces.slice(0, -1);
    const previousStandings = window.RCCData.buildStandings({ drivers, races: previousRaces, raceResults, resolver });

    const hasPreviousRace = previousRaces.length > 0;
    renderDriverStandings(withDriverTrends(currentStandings.driverStandings, previousStandings.driverStandings, hasPreviousRace));
    renderTeamStandings(withTeamTrends(currentStandings.teamStandings, previousStandings.teamStandings, hasPreviousRace));
  } catch (error) {
    console.error(error);
    const driverBody = document.getElementById('drivers-standings-body');
    const teamBody = document.getElementById('teams-standings-body');
    if (driverBody) driverBody.innerHTML = '<tr><td colspan="9">Fehler beim Laden der Fahrer-WM.</td></tr>';
    if (teamBody) teamBody.innerHTML = '<tr><td colspan="8">Fehler beim Laden der Team-WM.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', loadStandingsPage);
