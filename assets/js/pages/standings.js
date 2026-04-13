function getDriverBasePoints(entry) {
  return 0;
}

function getTeamBasePoints(entry) {
  return 0;
}

function mergeCorrectedDriverStandings(baseStandings, incrementalStandings) {
  const incrementalById = new Map((incrementalStandings || []).map((entry) => [entry.driverId, entry]));
  return (baseStandings || [])
    .map((entry) => ({
      ...entry,
      points: getDriverBasePoints(entry) + (incrementalById.get(entry.driverId)?.points || 0)
    }))
    .sort((a, b) => b.points - a.points || a.driverName.localeCompare(b.driverName, 'de'));
}

function mergeCorrectedTeamStandings(baseStandings, incrementalStandings) {
  const incrementalByTeam = new Map((incrementalStandings || []).map((entry) => [entry.teamName, entry]));
  return (baseStandings || [])
    .map((entry) => ({
      ...entry,
      points: getTeamBasePoints(entry) + (incrementalByTeam.get(entry.teamName)?.points || 0)
    }))
    .sort((a, b) => b.points - a.points || a.teamName.localeCompare(b.teamName, 'de'));
}

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

function updateStandingsMeta(currentSeason, driverCount, teamCount) {
  const subtitles = document.querySelectorAll('.page-subtitle');
  const seasonLabel = currentSeason?.name ? `Saison ${currentSeason.name}` : 'Alle verfügbaren Daten';
  if (subtitles[0]) subtitles[0].textContent = `${seasonLabel} · automatische Wertung aus korrigiertem Saisonstand der laufenden Saison + neuen veröffentlichten Rennergebnissen.`;
  if (subtitles[1]) subtitles[1].textContent = `${seasonLabel} · automatische Wertung aus korrigiertem Saisonstand der laufenden Saison + neuen veröffentlichten Rennergebnissen.`;

  const tableHeaders = document.querySelectorAll('.table-header .muted');
  if (tableHeaders[0]) tableHeaders[0].textContent = `${driverCount} Fahrer`;
  if (tableHeaders[1]) tableHeaders[1].textContent = `${teamCount} Teams`;
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

    const fullStandings = window.RCCData.buildStandings({ drivers, races, raceResults, resolver });
    const overriddenRaceNames = new Set(window.RCC_STATIC_RESULTS_14?.races || []);
    const incrementalRaces = completedRaces.filter((race) => !overriddenRaceNames.has(race.grand_prix_name));
    const incrementalStandings = window.RCCData.buildStandings({ drivers, races: incrementalRaces, raceResults, resolver });

    const previousRaces = completedRaces.slice(0, -1);
    const previousIncrementalRaces = previousRaces.filter((race) => !overriddenRaceNames.has(race.grand_prix_name));
    const previousBaseStandings = window.RCCData.buildStandings({ drivers, races: previousRaces, raceResults, resolver });
    const previousIncrementalStandings = window.RCCData.buildStandings({ drivers, races: previousIncrementalRaces, raceResults, resolver });

    const hasPreviousRace = previousRaces.length > 0;
    const correctedCurrentDrivers = mergeCorrectedDriverStandings(fullStandings.driverStandings, incrementalStandings.driverStandings);
    const correctedPreviousDrivers = mergeCorrectedDriverStandings(previousBaseStandings.driverStandings, previousIncrementalStandings.driverStandings);
    const correctedCurrentTeams = mergeCorrectedTeamStandings(fullStandings.teamStandings, incrementalStandings.teamStandings);
    const correctedPreviousTeams = mergeCorrectedTeamStandings(previousBaseStandings.teamStandings, previousIncrementalStandings.teamStandings);

    const driverStandings = withDriverTrends(correctedCurrentDrivers, correctedPreviousDrivers, hasPreviousRace);
    const teamStandings = withTeamTrends(correctedCurrentTeams, correctedPreviousTeams, hasPreviousRace);
    renderDriverStandings(driverStandings);
    renderTeamStandings(teamStandings);
    updateStandingsMeta(currentSeason, driverStandings.length, teamStandings.length);
  } catch (error) {
    console.error(error);
    const driverBody = document.getElementById('drivers-standings-body');
    const teamBody = document.getElementById('teams-standings-body');
    if (driverBody) driverBody.innerHTML = '<tr><td colspan="9">Fehler beim Laden der Fahrer-WM.</td></tr>';
    if (teamBody) teamBody.innerHTML = '<tr><td colspan="8">Fehler beim Laden der Team-WM.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', loadStandingsPage);
